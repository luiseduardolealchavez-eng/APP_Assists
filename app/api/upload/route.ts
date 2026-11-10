import { PDFParse } from "pdf-parse";
import { ingestText } from "@/lib/ingest";
import { requireUser, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

//Tamaño máximo de los documentos en MB
const MAX_BYTES = 60 * 1024 * 1024;

async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    const parser = new PDFParse({ data: new Uint8Array(await file.arrayBuffer()) });
    try {
      return (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  }
  if (name.endsWith(".txt") || name.endsWith(".md")) return file.text();
  throw new Error("Tipo de archivo no soportado (Solo se permiten .pdf, .txt, .md)");
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return Response.json({ error: "No hay archivos cargados en el formulario" }, { status: 400 });

  const results = [];
  for (const file of files) {
    try {
      if (file.size > MAX_BYTES) throw new Error("Archivo mayor a 60 MB");
      const text = await extractText(file);
      //Se realiza el registro de documentos y las diferentes partes del contenido (chunks)
      const { chunks } = await ingestText({
        userId: user.id,
        text,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      results.push({ name: file.name, ok: true, chunks });
    } catch (exceptionText) {
      results.push({ name: file.name, ok: false, error: exceptionText instanceof Error ? exceptionText.message : "Error al guardar el documento" });
    }
  }
  return Response.json({ results });
}