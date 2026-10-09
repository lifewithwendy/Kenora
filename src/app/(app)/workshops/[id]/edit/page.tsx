import { notFound, redirect } from "next/navigation";
import { WorkshopForm } from "@/components/WorkshopForm";
import { can } from "@/lib/auth/guard";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkshop } from "@/services/workshops";

export const dynamic = "force-dynamic";

export default async function EditWorkshopPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "manageWorkshops")) redirect("/workshops");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const workshop = await getWorkshop(id).catch(() => null);
  if (!workshop) notFound();
  // Dates cross the server/client boundary as ISO strings.
  return (
    <WorkshopForm
      workshop={{
        ...workshop,
        startsAt: workshop.startsAt.toISOString(),
        endsAt: workshop.endsAt?.toISOString() ?? null,
      }}
    />
  );
}
