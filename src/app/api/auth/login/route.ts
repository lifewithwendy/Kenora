import { createSession, setSessionCookie } from "@/lib/auth/session";
import { route } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { authenticate } from "@/services/users";

export const dynamic = "force-dynamic";

export const POST = route(
  { access: "public", body: loginSchema },
  async ({ body }) => {
    const user = await authenticate(body.email, body.password);
    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  },
);
