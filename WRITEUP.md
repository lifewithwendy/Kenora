# Workshop Registration Service: write-up

## Stack and why
- **Next.js (App Router) + TypeScript**: one repo and one deployable for UI and API; shared types and validation. All mutations go through explicit REST route handlers (not Server Actions) so access control and concurrency can be tested over plain HTTP.
- **PostgreSQL + Prisma ORM**: the headline rule is a concurrency rule, and Postgres row locks make it provable. Prisma gives a typed client and migrations; the few things it can't express are written as raw SQL on purpose: the `SELECT ... FOR UPDATE` row lock, the derived seat counts in the workshop search, and three constraints appended to the init migration (case-insensitive unique email, the partial unique index on live bookings, and `capacity > 0`).
- **Own session auth** (bcrypt, random token in an httpOnly cookie, hashed token stored in a `sessions` table). With no public signup and three roles, a library adds little; DB sessions mean deactivating a user or changing their role takes effect immediately.
- **Zod** validates every request body/query; **React + TanStack Query + Tailwind** for the UI, kept deliberately plain (large targets, plain-language errors) for a non-technical team.

## How over-registration is prevented
`registerAttendee` runs in one transaction: it locks the workshop row (`SELECT ... FOR UPDATE`), counts *active* registrations, and inserts only if `count < capacity`. Concurrent requests for the same workshop queue behind the lock, so each counts seats after the previous one committed; the loser gets `409 WORKSHOP_FULL`. Different workshops don't block each other. Cancel and capacity edits take the same lock, in the same order (workshop first), so they can't race with bookings or deadlock.
Seat counts are always derived (`count` of active rows), never a stored counter that can drift. A partial unique index also stops the same email holding two live bookings for one workshop.
Verified by tests (50 simultaneous requests for 5 seats, three rounds -> exactly 5 succeed) and by firing 30 parallel HTTP requests at the last seat of a running server (1x `201`, 29x `409`).

## Access control
Every route is wrapped by `route({ access, ... })`; `access` is a required argument, so a handler cannot be written without declaring who may call it. A single permission map (`PERMISSIONS`) mirrors the client's matrix. Auth runs before the body is parsed. The proxy (`proxy.ts`) is only an optimistic redirect for signed-out page visits, never a security boundary; server layouts and API guards do the real checks. A table-driven test runs every endpoint as every role and anonymous. Extras: last active Admin can't be demoted/deactivated; role changes, deactivation and password resets revoke that user's sessions.

## Registrations and history
Cancelling sets `status='cancelled'` plus `cancelled_by/at/reason`; rows are never deleted. Every registration records who registered it and when. `GET .../registrations?includeCancelled=true` returns the full history, shown in the UI via "Show cancelled & history".

## Finding workshops
`GET /api/workshops` filters by date range, status, and seats (`hasSeats=true|false`), plus text search over title/code/instructor, with pagination. The UI keeps filters in the URL (shareable, survives refresh) and has a one-click "open with seats in the next 7 days".

## Additions beyond the spreadsheet fields
Location (they have three sites), description, end time, `draft` status, and a cancellation reason. **Audit trail (bonus)** is implemented for account/role changes, workshop edits and registration create/cancel (who, what, before/after, when), written in the same transaction as the change; Admin and Manager can read it.

## Assumptions
- Admin manages accounts only and cannot register attendees or view workshops, exactly as the matrix states.
- Only `open` workshops accept registrations; "full" is derived, not a status.
- An attendee (matched by email, case-insensitive) can hold one live booking per workshop.
- Times are stored in UTC and shown in the browser's timezone.
- Capacity can't be edited below the number of active registrations.

## Trade-offs
- Per-workshop locking serializes bookings for *one* workshop. For a centre with ~15 staff this is a non-issue and buys simple, obviously-correct code.
- Simple bcrypt-password login: no email reset, rate limiting or MFA (Admin resets passwords).
- Offset pagination and a lightly styled UI over polish.
- Workshop dates are compared as instants; no recurring-workshop support.

## Skipped
- **Waitlist (bonus)**: not built. The schema reserves a `waitlisted` status, but nothing uses it yet; promotion would slot into the existing locked cancel transaction.
- Login rate limiting / lockout, password change by the user themselves, CSRF tokens (mitigated by `SameSite=Lax` and JSON-only bodies), and browser end-to-end tests: the UI was type-checked and built, and its API was exercised over HTTP, but is not covered by automated browser tests.
- Live deployment.
