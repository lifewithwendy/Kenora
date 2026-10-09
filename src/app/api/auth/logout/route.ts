import { clearSessionCookie } from "@/lib/auth/session";
import { route } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = route({ access: "public" }, async () => {
  await clearSessionCookie();
  return { ok: true };
});
