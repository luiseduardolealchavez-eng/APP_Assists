import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { createSession } from "@/lib/auth";

export const runtime = "nodejs";

// Hash falso para igualar tiempos cuando el correo no existe. Necesario como referencia
const DUMMY = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.0bXn0d0b9mC1kq3m4n9s1p1l9uXe";

export async function POST(req: Request) {
  const userData = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const emial = typeof userData.correo === "string" ? userData.correo.trim().toLowerCase() : "";
  const password = typeof userData.password === "string" ? userData.password : "";
  if (!emial || !password) return Response.json({ error: "Correo y password son obligatorios" }, { status: 400 });

  //Se valida que existan las tablas necesarias
  await ensureSchema();
  const { rows } = await pool.query(
    "SELECT id, nombre, correo, estatus, password_hash FROM usuarios_assist WHERE lower(correo) = $1",
    [emial],
  );
  const userDataDb = rows[0];
  const passwordValid = await bcrypt.compare(password, userDataDb?.password_hash ?? DUMMY);
  //Código 401 de acceso no autorizado
  if (!userDataDb || !passwordValid) return Response.json({ error: "Correo o password incorrectos" }, { status: 401 });
  //Se valida si el usuario está activo. Esta activación-cancelación solo se realiza directamente en la BD de Postgresql
  if (userDataDb.estatus !== "ACTIVO") return Response.json({ error: "Usuario cancelado" }, { status: 403 });

  const user = { id: userDataDb.id, nombre: userDataDb.nombre, correo: userDataDb.correo, estatus: userDataDb.estatus };
  //Creación del JWT y de la cookie de sesión
  await createSession(user);
  //Regresamos los datos del usuario
  return Response.json({ user });
}