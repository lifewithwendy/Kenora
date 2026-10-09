# Workshop Registration Service: write-up

## What I built and why I chose this stack

It's a single Next.js app (App Router, TypeScript) that serves both the UI and a REST API, backed by PostgreSQL through Prisma. I wanted one repo and one thing to deploy, and it let me share types and validation between the frontend and the backend.

The whole brief hinges on one rule, that a workshop can never hold more people than it has seats, and that's a concurrency problem. Postgres gives me row locks, so I let the database enforce it instead of trying to be clever in application code. I put every change behind plain API routes rather than Server Actions, so the permission checks sit in one obvious place and I could poke at them over HTTP.

Other choices, briefly:

- **Login:** I wrote it myself (bcrypt, a random token in an httpOnly cookie, and the hashed token stored in a `sessions` table). There's no public signup and only three roles, so a full auth library felt like overkill. Keeping sessions in the database also means deactivating someone or changing their role takes effect straight away.
- **Validation:** Zod on every request body and query string.
- **UI:** React, TanStack Query and Tailwind. I kept it deliberately plain, with big buttons and plain-English error messages, since the team isn't technical.

## How I stop over-registration

When someone registers an attendee, the server opens a transaction and locks that workshop's row (`SELECT … FOR UPDATE`). It then counts the active registrations and only inserts if there's still room. If two people go for the last seat at the same moment, one waits for the other to finish, sees the seat is gone, and gets a clear "workshop is full" error (HTTP 409). Different workshops don't block each other.

Cancelling and editing a workshop's capacity take the same lock, always in the same order, so they can't sneak past a booking or deadlock with one.

I never store a "seats left" number, because it could drift out of sync. It's always counted from the registrations. A unique index also stops the same email address holding two live bookings for one workshop.

To check it for real, I started the built app and fired 30 requests at the last seat of a workshop at the same time. Exactly one got through and the other 29 were refused.

## Access control

Every API route has to declare who may call it, because the wrapper function won't accept a handler without that. All the role rules live in one small map that mirrors the table in the brief. Authentication runs before anything else, including reading the request body.

Hiding a button in the UI is only a convenience. The real checks are on the server, and anything not allowed gets a 401 (not signed in) or a 403 (wrong role). The `proxy.ts` file only redirects signed-out visitors to the login page; I don't treat it as security.

A few extra safeguards: the last active Admin can't be demoted or deactivated, and changing someone's role, deactivating them or resetting their password signs them out everywhere.

## Registrations and history

Cancelling never deletes anything. The registration is marked cancelled, along with who did it, when, and an optional reason. Each registration also records who created it and when. The workshop page has a "Show cancelled & history" switch that lists everything, so nobody has to wonder who dropped a seat.

## Finding workshops

Staff can filter by date range, status, and whether seats are still available, and search by title, code or instructor. The filters live in the URL, so a filtered view can be bookmarked or shared. There's also a one-click button for "open workshops with seats in the next 7 days", which is the exact question the front desk asked.

## Things I added

Beyond the fields in their spreadsheet I added a location (they have three sites), a description, an end time, a draft status and a cancellation reason. I also built the audit trail from the bonus list. Account and role changes, workshop edits and registrations or cancellations are logged with who, what, before and after, and when, in the same transaction as the change itself. Admins and Managers can read the log.

## Assumptions

- Admins only manage accounts. As in the brief's table, they can't register attendees or view workshops.
- Only workshops marked "open" accept registrations. "Full" isn't a status, it's worked out from the numbers.
- One live booking per person per workshop, matched on email regardless of capitalisation.
- Times are stored in UTC and shown in the browser's time zone.
- A workshop's capacity can't be lowered below the number of people already registered.

## Trade-offs

- Locking per workshop means bookings for one workshop go through one at a time. For a team of about 15 that's fine, and it keeps the code simple and easy to trust.
- Login is basic: no password-reset emails, rate limiting or two-factor. An Admin resets passwords.
- I used simple page-by-page pagination and kept the styling light rather than polished.
- There's no support for recurring workshops.

## What I skipped

- The waitlist bonus. The database has a "waitlisted" status set aside for it, but nothing uses it yet. Promoting the next person would fit naturally into the existing cancel transaction.
- Login rate limiting or lockout, letting people change their own password, and CSRF tokens. The cookie is `SameSite=Lax` and the API only accepts JSON, which covers most of the risk.
- Automated tests.
- A live deployment.
