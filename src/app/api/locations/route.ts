import { route } from "@/lib/http";
import { listLocations } from "@/services/workshops";

export const dynamic = "force-dynamic";

export const GET = route({ access: "viewOperations" }, async () => ({
  items: await listLocations(),
}));
