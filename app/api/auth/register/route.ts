import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { createSession } from "@/lib/auth";

export const runtime = "nodejs";

//Expresión regular para validar la estructura del correo (regex)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const userData = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof userData.nombre === "string" ? userData.nombre.trim() : "";
  const emal = typeof userData.correo === "string" ? userData.correo.trim().toLowerCase() : "";
  const password = typeof userData.password === "string" ? userData.password : "";
  const status = userData.estatus ?? "ACTIVO";

  if (!name) return Response.json({ error: "El nombre completo es obligatorio" }, { status: 400 });
  if (!EMAIL_RE.test(emal)) return Response.json({ error: "Correo inválido" }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "El password debe tener al menos 8 caracteres" }, { status: 400 });
  if (status !== "ACTIVO" && status !== "CANCELADO") {
    return Response.json({ error: "Estatus debe ser ACTIVO o CANCELADO" }, { status: 400 });
  }

  //Se valida que existan las tablas necesarias
  await ensureSchema();
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO usuarios_assist (nombre, correo, password_hash, estatus)
       VALUES ($1,$2,$3,$4) RETURNING id, nombre, correo, estatus`,
      [name, emal, passwordHash, status],
    );
    //Creamos el JWT y la cookie de sesión
    await createSession(rows[0]);
    //Se regresan los datos del usuario
    return Response.json({ user: rows[0] }, { status: 201 });
  } catch (createException) {
    if ((createException as { code?: string }).code === "23505") {
      return Response.json({ error: "Ese correo ya está registrado" }, { status: 409 });
    }
    throw createException;
  }
}