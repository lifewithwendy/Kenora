import bcrypt from "bcryptjs";
import { prisma } from "@/db";
import type { Role } from "@/generated/prisma/client";
import { destroyUserSessions } from "@/lib/auth/session";
import { AppError, conflict, isUniqueViolation, notFound } from "@/lib/errors";
import { writeAudit } from "./audit";

const publicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);

const findByEmail = (email: string) =>
  prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

export async function authenticate(email: string, password: string) {
  const u = await findByEmail(email);
  // Compare even when the user is missing so response time doesn't reveal which emails exist.
  const ok = await bcrypt.compare(
    password,
    u?.passwordHash ??
      "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali",
  );
  if (!u || !ok || !u.active) {
    throw new AppError(
      "INVALID_CREDENTIALS",
      401,
      "Email or password is incorrect.",
    );
  }
  return u;
}

export const listUsers = () =>
  prisma.user.findMany({ select: publicSelect, orderBy: { name: "asc" } });

export async function createUser(
  actorId: number,
  input: { name: string; email: string; password: string; role: Role },
) {
  if (await findByEmail(input.email))
    throw conflict("CONFLICT", "An account with that email already exists.");

  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          role: input.role,
          passwordHash,
        },
        select: publicSelect,
      });
      await writeAudit(tx, {
        actorId,
        action: "user.create",
        entityType: "user",
        entityId: created.id,
        after: { email: created.email, role: created.role },
      });
      return created;
    });
  } catch (e) {
    if (isUniqueViolation(e))
      throw conflict("CONFLICT", "An account with that email already exists.");
    throw e;
  }
}

export async function updateUser(
  actorId: number,
  id: number,
  patch: { name?: string; role?: Role; active?: boolean; password?: string },
) {
  const passwordHash = patch.password
    ? await hashPassword(patch.password)
    : undefined;

  const result = await prisma.$transaction(async (tx) => {
    // Lock every active admin row so two concurrent demotions can't both pass the "last admin" check.
    await tx.$queryRaw`SELECT id FROM users WHERE role = 'admin' AND active = true FOR UPDATE`;

    const before = await tx.user.findUnique({
      where: { id },
      select: publicSelect,
    });
    if (!before) throw notFound("User");
    // Lock the target too (it may not be an admin).
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;

    const losesAdmin =
      before.role === "admin" &&
      before.active &&
      ((patch.role !== undefined && patch.role !== "admin") ||
        patch.active === false);
    if (losesAdmin) {
      const others = await tx.user.count({
        where: { role: "admin", active: true, id: { not: id } },
      });
      if (others === 0)
        throw conflict(
          "CONFLICT",
          "There must always be at least one active Admin.",
        );
    }

    const after = await tx.user.update({
      where: { id },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.role !== undefined && { role: patch.role }),
        ...(patch.active !== undefined && { active: patch.active }),
        ...(passwordHash && { passwordHash }),
      },
      select: publicSelect,
    });

    await writeAudit(tx, {
      actorId,
      action:
        patch.password && Object.keys(patch).length === 1
          ? "user.reset_password"
          : "user.update",
      entityType: "user",
      entityId: id,
      before: { name: before.name, role: before.role, active: before.active },
      after: { name: after.name, role: after.role, active: after.active },
    });
    return {
      after,
      revoke:
        patch.active === false || patch.role !== undefined || !!passwordHash,
    };
  });

  // Role change, deactivation or password reset force a fresh sign-in.
  if (result.revoke) await destroyUserSessions(id);
  return result.after;
}
