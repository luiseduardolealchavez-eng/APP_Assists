// Paginado por cursor (keyset por medio de la combinaciòn de los campos created_at e id
//Definir el número de registros a cargar
export const PAGE_SIZE = 10;

export type Cursor = { t: string; i: number };

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString());
    if (typeof c.t === "string" && Number.isInteger(c.i) && !Number.isNaN(Date.parse(c.t))) return c;
  } catch {}
  return null;
}

export function parseLimit(raw: string | null): number {
  const numberId = Number(raw);
  return Number.isInteger(numberId) && numberId > 0 ? Math.min(numberId, 50) : PAGE_SIZE;
}

//Recibe limit+1 filas y devuelve la página junto con el cursor de la siguiente.
export function toPage<T extends { id: number; cursor_ts: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map(({ cursor_ts, ...rest }) => rest);
  const last = hasMore ? rows[limit - 1] : null;
  return { items, nextCursor: last ? encodeCursor({ t: last.cursor_ts, i: last.id }) : null };
}