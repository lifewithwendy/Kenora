import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/db";
import type { Role } from "@/generated/prisma/client";

export const SESSION_COOKIE = "kenora_session";
const SESSION_HOURS = 12;

export type SessionUser = { id: number; name: string; email: string; role: Role };

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set to at least 32 characters (see .env.example)");
  }
  return new TextEncoder().encode(secret);
}

/**
 * The token only proves who the user is (`sub`). Role and active status are never read from it,
 * they are looked up on every request, so deactivating someone or changing their role applies at once.
 */
export async function createSession(userId: number) {
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3_600_000);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());
  return { token, expiresAt };
}

/** Verifies the token, then loads the user fresh from the database. Inactive users never resolve. */
export async function userFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const key = secretKey();

  let sub: string | undefined;
  let iat: number | undefined;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    sub = payload.sub;
    iat = payload.iat;
  } catch {
    return null; // bad signature, malformed or expired
  }

  const id = Number(sub);
  if (!Number.isInteger(id) || iat === undefined) return null;

  const user = await prisma.user.findFirst({
    where: { id, active: true },
    select: { id: true, name: true, email: true, role: true, authValidFrom: true },
  });
  // Tokens issued before a password reset are rejected.
  if (!user || iat < Math.floor(user.authValidFrom.getTime() / 1000)) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Current user for server components / handlers, or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
}
