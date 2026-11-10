"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { useMutation } from "@tanstack/react-query";
import { UnauthorizedError, usePager } from "./usePager";

type Result = { name: string; ok: boolean; chunks?: number; error?: string };
type Citation = { document: string; quote: string };
type Segment = { text: string; citations: Citation[] };
type ChatMsg = { role: "user" | "assistant"; content: string; segments?: Segment[]; error?: boolean };
type HistoryItem = { id: number; question: string; answer: string; segments: Segment[] | null; created_at: string };
type Doc = { id: number; filename: string; created_at: string };
const ACCEPT = ".pdf,.txt,.md";

export default function Home() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [me, setMe] = useState<{ nombre: string; correo: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [alert, setAlert] = useState<string | null>(null);

  const goLogin = useCallback(() => router.replace("/registro"), [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/registro");
  }

  const docsPager = usePager<Doc>("/api/documents", "documents", goLogin);
  const historyPager = usePager<HistoryItem>("/api/history", "history", goLogin);
  const docs = docsPager.items;
  const history = historyPager.items;
  //Para el proceso de crear o eliminar documentos como historial de preguntas-respuestas, se vuelve a la primera página los listados.
  const loadDocsFirst = docsPager.first;
  const loadHistory = historyPager.first;
  const loadDocs = docsPager.reload;

  const onMutationError = (err: Error) => {
    if (err instanceof UnauthorizedError) return goLogin();
    setAlert(err instanceof TypeError ? "Error de red" : err.message);
  };

  const saveMutation = useMutation({
    mutationFn: async (input: { title: string; text: string }) => {
      const response = await fetch("/api/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (response.status === 401) throw new UnauthorizedError();
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar el texto");
      return data as { name: string; chunks: number };
    },
    onSuccess: (data) => {
      setAlert(null);
      setResults([{ name: data.name, ok: true, chunks: data.chunks }]);
      setText("");
      setTitle("");
    },
    onError: onMutationError,
    onSettled: () => loadDocsFirst(),
  });
  const saving = saveMutation.isPending;

  function saveText(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || saving) return;
    saveMutation.mutate({ title, text });
  }

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    const questionUser = question.trim();
    if (!questionUser || asking) return;
    const next: ChatMsg[] = [...chat, { role: "user", content: questionUser }];
    setChat(next);
    setQuestion("");
    setAsking(true);
    try {
      const ressponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      });
      if (ressponse.status === 401) return goLogin();
      const data = await ressponse.json();
      if (!ressponse.ok) throw new Error(data.error ?? "Error");
      const segments: Segment[] = data.segments;
      setChat([...next, { role: "assistant", content: segments.map((segment) => segment.text).join(""), segments }]);
    } catch (exceptionChat) {
      setChat([...next, { role: "assistant", content: exceptionChat instanceof Error ? exceptionChat.message : "Error", error: true }]);
    } finally {
      setAsking(false);
      loadHistory();
    }
  }

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setMe(d.user));
  }, []);

  const pagerError = docsPager.error ?? historyPager.error;
  useEffect(() => {
    if (pagerError) setAlert(pagerError.message);
  }, [pagerError]);

  const removeMutation = useMutation({
    mutationFn: async (doc: Doc) => {
      const response = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (response.status === 401) throw new UnauthorizedError();
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "No se pudo eliminar el documento");
      }
    },
    onError: onMutationError,
    onSettled: () => loadDocs(),
  });

  function remove(doc: Doc) {
    if (!window.confirm(`¿Eliminar el documento: "${doc.filename}"?`)) return;
    removeMutation.mutate(doc);
  }

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const body = new FormData();
      files.forEach((file) => body.append("files", file));
      const ressponse = await fetch("/api/upload", { method: "POST", body });
      if (ressponse.status === 401) throw new UnauthorizedError();
      const data = await ressponse.json().catch(() => ({}));
      if (!data.results) throw new Error(data.error ?? "No se pudieron subir los archivos");
      return data.results as Result[];
    },
    onSuccess: (result) => {
      setResults(result);
      const failed = result.filter((resp) => !resp.ok);
      setAlert(failed.length ? failed.map((resp) => `${resp.name}: ${resp.error}`).join(" · ") : null);
    },
    onError: onMutationError,
    onSettled: () => loadDocsFirst(),
  });
  const busy = uploadMutation.isPending;

  function upload(list: FileList | File[]) {
    const files = Array.from(list).filter((file) => /\.(pdf|txt|md)$/i.test(file.name));
    if (!files.length) {
      setResults([{ name: "—", ok: false, error: "Solo .pdf, .txt o .md" }]);
      return setAlert("Solo se permiten archivos .pdf, .txt o .md");
    }
    uploadMutation.mutate(files);
  }

  return (
    <main className={styles.main}>
      {alert && (
        <div className={styles.alert} role="alert">
          <span></span>
          { alert === 'Failed to fetch' ? ( 'Revisa tu conexión a Internet o que el sitio está disponible.') : (alert) }
          <button onClick={() => setAlert(null)} aria-label="Cerrar alerta">×</button>
        </div>
      )}
      <header className={styles.header}>
        <h1>DocsAssist</h1>
        <div className={styles.bar}>
          <span>{me ? `${me.nombre} (${me.correo})` : ""}</span>
          <button onClick={logout}>Cerrar sesión</button>
        </div>
      </header>
      <p className={styles.sub}>Sube tus documentos PDF, TXT o Markdown (.MD).</p>

      <div className={styles.columns}>
        <div className={styles.col}>
      <div
        className={`${styles.drop} ${drag ? styles.active : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
        {busy ? "Procesando…" : "Arrastra archivos aquí o haz clic para seleccionar"}
        <small>.pdf · .txt · .md (máx. 60 MB)</small>
      </div>

      <form onSubmit={saveText} className={styles.paste}>
        <h2>O pega texto libre</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título (opcional)"
          maxLength={200}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pega aquí el texto…"
          rows={8}
        />
        <button disabled={saving || !text.trim()}>{saving ? "Guardando…" : "Guardar"}</button>
      </form>

      <ul className={styles.results}>
        {results.map((r, i) => (
          <li key={i} className={r.ok ? styles.ok : styles.err}>
            {r.ok ? "✓" : "✗"} {r.name} — {r.ok ? `${r.chunks} contenido-fragmentos` : r.error}
          </li>
        ))}
      </ul>

      <h2>Bit&aacute;cora de documentos guardados</h2>
      {docs.length === 0 ? (
        <p className={styles.sub}>Favor de subir tus documentos.</p>
      ) : (
        <ul className={styles.docs}>
          {docs.map((document) => (
            <li key={document.id}>
              <div>
                <strong>{document.filename}</strong>
                <small>{new Date(document.created_at).toLocaleString("es")}</small>
              </div>
              <button onClick={() => remove(document)}>Eliminar</button>
            </li>
          ))}
        </ul>
      )}
      {(docsPager.hasPrev || docsPager.hasNext) && (
      <nav className={styles.pager} aria-label="Paginado">
        <button onClick={docsPager.goPrev} disabled={!docsPager.hasPrev || docsPager.loading}>← Anterior</button>
        <span>P&aacute;gina {docsPager.page}</span>
        <button onClick={docsPager.goNext} disabled={!docsPager.hasNext || docsPager.loading}>Siguiente →</button>
      </nav>
      )}
        </div>
        <div className={styles.col}>
      <h2>Asistente</h2>
      <div className={styles.chat}>
        {chat.map((message, i) => (
          <div key={i} className={`${styles.msg} ${message.role === "user" ? styles.user : styles.bot} ${message.error ? styles.err : ""}`}>
            {message.segments
              ? message.segments.map((segment, idSegment) => (
                  <span key={idSegment}>
                    {segment.text}
                    {segment.citations.map((cita, idCita) => (
                      <sup key={idCita} className={styles.cite} title={cita.quote}>
                        [{cita.document}]
                      </sup>
                    ))}
                  </span>
                ))
              : message.content}
          </div>
        ))}
        {asking && <div className={`${styles.msg} ${styles.bot}`}>Buscando…</div>}
      </div>
      <form onSubmit={ask} className={styles.form}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Hazme una pregunta :)"
        />
        <button disabled={asking || !question.trim()}>Consultar</button>
      </form>

      <h2>Historial de preguntas</h2>
      {history.length === 0 ? (
        <p className={styles.sub}>Aún no has hecho preguntas.</p>
      ) : (
        <ul className={styles.history}>
          {history.map((itemHistory) => (
            <li key={itemHistory.id}>
              <small>{new Date(itemHistory.created_at).toLocaleString("es")}</small>
              <strong>{itemHistory.question}</strong>
              <p>
                {itemHistory.segments
                  ? itemHistory.segments.map((segment, idSegment) => (
                      <span key={idSegment}>
                        {segment.text}
                        {segment.citations.map((cita, idCita) => (
                          <sup key={idCita} className={styles.cite} title={cita.quote}>
                            [{cita.document}]
                          </sup>
                        ))}
                      </span>
                    ))
                  : itemHistory.answer}
              </p>
            </li>
          ))}
        </ul>
      )}
      {(historyPager.hasPrev || historyPager.hasNext) && (
      <nav className={styles.pager} aria-label="Paginado">
        <button onClick={historyPager.goPrev} disabled={!historyPager.hasPrev || historyPager.loading}>← Anterior</button>
        <span>P&aacute;gina {historyPager.page}</span>
        <button onClick={historyPager.goNext} disabled={!historyPager.hasNext || historyPager.loading}>Siguiente →</button>
      </nav>
      )}
        </div>
      </div>
    </main>
  );
}
