import { parseIntParam, route } from "@/lib/http";
import { updateUserSchema } from "@/lib/validation";
import { updateUser } from "@/services/users";

export const dynamic = "force-dynamic";

export const PATCH = route(
  { access: "manageUsers", body: updateUserSchema },
  ({ user, body, params }) =>
    updateUser(user.id, parseIntParam(params.id), body),
);
