import { ZodError, type ZodType } from "zod";
import { AppError } from "./errors";
import { requirePermission, requireUser, type Permission } from "./auth/guard";
import type { SessionUser } from "./auth/session";

type Ctx = { params: Promise<Record<string, string>> };

type Access = Permission | "authenticated" | "public";

interface HandlerArgs<B> {
  user: SessionUser;
  body: B;
  req: Request;
  params: Record<string, string>;
}

/**
 * Wraps every route handler. `access` is REQUIRED: there is no way to write a route
 * that forgets its permission check. Auth runs before the body is parsed or any logic.
 */
export function route<B = undefined>(
  opts: { access: Access; body?: ZodType<B> },
  fn: (args: HandlerArgs<B>) => Promise<unknown>,
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      const user =
        opts.access === "public"
          ? (null as unknown as SessionUser)
          : opts.access === "authenticated"
            ? await requireUser()
            : await requirePermission(opts.access);

      let body = undefined as B;
      if (opts.body) {
        const raw = await req.json().catch(() => {
          throw new AppError("VALIDATION", 400, "Request body must be valid JSON.");
        });
        body = opts.body.parse(raw);
      }

      const params = ctx?.params ? await ctx.params : {};
      const result = await fn({ user, body, req, params });
      if (result instanceof Response) return result;
      return Response.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION",
          message: err.issues[0]?.message ?? "Invalid input.",
          details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      { status: 400 },
    );
  }
  console.error(err);
  return Response.json(
    { error: { code: "INTERNAL", message: "Something went wrong." } },
    { status: 500 },
  );
}

export function parseIntParam(value: string | undefined, label = "id"): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new AppError("VALIDATION", 400, `Invalid ${label}.`);
  return n;
}
