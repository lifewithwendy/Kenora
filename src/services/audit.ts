import { prisma } from "@/db";
import { Prisma } from "@/generated/prisma/client";

type Client = Prisma.TransactionClient | typeof prisma;

const json = (v: unknown) =>
  v === undefined || v === null ? Prisma.DbNull : (v as Prisma.InputJsonValue);

export async function writeAudit(
  tx: Client,
  entry: {
    actorId: number | null;
    action: string;
    entityType: "user" | "workshop" | "registration";
    entityId: number | null;
    before?: unknown;
    after?: unknown;
  },
) {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: json(entry.before),
      after: json(entry.after),
    },
  });
}

export async function listAudit(limit = 200) {
  const rows = await prisma.auditLog.findMany({
    orderBy: [{ at: "desc" }, { id: "desc" }],
    take: limit,
    include: { actor: { select: { name: true } } },
  });
  return rows.map(({ actor, actorId: _a, ...r }) => ({
    ...r,
    actorName: actor?.name ?? null,
  }));
}
