"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { api } from "@/lib/client/api";

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: "admin" | "manager" | "staff";
  active: boolean;
}

const ROLE_LABEL = { admin: "Admin", manager: "Manager", staff: "Staff" } as const;

export function UsersAdmin({ currentUserId }: { currentUserId: number }) {
  const qc = useQueryClient();
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<{ items: UserRow[] }>("/users") });

  const done = (text: string) => {
    setNotice({ kind: "success", text });
    qc.invalidateQueries({ queryKey: ["users"] });
  };
  const fail = (e: unknown) => setNotice({ kind: "error", text: (e as Error).message });

  const create = useMutation({
    mutationFn: (body: object) => api("/users", { method: "POST", body }),
    onSuccess: () => done("Account created."),
    onError: fail,
  });
  const update = useMutation({
    mutationFn: (v: { id: number; patch: object }) => api(`/users/${v.id}`, { method: "PATCH", body: v.patch }),
    onSuccess: () => done("Account updated."),
    onError: fail,
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Staff accounts</h1>
      {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Create an account</h2>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            create.mutate(
              { name: f.get("name"), email: f.get("email"), password: f.get("password"), role: f.get("role") },
              { onSuccess: () => form.reset() },
            );
          }}
        >
          <Field label="Full name"><Input name="name" required maxLength={100} /></Field>
          <Field label="Email"><Input name="email" type="email" required /></Field>
          <Field label="Temporary password" hint="At least 8 characters. Share it with them securely."><Input name="password" type="text" required minLength={8} autoComplete="off" /></Field>
          <Field label="Role">
            <Select name="role" defaultValue="staff">
              <option value="staff">Staff: register &amp; cancel attendees</option>
              <option value="manager">Manager: also manages workshops</option>
              <option value="admin">Admin: manages accounts</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create account"}</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Everyone</h2>
        {users.isError && <Alert>{(users.error as Error).message}</Alert>}
        <ul className="divide-y divide-slate-200">
          {users.data?.items.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">
                  {u.name} {u.id === currentUserId && <span className="text-sm text-slate-500">(you)</span>}
                </p>
                <p className="text-sm text-slate-600">{u.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!u.active && <Badge tone="red">Deactivated</Badge>}
                <Select
                  aria-label={`Role for ${u.name}`}
                  className="w-auto"
                  value={u.role}
                  disabled={update.isPending}
                  onChange={(e) => update.mutate({ id: u.id, patch: { role: e.target.value } })}
                >
                  {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
                <Button
                  variant="secondary"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ id: u.id, patch: { active: !u.active } })}
                >
                  {u.active ? "Deactivate" : "Reactivate"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={update.isPending}
                  onClick={() => {
                    const pw = window.prompt(`New password for ${u.name} (min 8 characters):`);
                    if (pw) update.mutate({ id: u.id, patch: { password: pw } });
                  }}
                >
                  Reset password
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
