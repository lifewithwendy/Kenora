import { redirect } from "next/navigation";
import { AuditLog } from "@/components/AuditLog";
import { can } from "@/lib/auth/guard";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "viewAudit")) redirect("/");
  return <AuditLog />;
}
