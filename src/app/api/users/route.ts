import { route } from "@/lib/http";
import { createUserSchema } from "@/lib/validation";
import { createUser, listUsers } from "@/services/users";

export const dynamic = "force-dynamic";

export const GET = route({ access: "manageUsers" }, async () => ({
  items: await listUsers(),
}));

export const POST = route(
  { access: "manageUsers", body: createUserSchema },
  async ({ user, body }) => {
    const created = await createUser(user.id, body);
    return Response.json(created, { status: 201 });
  },
);
