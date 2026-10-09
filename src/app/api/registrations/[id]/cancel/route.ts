import { parseIntParam, route } from "@/lib/http";
import { cancelSchema } from "@/lib/validation";
import { cancelRegistration } from "@/services/registrations";

export const dynamic = "force-dynamic";

export const POST = route(
  { access: "manageRegistrations", body: cancelSchema },
  ({ user, body, params }) =>
    cancelRegistration(user.id, parseIntParam(params.id), body.reason),
);
