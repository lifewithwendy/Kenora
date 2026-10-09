import { route } from "@/lib/http";
import { listAudit } from "@/services/audit";

export const dynamic = "force-dynamic";

export const GET = route({ access: "viewAudit" }, async () => ({
  items: await listAudit(),
}));
