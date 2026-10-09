import { parseIntParam, route } from "@/lib/http";
import { updateWorkshopSchema } from "@/lib/validation";
import { getWorkshop, updateWorkshop } from "@/services/workshops";

export const dynamic = "force-dynamic";

export const GET = route({ access: "viewOperations" }, ({ params }) =>
  getWorkshop(parseIntParam(params.id)),
);

export const PATCH = route(
  { access: "manageWorkshops", body: updateWorkshopSchema },
  async ({ user, body, params }) => {
    const id = parseIntParam(params.id);
    await updateWorkshop(user.id, id, body);
    return getWorkshop(id);
  },
);
