import { createHash } from "node:crypto";
import { pool } from "./db";
import { chunkText } from "./chunk";
import { embed, toVector } from "./embed";
import { ensureSchema } from "./schema";

export class DuplicateError extends Error {
  constructor(existing: string) {
    super(`Contenido duplicado: ya existe como "${existing}"`);
  }
}

// Hash del texto normalizado (espacios/saltos de línea), así el mismo contenido se detecta aunque cambie el nombre del archivo o el formato de espacios.
export function hashText(text: string) {
  const norm = text.replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha256").update(norm).digest("hex");
}

export async function ingestText(opts: {
  userId: number;
  text: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{ chunks: number }> {
  //Se valida que existan las tablas necesarias
  await ensureSchema();
  const chunks = chunkText(opts.text);
  if (!chunks.length) throw new Error("No se encontró texto en el contenido");

  const hash = hashText(opts.text);
  const documentValidation = await pool.query("SELECT filename FROM documents WHERE user_id = $1 AND content_hash = $2", [opts.userId, hash]);
  if (documentValidation.rows.length) throw new DuplicateError(documentValidation.rows[0].filename);

  const vectors: number[][] = [];
  for (let i = 0; i < chunks.length; i += 16) {
    vectors.push(...(await embed(chunks.slice(i, i + 16))));
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "INSERT INTO documents (filename, mime_type, size_bytes, content_hash, user_id) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [opts.filename, opts.mimeType, opts.sizeBytes, hash, opts.userId],
    );
    for (let i = 0; i < chunks.length; i++) {
      await client.query(
        "INSERT INTO chunks (document_id, position, content, embedding) VALUES ($1,$2,$3,$4)",
        [rows[0].id, i, chunks[i], toVector(vectors[i])],
      );
    }
    await client.query("COMMIT");
  } catch (exceptionDocument) {
    await client.query("ROLLBACK");
    // Carrera: dos subidas simultáneas del mismo contenido
    if ((exceptionDocument as { code?: string }).code === "23505") throw new DuplicateError(opts.filename);
    throw exceptionDocument;
  } finally {
    client.release();
  }
  return { chunks: chunks.length };
}