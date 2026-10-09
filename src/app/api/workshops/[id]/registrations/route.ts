import { parseIntParam, route } from "@/lib/http";
import { registerSchema } from "@/lib/validation";
import { registerAttendee } from "@/services/registrations";
import { listAttendees } from "@/services/workshops";

export const dynamic = "force-dynamic";

export const GET = route(
  { access: "viewOperations" },
  async ({ req, params }) => {
    const includeCancelled =
      new URL(req.url).searchParams.get("includeCancelled") === "true";
    return {
      items: await listAttendees(parseIntParam(params.id), includeCancelled),
    };
  },
);

export const POST = route(
  { access: "manageRegistrations", body: registerSchema },
  async ({ user, body, params }) => {
    const reg = await registerAttendee(user.id, parseIntParam(params.id), body);
    return Response.json(reg, { status: 201 });
  },
);
