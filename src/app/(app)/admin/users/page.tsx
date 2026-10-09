import { redirect } from "next/navigation";
import { UsersAdmin } from "@/components/UsersAdmin";
import { can } from "@/lib/auth/guard";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "manageUsers")) redirect("/");
  return <UsersAdmin currentUserId={user.id} />;
}
