import { redirect } from "next/navigation";
import { NavBar, type NavLink } from "@/components/NavBar";
import { Providers } from "@/components/Providers";
import { can } from "@/lib/auth/guard";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const links: NavLink[] = [];
  if (can(user, "viewOperations")) links.push({ href: "/workshops", label: "Workshops" });
  if (can(user, "manageUsers")) links.push({ href: "/admin/users", label: "Staff accounts" });
  if (can(user, "viewAudit")) links.push({ href: "/admin/audit", label: "Activity log" });

  return (
    <Providers>
      <NavBar user={{ name: user.name, role: user.role }} links={links} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </Providers>
  );
}
