import { DuplicateError, ingestText } from "@/lib/ingest";
import { requireUser, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

//Maxímo de caracteres permitidos
const MAX_CHARS = 2_000_000;

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const { text, title } = (await req.json()) as { text?: string; title?: string };
  if (!text?.trim()) return Response.json({ error: "El texto está vacío" }, { status: 400 });
  if (text.length > MAX_CHARS) return Response.json({ error: "El texto es demasiado largo" }, { status: 400 });

  const name = title?.trim() || `Documento sin titulo ${new Date().toLocaleString("es")}`;
  try {
    //Se realiza el registro de documentos y las diferentes partes del contenido (chunks)
    const { chunks } = await ingestText({
      userId: user.id,
      text,
      filename: name,
      mimeType: "text/plain",
      sizeBytes: Buffer.byteLength(text),
    });
    return Response.json({ ok: true, name, chunks });
  } catch (exceptionText) {
    const msg = exceptionText instanceof Error ? exceptionText.message : "Error al guardar el texto";
    return Response.json({ error: msg }, { status: exceptionText instanceof DuplicateError ? 409 : 500 });
  }
}