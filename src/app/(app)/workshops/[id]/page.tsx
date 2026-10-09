import { notFound, redirect } from "next/navigation";
import { WorkshopDetail } from "@/components/WorkshopDetail";
import { can } from "@/lib/auth/guard";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function WorkshopPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "viewOperations")) redirect("/");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <WorkshopDetail id={id} canManage={can(user, "manageWorkshops")} />;
}
