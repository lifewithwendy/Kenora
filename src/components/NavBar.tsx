"use client";
import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { Button } from "./ui";

export interface NavLink {
  href: string;
  label: string;
}

export function NavBar({ user, links }: { user: { name: string; role: string }; links: NavLink[] }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="text-lg font-bold text-indigo-800">Kenora Workshops</span>
        <nav className="flex flex-1 gap-1" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "rounded-lg px-3 py-2 text-base font-medium",
                pathname.startsWith(l.href) ? "bg-indigo-50 text-indigo-800" : "text-slate-700 hover:bg-slate-100",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">
            {user.name} <span className="capitalize text-slate-500">({user.role})</span>
          </span>
          <Button variant="secondary" onClick={logout}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
