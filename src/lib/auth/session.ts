import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/db";
import type { Role } from "@/generated/prisma/client";

export const SESSION_COOKIE = "kenora_session";
const SESSION_DAYS = 7;

export type SessionUser = { id: number; name: string; email: string; role: Role };

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.session.create({ data: { id: hash(token), userId, expiresAt } });
  return { token, expiresAt };
}

/** Resolves a raw cookie token to its user. Deactivated users never resolve. */
export async function userFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await prisma.session.findFirst({
    where: { id: hash(token), expiresAt: { gt: new Date() }, user: { active: true } },
    select: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  return session?.user ?? null;
}

export async function destroySession(token: string | undefined) {
  if (token) await prisma.session.deleteMany({ where: { id: hash(token) } });
}

export async function destroyUserSessions(userId: number) {
  await prisma.session.deleteMany({ where: { userId } });
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
