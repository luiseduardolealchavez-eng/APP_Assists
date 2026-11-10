import { pool } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "ID inválido" }, { status: 400 });
  // los chunks se eliminan en cascada
  const { rowCount } = await pool.query("DELETE FROM documents WHERE id = $1 AND user_id = $2", [id, user.id]);
  if (!rowCount) return Response.json({ error: "No encontrado" }, { status: 404 });
  return Response.json({ ok: true });
}