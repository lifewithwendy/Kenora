import type { Role } from "@/generated/prisma/client";
import { forbidden, unauthenticated } from "../errors";
import { getCurrentUser, type SessionUser } from "./session";

/** Single source of truth for who may do what. Routes reference these, never literal role lists. */
export const PERMISSIONS = {
  manageUsers: ["admin"],
  manageWorkshops: ["manager"],
  manageRegistrations: ["manager", "staff"],
  viewOperations: ["manager", "staff"],
  viewAudit: ["admin", "manager"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(user: Pick<SessionUser, "role">, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(user.role);
}

/** Throws 401 when signed out and 403 when the role isn't allowed. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthenticated();
  if (!can(user, permission)) throw forbidden();
  return user;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthenticated();
  return user;
}
