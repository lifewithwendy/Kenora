import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DEV_USERS = [
  {
    name: "Alex Admin",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@kenora.test",
    password: process.env.SEED_ADMIN_PASSWORD ?? "Admin123!",
    role: "admin" as const,
  },
  { name: "Morgan Manager", email: "manager@kenora.test", password: "Manager123!", role: "manager" as const },
  { name: "Sam Staff", email: "staff@kenora.test", password: "Staff123!", role: "staff" as const },
];

const day = 86_400_000;
const at = (daysFromNow: number, hour: number) => {
  const d = new Date(Date.now() + daysFromNow * day);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};

async function main() {
  if ((await prisma.user.count()) > 0) {
    console.log("Database already has users; skipping seed. (Run `npm run db:reset` for a clean slate.)");
    return;
  }

  const created = [];
  for (const u of DEV_USERS) {
    created.push(
      await prisma.user.create({
        data: { name: u.name, email: u.email, role: u.role, passwordHash: await bcrypt.hash(u.password, 10) },
      }),
    );
  }
  const [, manager, staff] = created;

  const locs = [];
  for (const name of ["Downtown Centre", "Lakeside Campus", "Northgate Studio"]) {
    locs.push(await prisma.location.create({ data: { name } }));
  }

  const workshopData = [
    { code: "POT-101", title: "Intro to Pottery", instructor: "Priya Nair", description: "Wheel basics for beginners.", locationId: locs[0].id, startsAt: at(1, 10), endsAt: at(1, 13), capacity: 12, status: "open" as const },
    { code: "COD-201", title: "Web Coding Bootcamp", instructor: "Jonas Weber", description: "HTML, CSS and a first JavaScript project.", locationId: locs[1].id, startsAt: at(2, 9), endsAt: at(2, 16), capacity: 20, status: "open" as const },
    { code: "FIT-110", title: "Saturday Morning Fitness", instructor: "Dana Okafor", description: "High-energy group class.", locationId: locs[2].id, startsAt: at(3, 8), endsAt: at(3, 9), capacity: 5, status: "open" as const },
    { code: "POT-202", title: "Glazing Techniques", instructor: "Priya Nair", description: "Colour and finish for fired pieces.", locationId: locs[0].id, startsAt: at(6, 14), endsAt: at(6, 17), capacity: 8, status: "open" as const },
    { code: "COD-301", title: "Intro to Databases", instructor: "Jonas Weber", description: "SQL fundamentals. Still being planned.", locationId: locs[1].id, startsAt: at(10, 18), capacity: 15, status: "draft" as const },
    { code: "FIT-050", title: "Yoga for Beginners", instructor: "Dana Okafor", description: "Finished last week.", locationId: locs[2].id, startsAt: at(-5, 17), endsAt: at(-5, 18), capacity: 10, status: "completed" as const },
  ];
  const ws = [];
  for (const w of workshopData) ws.push(await prisma.workshop.create({ data: { ...w, createdBy: manager.id } }));

  const byCode = Object.fromEntries(ws.map((w) => [w.code, w]));
  const person = (i: number) => ({ attendeeName: `Guest ${i}`, attendeeEmail: `guest${i}@example.com` });

  // FIT-110: completely full (5/5). POT-101: nearly full (11/12). COD-201: half full.
  const rows = [
    ...Array.from({ length: 5 }, (_, i) => ({ workshopId: byCode["FIT-110"].id, ...person(i + 1) })),
    ...Array.from({ length: 11 }, (_, i) => ({ workshopId: byCode["POT-101"].id, ...person(i + 1) })),
    ...Array.from({ length: 10 }, (_, i) => ({ workshopId: byCode["COD-201"].id, ...person(i + 1) })),
  ].map((r) => ({ ...r, registeredBy: staff.id }));
  await prisma.registration.createMany({ data: rows });

  // A cancelled record so the history view has something to show.
  await prisma.registration.create({
    data: {
      workshopId: byCode["POT-101"].id,
      attendeeName: "Casey Cancelled",
      attendeeEmail: "casey@example.com",
      status: "cancelled",
      registeredBy: staff.id,
      cancelledBy: manager.id,
      cancelledAt: new Date(),
      cancelReason: "Schedule clash",
    },
  });

  console.log(`Seeded ${created.length} users, ${locs.length} locations, ${ws.length} workshops, ${rows.length + 1} registrations.`);
  console.log("Dev logins:");
  for (const u of DEV_USERS) console.log(`  ${u.role.padEnd(8)} ${u.email}  /  ${u.password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
