import { route } from "@/lib/http";
import { createWorkshopSchema, workshopQuerySchema } from "@/lib/validation";
import { createWorkshop, listWorkshops } from "@/services/workshops";

export const dynamic = "force-dynamic";

export const GET = route({ access: "viewOperations" }, async ({ req }) => {
  const query = workshopQuerySchema.parse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  return listWorkshops(query);
});

export const POST = route(
  { access: "manageWorkshops", body: createWorkshopSchema },
  async ({ user, body }) => {
    const created = await createWorkshop(user.id, body);
    return Response.json(created, { status: 201 });
  },
);
