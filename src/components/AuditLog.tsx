"use client";
import { useQuery } from "@tanstack/react-query";
import { Alert, Card } from "@/components/ui";
import { api } from "@/lib/client/api";

interface Entry {
  id: number;
  at: string;
  action: string;
  entityType: string;
  entityId: number | null;
  before: unknown;
  after: unknown;
  actorName: string | null;
}

const LABELS: Record<string, string> = {
  "user.create": "created an account",
  "user.update": "changed an account",
  "user.reset_password": "reset a password",
  "workshop.create": "created a workshop",
  "workshop.update": "edited a workshop",
  "registration.create": "registered an attendee",
  "registration.cancel": "cancelled a registration",
};

const summary = (v: unknown) => (v && typeof v === "object" ? Object.entries(v).map(([k, x]) => `${k}: ${String(x)}`).join(", ") : "");

export function AuditLog() {
  const q = useQuery({ queryKey: ["audit"], queryFn: () => api<{ items: Entry[] }>("/audit") });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Activity log</h1>
      <p className="text-slate-600">The most recent changes to accounts, workshops and registrations.</p>
      {q.isError && <Alert>{(q.error as Error).message}</Alert>}
      <Card>
        <ul className="divide-y divide-slate-200">
          {q.data?.items.map((e) => (
            <li key={e.id} className="py-3">
              <p>
                <span className="font-semibold">{e.actorName ?? "System"}</span> {LABELS[e.action] ?? e.action}{" "}
                <span className="text-slate-500">
                  ({e.entityType} #{e.entityId})
                </span>
              </p>
              <p className="text-sm text-slate-600">{new Date(e.at).toLocaleString()}</p>
              {Boolean(e.before || e.after) && (
                <p className="text-sm text-slate-500">
                  {e.before ? `Before: ${summary(e.before)} · ` : ""}
                  {e.after ? `After: ${summary(e.after)}` : ""}
                </p>
              )}
            </li>
          ))}
          {q.data?.items.length === 0 && <li className="py-3 text-slate-600">Nothing yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
