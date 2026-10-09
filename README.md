# Kenora Workshops

Workshop registration service for a community training centre: staff accounts with three roles, a workshop catalogue, registrations that can never exceed capacity, and a full registration history.

Full stack in one Next.js app (UI + REST API) with PostgreSQL. See [WRITEUP.md](WRITEUP.md) for design decisions and trade-offs.

## Run it locally

Prerequisites: Node 20+, Docker (for PostgreSQL).

```bash
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
npm install
npm run db:up               # starts PostgreSQL on localhost:5433 (waits until healthy)
npm run db:migrate          # applies the Prisma migrations
npm run db:seed             # creates dev accounts + sample workshops
npm run dev                 # http://localhost:3000
```

### Using your own PostgreSQL (without Docker)

Any PostgreSQL 14+ works. Skip `npm run db:up` and set the database up yourself:

1. Create a role and a database:

   ```sql
   -- psql -U postgres -h localhost
   CREATE ROLE kenora WITH LOGIN PASSWORD 'kenora' CREATEDB;
   CREATE DATABASE kenora OWNER kenora;
   ```

   `CREATEDB` is only needed for `npm run db:migrate:dev` (it uses a temporary shadow database).

2. Copy `.env.example` to `.env` if you haven't, and point it at the database. `JWT_SECRET` (at least 32 characters) is also required; the example file has a dev-only value, and `openssl rand -base64 48` makes a proper one. The format is `postgres://USER:PASSWORD@HOST:PORT/DBNAME`. The example file uses port **5433** (the Docker mapping); a normal local install listens on **5432**. URL-encode special characters in the password (`@` becomes `%40`), and add `?sslmode=require` if your host needs SSL.

   ```
   DATABASE_URL=postgres://kenora:kenora@localhost:5432/kenora
   ```

3. Create the tables and sample data, then start the app:

   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

Notes:

- **Use `db:migrate`, not `prisma db push`.** The migration also creates the unique-email index, the one-live-booking-per-attendee index and the `capacity > 0` check, which `db push` would skip.
- To start over, drop and recreate the database, then run `db:migrate` and `db:seed` again. (`npm run db:reset` only works with the Docker setup.)

### Dev-only logins (created by the seed)

| Role    | Email                | Password      |
|---------|----------------------|---------------|
| Admin   | admin@kenora.test    | `Admin123!`   |
| Manager | manager@kenora.test  | `Manager123!` |
| Staff   | staff@kenora.test    | `Staff123!`   |

There is no public signup. The Admin creates every other account from **Staff accounts**.

### Sample data

Six workshops across three locations, including a **full** one (FIT-110, 5/5), a **nearly full** one (POT-101, 11/12), a half-full one, a draft, and a completed one, plus one cancelled registration so the history view has something to show.

## What each role can do

| Action                                   | Admin | Manager | Staff |
|------------------------------------------|:-----:|:-------:|:-----:|
| Create user accounts & set roles         |  yes  |    -    |   -   |
| Add & edit workshops                     |   -   |   yes   |   -   |
| Register & cancel attendees              |   -   |   yes   |  yes  |
| View workshops, registrations & history  |   -   |   yes   |  yes  |

Enforced in the API (401 when signed out, 403 for the wrong role); the UI merely hides what you can't use. Bonus: Admin and Manager can view the **Activity log** (audit trail).

## Useful scripts

| Script              | Purpose                                              |
|---------------------|------------------------------------------------------|
| `npm run db:reset`  | Wipe the dev database, re-migrate and re-seed        |
| `npm run db:migrate:dev -- --name <change>` | Create + apply a migration after editing `prisma/schema.prisma` |
| `npm run db:generate` | Regenerate the Prisma client (also runs on `npm install`) |
| `npm run typecheck` | TypeScript check                                     |
| `npm run build`     | Production build                                     |

## API summary

| Method & path                                         | Who                | Notes |
|-------------------------------------------------------|----------------------------------------------|----------------------|
| `POST /api/auth/login`, `/logout`; `GET /api/auth/me` | any                                          | JWT in an httpOnly cookie |
| `GET/POST /api/users`, `PATCH /api/users/:id`         | admin                                        | roles, deactivate, reset password |
| `GET /api/workshops`                                  | manager, staff                               | filters: `from`, `to`, `status`, `hasSeats=true\|false`, `q`, `page`, `pageSize` |
| `POST /api/workshops`, `PATCH /api/workshops/:id`     | manager                                      | |
| `GET /api/workshops/:id`                              | manager, staff                               | includes `seatsTaken` / `seatsAvailable` |
| `GET/POST /api/workshops/:id/registrations`           | view: manager, staff; create: manager, staff | `?includeCancelled=true` for full history |
| `POST /api/registrations/:id/cancel`                  | manager, staff                               | frees the seat, keeps the record |
| `GET /api/audit`                                      | admin, manager                               | audit trail |

Errors are JSON: `{ "error": { "code": "WORKSHOP_FULL", "message": "..." } }`.
