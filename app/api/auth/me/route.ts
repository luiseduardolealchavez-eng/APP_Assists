import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  //Se obtienen los datos del usuario a través de la verificación del JWT el cual se obtiene desde la cokie
  return Response.json({ user: await getSession() });
}