import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const COOKIE = "session";
//7 días para su expiración
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  const secretKey = process.env.JWT_SECRET;
  if (!secretKey) throw new Error("Falta JWT_SECRET en .env.local");
  return new TextEncoder().encode(secretKey);
}

export type SessionUser = { id: number; nombre: string; correo: string; estatus: string };

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ nombre: user.nombre, correo: user.correo, estatus: user.estatus })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    //Regresamos los datos del usaurio
    return {
      id: Number(payload.sub),
      nombre: String(payload.nombre),
      correo: String(payload.correo),
      estatus: String(payload.estatus),
    };
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

//Devuelve el usuario con sesión válida o null (responder 401 no autorizado).
export async function requireUser() {
  const user = await getSession();
  return user && user.estatus === "ACTIVO" ? user : null;
}

export const unauthorized = () => Response.json({ error: "No autenticado" }, { status: 401 });