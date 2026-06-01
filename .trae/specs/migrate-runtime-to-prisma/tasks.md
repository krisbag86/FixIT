# Tasks
- [x] Task 1: Define Prisma runtime boundaries
  - [x] Confirm which functions in `lib/data-store.ts` are runtime-critical (used by server actions and pages)
  - [x] Decision: replace `readDatabase()` call sites with dedicated query helpers (do not preserve `Database`-shaped API for Prisma runtime)
  - [x] Validation: list of functions to migrate with call sites
  - Runtime-critical exports (boundary surface): `createOrFindUser`, `findUserById`, `listVisibleTickets`, `findTicket`, `listComments`, `listEvents`, `createTicket`, `updateTicket`, `addComment`, `updateNotificationLog`, `readDatabase` (to be removed from call sites)
  - Call sites:
    - `createOrFindUser`: `app/login/actions.ts`
    - `findUserById`: `lib/auth.ts`
    - `readDatabase`: `app/actions.ts`, `app/tickets/new/page.tsx`, `app/tickets/page.tsx`, `app/tickets/[id]/page.tsx`, `app/admin/tickets/page.tsx`, `app/admin/tickets/[id]/page.tsx`
    - `listVisibleTickets`: `app/tickets/page.tsx`, `app/admin/tickets/page.tsx`
    - `findTicket`: `app/actions.ts`, `app/tickets/[id]/page.tsx`, `app/admin/tickets/[id]/page.tsx`
    - `listComments`: `app/tickets/[id]/page.tsx`, `app/admin/tickets/[id]/page.tsx`
    - `listEvents`: `app/tickets/[id]/page.tsx`, `app/admin/tickets/[id]/page.tsx`
    - `createTicket`: `app/actions.ts`
    - `updateTicket`: `app/actions.ts`
    - `addComment`: `app/actions.ts`
    - `updateNotificationLog`: `app/actions.ts`

- [x] Task 2: Align Prisma schema with runtime NotificationLog + ticket events
  - [x] Update `prisma/schema.prisma`:
    - [x] `NotificationLog.status` to a constrained type (enum or validated string set)
    - [x] Add `NotificationLog.sentAt` (nullable) for delivery timestamp
  - [x] Create Prisma migration
  - [x] Validation: Prisma schema validates; `prisma migrate deploy` invocation verified (docker not available here)

- [x] Task 3: Add Prisma Client runtime utilities
  - [x] Add a Prisma client singleton (`lib/prisma.ts` or equivalent pattern in repo)
  - [x] Ensure it works in Next.js server runtime without creating too many connections
  - [x] Validation: `npm run typecheck` and basic Prisma query works in a minimal test

- [ ] Task 4: Implement PostgreSQL-backed reads (non-mutating)
  - [ ] Implement read equivalents for:
    - [ ] users/stores/categories lists used in UI and auth flows
    - [ ] visible ticket listing (preserve current visibility rules)
    - [ ] ticket details + comments + event timeline
  - [ ] Validation: existing unit tests still pass; manual smoke check pages load

- [ ] Task 5: Implement PostgreSQL-backed writes (mutating flows)
  - [ ] Implement create ticket:
    - [ ] Allocate ticket number using `TicketCounter` transaction
    - [ ] Create `TicketEvent` and initial `NotificationLog` entries as today
  - [ ] Implement update ticket:
    - [ ] Persist status/priority/assignee changes + events
    - [ ] Enqueue `NotificationLog` for `TICKET_RESOLVED` and `TICKET_ASSIGNED`
  - [ ] Implement add comment:
    - [ ] Persist comment (PUBLIC/INTERNAL)
    - [ ] Persist event and enqueue `NotificationLog` for `COMMENT_CREATED` (PUBLIC only)
  - [ ] Implement `updateNotificationLog()` for `SENT`/`FAILED` + optional error
  - [ ] Validation: create/update/comment flows work and do not break on email failures

- [ ] Task 6: Update call sites to use Prisma-backed data access
  - [ ] Update server actions and pages that rely on `readDatabase()` shape if needed
  - [ ] Ensure permissions checks still run before mutations and before rendering sensitive data
  - [ ] Validation: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`

- [ ] Task 7: Update seeding + docs for Railway runtime expectations
  - [ ] Ensure `prisma/seed.mjs` still produces a usable dev dataset for e2e/manual checks
  - [ ] Update `docs/it-helpdesk-docs/deployment-railway.md` and/or `remaining-tasks.md` with exact env vars and deploy steps for runtime PostgreSQL
  - [ ] Validation: `npm run db:seed` works and app runs against Postgres with seeded data

# Task Dependencies
- Task 2 depends on Task 1 (boundary decisions affect schema needs).
- Task 4 depends on Task 3.
- Task 5 depends on Task 2 and Task 3.
- Task 6 depends on Tasks 4–5.
- Task 7 depends on Tasks 2–6.
