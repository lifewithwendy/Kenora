"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { api, toLocalInput, type WorkshopRow } from "@/lib/client/api";

export function WorkshopForm({ workshop }: { workshop?: WorkshopRow }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const locations = useQuery({ queryKey: ["locations"], queryFn: () => api<{ items: { id: number; name: string }[] }>("/locations") });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      workshop
        ? api<WorkshopRow>(`/workshops/${workshop.id}`, { method: "PATCH", body })
        : api<{ id: number }>("/workshops", { method: "POST", body }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["workshops"] });
      qc.invalidateQueries({ queryKey: ["workshop"] });
      router.push(`/workshops/${workshop ? workshop.id : res.id}`);
    },
    onError: (e) => setError((e as Error).message),
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const toIso = (v: FormDataEntryValue | null) => (v ? new Date(String(v)).toISOString() : null);
    const loc = String(f.get("locationId") ?? "");
    save.mutate({
      code: String(f.get("code")),
      title: String(f.get("title")),
      instructor: String(f.get("instructor")),
      description: String(f.get("description") ?? ""),
      locationId: loc ? Number(loc) : null,
      startsAt: toIso(f.get("startsAt")),
      endsAt: toIso(f.get("endsAt")),
      capacity: Number(f.get("capacity")),
      status: String(f.get("status")),
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={workshop ? `/workshops/${workshop.id}` : "/workshops"} className="text-indigo-700 hover:underline">
        ← Back
      </Link>
      <Card>
        <h1 className="mb-4 text-2xl font-bold">{workshop ? "Edit workshop" : "New workshop"}</h1>
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
            <Field label="Workshop code" hint="Short and unique, e.g. POT-101">
              <Input name="code" required maxLength={30} defaultValue={workshop?.code} />
            </Field>
            <Field label="Title"><Input name="title" required maxLength={150} defaultValue={workshop?.title} /></Field>
          </div>
          <Field label="Instructor"><Input name="instructor" required maxLength={100} defaultValue={workshop?.instructor} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts"><Input name="startsAt" type="datetime-local" required defaultValue={toLocalInput(workshop?.startsAt)} /></Field>
            <Field label="Ends (optional)"><Input name="endsAt" type="datetime-local" defaultValue={toLocalInput(workshop?.endsAt)} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Seats (capacity)"
              hint={workshop && workshop.seatsTaken > 0 ? `Can't go below ${workshop.seatsTaken} (already registered).` : undefined}
            >
              <Input name="capacity" type="number" min={Math.max(1, workshop?.seatsTaken ?? 1)} max={1000} required defaultValue={workshop?.capacity ?? 10} />
            </Field>
            <Field label="Location">
              <Select name="locationId" defaultValue={workshop?.locationId ?? ""}>
                <option value="">—</option>
                {locations.data?.items.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </Field>
            <Field label="Status" hint="Only “Open” workshops take registrations.">
              <Select name="status" defaultValue={workshop?.status ?? "open"}>
                <option value="draft">Draft</option>
                <option value="open">Open</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </Field>
          </div>
          <Field label="Description (optional)">
            <Textarea name="description" rows={3} maxLength={2000} defaultValue={workshop?.description} />
          </Field>
          <div className="flex gap-3">
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save workshop"}</Button>
            <Link href={workshop ? `/workshops/${workshop.id}` : "/workshops"}><Button type="button" variant="secondary">Cancel</Button></Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
