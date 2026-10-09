export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "WORKSHOP_FULL"
  | "WORKSHOP_NOT_OPEN"
  | "ALREADY_REGISTERED"
  | "ALREADY_CANCELLED"
  | "CONFLICT"
  | "INVALID_CREDENTIALS";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const unauthenticated = () => new AppError("UNAUTHENTICATED", 401, "Please sign in.");
export const forbidden = () =>
  new AppError("FORBIDDEN", 403, "You don't have permission to do that.");
export const notFound = (what = "Item") => new AppError("NOT_FOUND", 404, `${what} not found.`);
export const conflict = (code: ErrorCode, message: string) => new AppError(code, 409, message);

/** Prisma unique-constraint violation (P2002). Also matches a raw Postgres 23505. */
export function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "P2002" || err?.code === "23505" || err?.cause?.code === "23505";
}
