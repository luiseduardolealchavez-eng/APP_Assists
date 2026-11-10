import { destroySession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  //Destruye la cokie de sesión
  await destroySession();
  return Response.json({ ok: true });
}