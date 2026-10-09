"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Alert, Badge, Button, Card, Field, Input } from "@/components/ui";
import { api, fmtDateTime, type Attendee, type WorkshopRow } from "@/lib/client/api";
import { SeatsBadge, StatusBadge } from "./WorkshopList";

export function WorkshopDetail({ id, canManage }: { id: number; canManage: boolean }) {
  const qc = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  const workshop = useQuery({ queryKey: ["workshop", id], queryFn: () => api<WorkshopRow>(`/workshops/${id}`) });
  const attendees = useQuery({
    queryKey: ["attendees", id, showHistory],
    queryFn: () => api<{ items: Attendee[] }>(`/workshops/${id}/registrations?includeCancelled=${showHistory}`),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["workshop", id] });
    qc.invalidateQueries({ queryKey: ["attendees", id] });
    qc.invalidateQueries({ queryKey: ["workshops"] });
  };

  const register = useMutation({
    mutationFn: (body: { attendeeName: string; attendeeEmail: string }) =>
      api(`/workshops/${id}/registrations`, { method: "POST", body }),
    onSuccess: (_d, v) => {
      setNotice({ kind: "success", text: `${v.attendeeName} is registered.` });
      refresh();
    },
    onError: (e) => {
      setNotice({ kind: "error", text: (e as Error).message });
      refresh(); // seat counts may have changed under us
    },
  });

  const cancel = useMutation({
    mutationFn: (v: { regId: number; reason: string }) =>
      api(`/registrations/${v.regId}/cancel`, { method: "POST", body: { reason: v.reason || undefined } }),
    onSuccess: () => {
      setNotice({ kind: "success", text: "Registration cancelled. The seat is free again." });
      setConfirmId(null);
      setReason("");
      refresh();
    },
    onError: (e) => {
      setNotice({ kind: "error", text: (e as Error).message });
      setConfirmId(null);
      refresh();
    },
  });

  if (workshop.isError) return <Alert>{(workshop.error as Error).message}</Alert>;
  if (!workshop.data) return <p className="text-slate-600">Loading…</p>;
  const w = workshop.data;
  const canRegister = w.status === "open" && w.seatsAvailable > 0;

  return (
    <div className="space-y-5">
      <Link href="/workshops" className="text-indigo-700 hover:underline">
        ← All workshops
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{w.title}</h1>
            <p className="text-slate-600">{w.code}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={w.status} />
            <SeatsBadge w={w} />
            {canManage && (
              <Link href={`/workshops/${w.id}/edit`}>
                <Button variant="secondary">Edit workshop</Button>
              </Link>
            )}
          </div>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><dt className="text-sm text-slate-500">When</dt><dd>{fmtDateTime(w.startsAt)}{w.endsAt ? ` – ${new Date(w.endsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : ""}</dd></div>
          <div><dt className="text-sm text-slate-500">Instructor</dt><dd>{w.instructor}</dd></div>
          <div><dt className="text-sm text-slate-500">Location</dt><dd>{w.locationName ?? "—"}</dd></div>
          <div><dt className="text-sm text-slate-500">Seats</dt><dd>{w.seatsTaken} of {w.capacity} taken</dd></div>
        </dl>
        {w.description && <p className="mt-4 text-slate-700">{w.description}</p>}
      </Card>

      {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Register someone</h2>
        {w.status !== "open" ? (
          <Alert kind="info">This workshop is {w.status}, so it isn’t taking registrations.</Alert>
        ) : !canRegister ? (
          <Alert kind="info">This workshop is full. Cancel a registration to free a seat.</Alert>
        ) : (
          <form
            className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fd = new FormData(form);
              register.mutate(
                { attendeeName: String(fd.get("name")), attendeeEmail: String(fd.get("email")) },
                { onSuccess: () => form.reset() },
              );
            }}
          >
            <Field label="Attendee name"><Input name="name" required maxLength={100} /></Field>
            <Field label="Attendee email"><Input name="email" type="email" required /></Field>
            <Button type="submit" disabled={register.isPending}>
              {register.isPending ? "Registering…" : "Register"}
            </Button>
          </form>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{showHistory ? "Full registration history" : "Registered attendees"}</h2>
          <label className="flex items-center gap-2 text-base">
            <input type="checkbox" className="h-5 w-5" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} />
            Show cancelled &amp; history
          </label>
        </div>

        {attendees.isError && <Alert>{(attendees.error as Error).message}</Alert>}
        {attendees.data && attendees.data.items.length === 0 && <p className="text-slate-600">No one is registered yet.</p>}

        <ul className="divide-y divide-slate-200">
          {attendees.data?.items.map((a) => (
            <li key={a.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={a.status === "cancelled" ? "font-medium text-slate-500 line-through" : "font-medium"}>
                    {a.attendeeName} <span className="font-normal text-slate-600">· {a.attendeeEmail}</span>
                  </p>
                  <p className="text-sm text-slate-600">
                    Registered by {a.registeredByName} on {fmtDateTime(a.registeredAt)}
                  </p>
                  {a.status === "cancelled" && a.cancelledAt && (
                    <p className="text-sm text-red-700">
                      Cancelled by {a.cancelledByName} on {fmtDateTime(a.cancelledAt)}
                      {a.cancelReason ? ` — “${a.cancelReason}”` : ""}
                    </p>
                  )}
                </div>
                {a.status === "cancelled" ? (
                  <Badge tone="red">Cancelled</Badge>
                ) : confirmId === a.id ? (
                  <div className="w-full space-y-2 sm:w-72">
                    <Input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
                    <div className="flex gap-2">
                      <Button variant="danger" disabled={cancel.isPending} onClick={() => cancel.mutate({ regId: a.id, reason })}>
                        Yes, cancel it
                      </Button>
                      <Button variant="secondary" onClick={() => setConfirmId(null)}>Keep</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="secondary" onClick={() => { setConfirmId(a.id); setReason(""); }}>
                    Cancel registration
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
