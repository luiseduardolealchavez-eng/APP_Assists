import { pool } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { requireUser, unauthorized } from "@/lib/auth";
import { decodeCursor, parseLimit, toPage } from "@/lib/pagination";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  //Validación de que las tablas existen en la BD
  await ensureSchema();
  const params = new URL(req.url).searchParams;
  const limit = parseLimit(params.get("limit"));
  const cursor = decodeCursor(params.get("cursor"));
  //Se realiza la carga de preguntas-respuestas a través de cursores ordenados por la fecha de creación (las últimas preguntas se muestran al principio)
  const { rows } = await pool.query(
    `SELECT id, question, answer, segments, created_at, created_at::text AS cursor_ts
       FROM questions
      WHERE user_id = $1
        AND ($2::timestamptz IS NULL OR (created_at, id) < ($2::timestamptz, $3::int))
      ORDER BY created_at DESC, id DESC
      LIMIT $4`,
    [user.id, cursor?.t ?? null, cursor?.i ?? null, limit + 1],
  );
  const { items, nextCursor } = toPage(rows, limit);
  return Response.json({ history: items, nextCursor });
}