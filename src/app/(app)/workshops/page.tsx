import { redirect } from "next/navigation";
import { Suspense } from "react";
import { WorkshopList } from "@/components/WorkshopList";
import { can } from "@/lib/auth/guard";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function WorkshopsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "viewOperations")) redirect("/");
  return (
    <Suspense>
      <WorkshopList canManage={can(user, "manageWorkshops")} />
    </Suspense>
  );
}
