import { route } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = route({ access: "authenticated" }, async ({ user }) => ({
  user,
}));
