import { z } from "zod";

const trimmed = (max = 200) => z.string().trim().min(1, "Required").max(max);
const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password") });

export const roleSchema = z.enum(["admin", "manager", "staff"]);

export const createUserSchema = z.object({
  name: trimmed(100),
  email,
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  role: roleSchema,
});

export const updateUserSchema = z
  .object({
    name: trimmed(100).optional(),
    role: roleSchema.optional(),
    active: z.boolean().optional(),
    password: z.string().min(8, "Password must be at least 8 characters").max(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

const isoDate = z.string().datetime({ offset: true, message: "Use a valid date and time" });

export const workshopStatusSchema = z.enum(["draft", "open", "cancelled", "completed"]);

const workshopBase = z.object({
  code: trimmed(30).transform((s) => s.toUpperCase()),
  title: trimmed(150),
  instructor: trimmed(100),
  description: z.string().trim().max(2000).default(""),
  locationId: z.number().int().positive().nullable().optional(),
  startsAt: isoDate,
  endsAt: isoDate.nullable().optional(),
  capacity: z.number().int("Capacity must be a whole number").min(1).max(1000),
  status: workshopStatusSchema.default("open"),
});

const endsAfterStarts = (v: { startsAt?: string; endsAt?: string | null }) =>
  !v.startsAt || !v.endsAt || new Date(v.endsAt) > new Date(v.startsAt);

export const createWorkshopSchema = workshopBase.refine(endsAfterStarts, {
  message: "End time must be after the start time",
  path: ["endsAt"],
});

export const updateWorkshopSchema = workshopBase
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update")
  .refine(endsAfterStarts, { message: "End time must be after the start time", path: ["endsAt"] });

export const registerSchema = z.object({ attendeeName: trimmed(100), attendeeEmail: email });

export const cancelSchema = z.object({ reason: z.string().trim().max(500).optional() });

export const workshopQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: workshopStatusSchema.optional(),
  hasSeats: z.enum(["true", "false"]).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
