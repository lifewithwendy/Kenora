export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
      // Session expired: full reload so all cached client state is dropped.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    }
    throw new ApiError(res.status, data?.error?.code ?? "ERROR", data?.error?.message ?? "Something went wrong.");
  }
  return data as T;
}

export type WorkshopStatus = "draft" | "open" | "cancelled" | "completed";

export interface WorkshopRow {
  id: number;
  code: string;
  title: string;
  instructor: string;
  description: string;
  locationId: number | null;
  locationName: string | null;
  startsAt: string;
  endsAt: string | null;
  capacity: number;
  status: WorkshopStatus;
  seatsTaken: number;
  seatsAvailable: number;
  waitlisted: number;
}

export interface Attendee {
  id: number;
  attendeeName: string;
  attendeeEmail: string;
  status: "active" | "waitlisted" | "cancelled";
  registeredAt: string;
  registeredByName: string;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelReason: string | null;
}

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** ISO string -> value for <input type="datetime-local"> in the browser's timezone. */
export const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
