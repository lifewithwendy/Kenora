import { redirect } from "next/navigation";
import { can } from "@/lib/auth/guard";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(can(user, "viewOperations") ? "/workshops" : "/admin/users");
}
