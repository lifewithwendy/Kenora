import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Cache the client on globalThis so dev hot-reload doesn't leak connections.
const g = globalThis as unknown as { __prisma?: PrismaClient };

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (copy .env.example to .env)");
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, max: 20 }),
    // Bookings for one workshop queue behind a row lock, so allow time to wait for a connection/lock.
    transactionOptions: { maxWait: 15_000, timeout: 30_000 },
  });
}

export const prisma = (g.__prisma ??= connect());
export type { PrismaClient };
