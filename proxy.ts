import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Protege la página principal: "/" requiere sesión; "/registro" redirige a "/" si ya hay sesión.
async function hasSession(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token || !process.env.JWT_SECRET) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const logged = await hasSession(req);
  const { pathname } = req.nextUrl;
  if (pathname === "/" && !logged) return NextResponse.redirect(new URL("/registro", req.url));
  if (pathname === "/registro" && logged) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/", "/registro"] };