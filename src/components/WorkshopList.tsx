"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { api, fmtDateTime, type WorkshopRow } from "@/lib/client/api";

interface ListResult {
  items: WorkshopRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

const startOfDay = (d: string) => new Date(`${d}T00:00:00`).toISOString();
const endOfDay = (d: string) => new Date(`${d}T23:59:59.999`).toISOString();
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function SeatsBadge({ w }: { w: Pick<WorkshopRow, "seatsTaken" | "capacity" | "seatsAvailable"> }) {
  const label = `${w.seatsTaken}/${w.capacity} taken`;
  if (w.seatsAvailable === 0) return <Badge tone="red">Full · {label}</Badge>;
  if (w.seatsAvailable <= Math.max(2, Math.ceil(w.capacity * 0.2))) {
    return <Badge tone="amber">{w.seatsAvailable} left · {label}</Badge>;
  }
  return <Badge tone="green">{w.seatsAvailable} left · {label}</Badge>;
}

export function StatusBadge({ status }: { status: WorkshopRow["status"] }) {
  const tone = { open: "blue", draft: "slate", cancelled: "red", completed: "slate" } as const;
  return <Badge tone={tone[status]}>{status[0].toUpperCase() + status.slice(1)}</Badge>;
}

export function WorkshopList({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters = {
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    status: params.get("status") ?? "",
    hasSeats: params.get("hasSeats") ?? "",
    q: params.get("q") ?? "",
    page: Number(params.get("page") ?? 1) || 1,
  };

  function setFilters(patch: Partial<typeof filters>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries({ page: 1, ...patch })) {
      if (v === "" || v === undefined || (k === "page" && v === 1)) next.delete(k);
      else next.set(k, String(v));
    }
    router.replace(`${pathname}?${next}`);
  }

  const query = useQuery({
    queryKey: ["workshops", filters],
    placeholderData: keepPreviousData,
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(filters.page), pageSize: String(PAGE_SIZE) });
      if (filters.from) qs.set("from", startOfDay(filters.from));
      if (filters.to) qs.set("to", endOfDay(filters.to));
      if (filters.status) qs.set("status", filters.status);
      if (filters.hasSeats) qs.set("hasSeats", filters.hasSeats);
      if (filters.q) qs.set("q", filters.q);
      return api<ListResult>(`/workshops?${qs}`);
    },
  });

  function thisWeek() {
    const now = new Date();
    const end = new Date(now);
    end.setDate(now.getDate() + 7);
    setFilters({ from: ymd(now), to: ymd(end), hasSeats: "true", status: "open" });
  }

  const anyFilter = filters.from || filters.to || filters.status || filters.hasSeats || filters.q;
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Workshops</h1>
        {canManage && (
          <Link href="/workshops/new">
            <Button>+ New workshop</Button>
          </Link>
        )}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={thisWeek}>
            Open with seats in the next 7 days
          </Button>
          {anyFilter && (
            <Button variant="secondary" onClick={() => router.replace(pathname)}>
              Clear filters
            </Button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="From date">
            <Input type="date" value={filters.from} onChange={(e) => setFilters({ from: e.target.value })} />
          </Field>
          <Field label="To date">
            <Input type="date" value={filters.to} onChange={(e) => setFilters({ to: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select value={filters.status} onChange={(e) => setFilters({ status: e.target.value })}>
              <option value="">Any</option>
              <option value="open">Open</option>
              <option value="draft">Draft</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
          <Field label="Seats">
            <Select value={filters.hasSeats} onChange={(e) => setFilters({ hasSeats: e.target.value })}>
              <option value="">Any</option>
              <option value="true">Seats still available</option>
              <option value="false">Full</option>
            </Select>
          </Field>
          <Field label="Search">
            <Input
              placeholder="Title, code or instructor"
              defaultValue={filters.q}
              onChange={(e) => {
                const v = e.target.value;
                clearTimeout((window as unknown as { __qt?: number }).__qt);
                (window as unknown as { __qt?: number }).__qt = window.setTimeout(() => setFilters({ q: v }), 300);
              }}
            />
          </Field>
        </div>
      </Card>

      {query.isError && <Alert>{(query.error as Error).message}</Alert>}
      {query.isPending && <p className="text-slate-600">Loading workshops…</p>}

      {data && data.items.length === 0 && (
        <Card>
          <p className="text-slate-700">No workshops match these filters.</p>
        </Card>
      )}

      <ul className="space-y-3">
        {data?.items.map((w) => (
          <li key={w.id}>
            <Link href={`/workshops/${w.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-400">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-900">
                    {w.title} <span className="text-sm font-normal text-slate-500">{w.code}</span>
                  </p>
                  <p className="text-slate-700">
                    {fmtDateTime(w.startsAt)} · {w.instructor}
                    {w.locationName ? ` · ${w.locationName}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={w.status} />
                  <SeatsBadge w={w} />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="secondary" disabled={filters.page <= 1} onClick={() => setFilters({ page: filters.page - 1 })}>
            Previous
          </Button>
          <span className="text-slate-700">
            Page {filters.page} of {pages}
          </span>
          <Button variant="secondary" disabled={filters.page >= pages} onClick={() => setFilters({ page: filters.page + 1 })}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
