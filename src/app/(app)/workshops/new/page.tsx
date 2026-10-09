import { redirect } from "next/navigation";
import { WorkshopForm } from "@/components/WorkshopForm";
import { can } from "@/lib/auth/guard";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NewWorkshopPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "manageWorkshops")) redirect("/workshops");
  return <WorkshopForm />;
}
