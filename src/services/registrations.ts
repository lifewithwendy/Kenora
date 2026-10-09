import { prisma } from "@/db";
import { conflict, isUniqueViolation, notFound } from "@/lib/errors";
import { writeAudit } from "./audit";

/**
 * THE capacity rule: a workshop never holds more active registrations than its capacity.
 *
 * Every registration for a workshop first takes a row lock on that workshop
 * (SELECT ... FOR UPDATE). Concurrent attempts for the same workshop queue up behind the lock,
 * so each one counts seats only after the previous one has committed. Different workshops
 * don't block each other. The count is read inside the same transaction as the insert.
 */
export async function registerAttendee(
  actorId: number,
  workshopId: number,
  input: { attendeeName: string; attendeeEmail: string },
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const [w] = await tx.$queryRaw<
        { id: number; capacity: number; status: string }[]
      >`
        SELECT id, capacity, status::text AS status FROM workshops WHERE id = ${workshopId} FOR UPDATE`;
      if (!w) throw notFound("Workshop");
      if (w.status !== "open") {
        throw conflict(
          "WORKSHOP_NOT_OPEN",
          `This workshop is ${w.status}, so it isn't taking registrations.`,
        );
      }

      const n = await tx.registration.count({
        where: { workshopId, status: "active" },
      });
      if (n >= w.capacity) {
        throw conflict(
          "WORKSHOP_FULL",
          "Sorry, this workshop is full. There are no seats left.",
        );
      }

      const reg = await tx.registration.create({
        data: {
          workshopId,
          attendeeName: input.attendeeName,
          attendeeEmail: input.attendeeEmail,
          status: "active",
          registeredBy: actorId,
        },
      });

      await writeAudit(tx, {
        actorId,
        action: "registration.create",
        entityType: "registration",
        entityId: reg.id,
        after: { workshopId, attendeeEmail: reg.attendeeEmail },
      });
      return { ...reg, seatsTaken: n + 1, capacity: w.capacity };
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw conflict(
        "ALREADY_REGISTERED",
        `${input.attendeeEmail} is already registered for this workshop.`,
      );
    }
    throw e;
  }
}

/** Cancelling frees the seat but never deletes the record. */
export async function cancelRegistration(
  actorId: number,
  registrationId: number,
  reason?: string,
) {
  return prisma.$transaction(async (tx) => {
    const found = await tx.registration.findUnique({
      where: { id: registrationId },
      select: { workshopId: true },
    });
    if (!found) throw notFound("Registration");

    // Same lock order as registerAttendee: workshop first, then the registration.
    await tx.$queryRaw`SELECT id FROM workshops WHERE id = ${found.workshopId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM registrations WHERE id = ${registrationId} FOR UPDATE`;

    const reg = await tx.registration.findUniqueOrThrow({
      where: { id: registrationId },
    });
    if (reg.status === "cancelled") {
      throw conflict(
        "ALREADY_CANCELLED",
        "This registration was already cancelled.",
      );
    }

    const updated = await tx.registration.update({
      where: { id: registrationId },
      data: {
        status: "cancelled",
        cancelledBy: actorId,
        cancelledAt: new Date(),
        cancelReason: reason || null,
      },
    });

    await writeAudit(tx, {
      actorId,
      action: "registration.cancel",
      entityType: "registration",
      entityId: registrationId,
      before: { status: reg.status },
      after: { status: "cancelled", reason: reason || null },
    });
    return updated;
  });
}
