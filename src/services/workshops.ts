import { prisma } from "@/db";
import { Prisma, type WorkshopStatus } from "@/generated/prisma/client";
import { conflict, isUniqueViolation, notFound } from "@/lib/errors";
import { writeAudit } from "./audit";

/** Seats are always derived from live registrations; no stored counter that could drift. */
const seatsTakenSql = Prisma.sql`(SELECT count(*)::int FROM registrations r WHERE r.workshop_id = w.id AND r.status = 'active')`;
const waitlistedSql = Prisma.sql`(SELECT count(*)::int FROM registrations r WHERE r.workshop_id = w.id AND r.status = 'waitlisted')`;

const SELECT_WORKSHOPS = Prisma.sql`
  SELECT w.id, w.code, w.title, w.instructor, w.description,
         w.location_id AS "locationId", l.name AS "locationName",
         w.starts_at AS "startsAt", w.ends_at AS "endsAt", w.capacity, w.status::text AS status,
         ${seatsTakenSql} AS "seatsTaken", ${waitlistedSql} AS "waitlisted"
  FROM workshops w
  LEFT JOIN locations l ON l.id = w.location_id`;

interface WorkshopRowRaw {
  id: number;
  code: string;
  title: string;
  instructor: string;
  description: string;
  locationId: number | null;
  locationName: string | null;
  startsAt: Date;
  endsAt: Date | null;
  capacity: number;
  status: WorkshopStatus;
  seatsTaken: number;
  waitlisted: number;
}

const withAvailability = (w: WorkshopRowRaw) => ({
  ...w,
  seatsAvailable: Math.max(0, w.capacity - w.seatsTaken),
});

export type WorkshopFilters = {
  from?: string;
  to?: string;
  status?: WorkshopStatus;
  hasSeats?: "true" | "false";
  q?: string;
  page: number;
  pageSize: number;
};

export async function listWorkshops(f: WorkshopFilters) {
  const where: Prisma.Sql[] = [];
  if (f.from) where.push(Prisma.sql`w.starts_at >= ${new Date(f.from)}`);
  if (f.to) where.push(Prisma.sql`w.starts_at <= ${new Date(f.to)}`);
  if (f.status) where.push(Prisma.sql`w.status = ${f.status}::workshop_status`);
  if (f.hasSeats === "true")
    where.push(Prisma.sql`${seatsTakenSql} < w.capacity`);
  if (f.hasSeats === "false")
    where.push(Prisma.sql`${seatsTakenSql} >= w.capacity`);
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, "\\$&")}%`;
    where.push(
      Prisma.sql`(w.title ILIKE ${like} OR w.code ILIKE ${like} OR w.instructor ILIKE ${like})`,
    );
  }
  const cond = where.length
    ? Prisma.sql`WHERE ${Prisma.join(where, " AND ")}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    (WorkshopRowRaw & { total: number })[]
  >(Prisma.sql`
    SELECT x.*, count(*) OVER()::int AS total FROM (${SELECT_WORKSHOPS} ${cond}) x
    ORDER BY x."startsAt" ASC, x.id ASC
    LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}`);

  return {
    items: rows.map(({ total: _t, ...w }) => withAvailability(w)),
    total: rows[0]?.total ?? 0,
    page: f.page,
    pageSize: f.pageSize,
  };
}

export async function getWorkshop(id: number) {
  const [w] = await prisma.$queryRaw<WorkshopRowRaw[]>(
    Prisma.sql`${SELECT_WORKSHOPS} WHERE w.id = ${id}`,
  );
  if (!w) throw notFound("Workshop");
  return withAvailability(w);
}

export const listLocations = () =>
  prisma.location.findMany({ orderBy: { name: "asc" } });

type WorkshopInput = {
  code: string;
  title: string;
  instructor: string;
  description: string;
  locationId?: number | null;
  startsAt: string;
  endsAt?: string | null;
  capacity: number;
  status: WorkshopStatus;
};

/** ISO strings -> Dates; leaves absent fields out so a PATCH only touches what was sent. */
const toData = (i: Partial<WorkshopInput>) => ({
  ...i,
  startsAt: i.startsAt ? new Date(i.startsAt) : undefined,
  endsAt:
    i.endsAt === undefined
      ? undefined
      : i.endsAt === null
        ? null
        : new Date(i.endsAt),
});

export async function createWorkshop(actorId: number, input: WorkshopInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const w = await tx.workshop.create({
        data: {
          ...toData(input),
          createdBy: actorId,
        } as Prisma.WorkshopUncheckedCreateInput,
      });
      await writeAudit(tx, {
        actorId,
        action: "workshop.create",
        entityType: "workshop",
        entityId: w.id,
        after: input,
      });
      return w;
    });
  } catch (e) {
    if (isUniqueViolation(e))
      throw conflict(
        "CONFLICT",
        `Workshop code ${input.code} is already used.`,
      );
    throw e;
  }
}

export async function updateWorkshop(
  actorId: number,
  id: number,
  patch: Partial<WorkshopInput>,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      // Same row lock the registration flow takes, so a capacity cut can't race a new booking.
      await tx.$queryRaw`SELECT id FROM workshops WHERE id = ${id} FOR UPDATE`;
      const before = await tx.workshop.findUnique({ where: { id } });
      if (!before) throw notFound("Workshop");

      if (patch.capacity !== undefined) {
        const n = await tx.registration.count({
          where: { workshopId: id, status: "active" },
        });
        if (patch.capacity < n) {
          throw conflict(
            "CONFLICT",
            `${n} people are already registered, so capacity can't go below ${n}. Cancel some registrations first.`,
          );
        }
      }

      const after = await tx.workshop.update({
        where: { id },
        data: toData(patch) as Prisma.WorkshopUncheckedUpdateInput,
      });
      await writeAudit(tx, {
        actorId,
        action: "workshop.update",
        entityType: "workshop",
        entityId: id,
        before: pickChanged(before, patch),
        after: pickChanged(after, patch),
      });
      return after;
    });
  } catch (e) {
    if (isUniqueViolation(e))
      throw conflict("CONFLICT", "That workshop code is already used.");
    throw e;
  }
}

function pickChanged(row: object, patch: object) {
  const r = row as Record<string, unknown>;
  return Object.fromEntries(Object.keys(patch).map((k) => [k, r[k]]));
}

export async function listAttendees(
  workshopId: number,
  includeCancelled: boolean,
) {
  await getWorkshop(workshopId);
  const rows = await prisma.registration.findMany({
    where: {
      workshopId,
      ...(includeCancelled ? {} : { status: { not: "cancelled" } }),
    },
    orderBy: [{ registeredAt: "asc" }, { id: "asc" }],
    include: {
      registrar: { select: { name: true } },
      canceller: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    attendeeName: r.attendeeName,
    attendeeEmail: r.attendeeEmail,
    status: r.status,
    registeredAt: r.registeredAt,
    registeredByName: r.registrar.name,
    cancelledAt: r.cancelledAt,
    cancelledByName: r.canceller?.name ?? null,
    cancelReason: r.cancelReason,
  }));
}
