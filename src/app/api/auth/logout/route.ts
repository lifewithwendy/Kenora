import { cookies } from "next/headers";
import {
  clearSessionCookie,
  destroySession,
  SESSION_COOKIE,
} from "@/lib/auth/session";
import { route } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = route({ access: "public" }, async () => {
  await destroySession((await cookies()).get(SESSION_COOKIE)?.value);
  await clearSessionCookie();
  return { ok: true };
});
