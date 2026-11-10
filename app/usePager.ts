import { useCallback, useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

export class UnauthorizedError extends Error {
  constructor() {
    super("Sesión expirada");
  }
}

type Page<T> = { rows: T[]; nextCursor: string | null };

// Paginado por cursor: guarda la pila de cursores de las páginas visitadas para poder retroceder sin que el servidor tenga que contar filas.
export function usePager<T>(endpoint: string, key: string, onUnauthorized: () => void) {
  const queryClient = useQueryClient();
  const [stack, setStack] = useState<(string | null)[]>([null]);
  const cursor = stack[stack.length - 1];

  const query = useQuery<Page<T>>({
    queryKey: [key, cursor],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const response = await fetch(`${endpoint}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
      if (response.status === 401) throw new UnauthorizedError();
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `Error al cargar (${response.status})`);
      return { rows: data[key] ?? [], nextCursor: data.nextCursor ?? null };
    },
  });

  const { data, error, isFetching, isPlaceholderData } = query;

  useEffect(() => {
    if (error instanceof UnauthorizedError) onUnauthorized();
  }, [error, onUnauthorized]);

  // Si la página quedó vacía (Ejemplo. se eliminó su último registro), retrocede al paginado
  useEffect(() => {
    if (data && !isPlaceholderData && data.rows.length === 0 && stack.length > 1) {
      setStack((s) => s.slice(0, -1));
    }
  }, [data, isPlaceholderData, stack.length]);

  const reload = useCallback(() => queryClient.invalidateQueries({ queryKey: [key] }), [queryClient, key]);
  // Nuevos documentos o preguntas-respuestas, aparecen al inicio el listado, por lo que se vuelve a la primera página.
  const first = useCallback(() => {
    setStack([null]);
    return queryClient.invalidateQueries({ queryKey: [key] });
  }, [queryClient, key]);

  const next = data?.nextCursor ?? null;
  return {
    items: data?.rows ?? [],
    page: stack.length,
    hasPrev: stack.length > 1,
    hasNext: !!next,
    loading: isFetching,
    error: error instanceof UnauthorizedError ? null : error,
    reload,
    first,
    goNext: () => next && setStack((s) => [...s, next]),
    goPrev: () => stack.length > 1 && setStack((s) => s.slice(0, -1)),
  };
}