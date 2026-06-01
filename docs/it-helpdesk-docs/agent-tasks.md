# Agent Tasks - IT Helpdesk App

## Jak uzywac

Kazdy task powinien byc przekazywany agentowi AI jako zamknieta jednostka. Agent powinien najpierw zrozumiec acceptance criteria, potem implementowac, a na koncu uruchomic walidacje.

## Template taska

```text
Task: <nazwa taska>

Context:
<krotki opis projektu i aktualnego stanu>

Goal:
<jednoznaczny cel>

Acceptance criteria:
- ...
- ...

Files likely involved:
- ...

Validation:
- npm run lint
- npm run typecheck
- npm run test

Notes:
- ...
```

## Task 1 - Initialize project

```text
Task: Initialize Next.js project

Context:
We are building an internal IT helpdesk app for Bagietka stores and office users.

Goal:
Create a Next.js App Router project with TypeScript, Tailwind CSS and shadcn/ui.

Acceptance criteria:
- App runs locally.
- TypeScript is enabled.
- Tailwind CSS is configured.
- shadcn/ui is installed.
- Basic layout exists.
- Dark mode is available.
- Lint and typecheck scripts exist.

Validation:
- npm run dev
- npm run lint
- npm run typecheck
```

## Task 2 - Add Prisma and initial schema

```text
Task: Add Prisma and initial database schema

Context:
The app uses PostgreSQL and Prisma.

Goal:
Add Prisma schema for users, stores, categories, tickets, comments and events.

Acceptance criteria:
- Prisma is installed and configured.
- DATABASE_URL is read from env.
- Initial migration works.
- Seed creates admin user, agent user, reporter user, one store and default categories.
- Enums exist for roles, ticket statuses, priorities and comment visibility.

Validation:
- npx prisma migrate dev
- npx prisma db seed
- npm run typecheck
```

## Task 3 - Restrict auth to bagietka.pl domain

```text
Task: Restrict authentication to bagietka.pl email addresses

Context:
Only Bagietka employees should access the application.

Goal:
Prevent users from signing in or registering with any email outside the exact bagietka.pl domain.

Acceptance criteria:
- Email is trimmed and lowercased before validation.
- user@bagietka.pl is allowed.
- USER@BAGIETKA.PL is allowed after normalization.
- user@gmail.com is rejected.
- user@bagietka.com is rejected.
- user@bagietka.pl.evil.com is rejected.
- user@it.bagietka.pl is rejected by default.
- Restriction is enforced server-side.
- Rejected users see a clear error message.
- Tests cover allowed and rejected domains.

Files likely involved:
- lib/auth.ts
- lib/email-domain.ts
- app/(auth)/login/page.tsx
- tests/unit/email-domain.test.ts

Validation:
- npm run test
- npm run lint
- npm run typecheck
```

## Task 4 - Add permission helper

```text
Task: Add role-based permission helper

Context:
The app has roles REPORTER, STORE_MANAGER, AGENT and ADMIN.

Goal:
Create a centralized permission helper used by pages and actions.

Acceptance criteria:
- REPORTER can create tickets and view own tickets.
- STORE_MANAGER can view tickets for own store.
- AGENT can view and update all tickets.
- ADMIN can manage users, stores, categories and knowledge base.
- Permission logic is covered by unit tests.

Files likely involved:
- lib/permissions.ts
- tests/unit/permissions.test.ts

Validation:
- npm run test
- npm run typecheck
```

## Task 5 - Create ticket flow

```text
Task: Implement new ticket form

Context:
Users need to submit IT issues from stores and office.

Goal:
Allow authenticated users to create a ticket.

Acceptance criteria:
- User can select category.
- User can enter title and description.
- User can indicate whether issue blocks work or sales.
- Store is prefilled for store users when available.
- Created ticket has status NEW.
- Created ticket gets number IT-YYYY-NNNN.
- Ticket creation writes TICKET_CREATED event.
- User is redirected to ticket details after submit.
- Form validates required fields.

Files likely involved:
- app/(portal)/tickets/new/page.tsx
- components/tickets/new-ticket-form.tsx
- lib/tickets.ts
- lib/validators.ts

Validation:
- npm run lint
- npm run typecheck
- npm run test
```

## Task 6 - My tickets list

```text
Task: Implement my tickets page

Context:
Reporters need to track their submitted tickets.

Goal:
Show a list of tickets visible to the current user.

Acceptance criteria:
- REPORTER sees only own tickets.
- STORE_MANAGER sees tickets from own store.
- List shows number, title, status, priority, created date and updated date.
- User can filter by status.
- Default sort is latest updated first.
- Layout works on mobile.

Files likely involved:
- app/(portal)/tickets/page.tsx
- components/tickets/ticket-list.tsx
- lib/tickets.ts

Validation:
- npm run lint
- npm run typecheck
```

## Task 7 - Admin queue

```text
Task: Implement IT ticket queue

Context:
IT agents and admins need to manage all tickets.

Goal:
Create admin queue with filters and ticket table.

Acceptance criteria:
- AGENT and ADMIN can access /admin/tickets.
- REPORTER cannot access /admin/tickets.
- Queue shows all tickets.
- Columns: number, title, status, priority, store/department, category, assignee, updated date.
- Filters: status, priority, category, assignee.
- Filter state is reflected in URL query params.

Files likely involved:
- app/admin/tickets/page.tsx
- components/admin/ticket-queue.tsx
- lib/tickets.ts
- lib/permissions.ts

Validation:
- npm run lint
- npm run typecheck
- npm run test
```

## Task 8 - Ticket status change

```text
Task: Add ticket status change action

Context:
Agents and admins need to update ticket lifecycle.

Goal:
Allow AGENT and ADMIN users to change ticket status from ticket detail page.

Acceptance criteria:
- Reporter cannot change status.
- Agent/Admin can change status.
- Status change creates ticket_events row.
- Status change updates ticket updated_at.
- Public status change sends notification email to reporter.
- UI shows success/error toast.
- Unit tests cover permission rules.

Files likely involved:
- app/admin/tickets/[id]/page.tsx
- components/tickets/status-select.tsx
- lib/permissions.ts
- lib/tickets.ts
- lib/email.ts

Validation:
- npm run lint
- npm run typecheck
- npm run test
```

## Task 9 - Comments

```text
Task: Add public and internal ticket comments

Context:
Ticket communication requires comments visible to users and internal notes visible only to IT.

Goal:
Implement comments with visibility PUBLIC or INTERNAL.

Acceptance criteria:
- Reporter can add PUBLIC comments to visible tickets.
- Agent/Admin can add PUBLIC comments.
- Agent/Admin can add INTERNAL comments.
- Reporter never sees INTERNAL comments.
- Comment creation writes ticket event.
- PUBLIC comment sends email notification to the other side.

Files likely involved:
- components/tickets/comment-thread.tsx
- components/tickets/comment-form.tsx
- lib/comments.ts
- lib/email.ts
- lib/permissions.ts

Validation:
- npm run lint
- npm run typecheck
- npm run test
```

## Task 10 - Knowledge base MVP

```text
Task: Implement knowledge base MVP

Context:
FAQ should reduce repetitive IT tickets.

Goal:
Create public knowledge base and admin CRUD for articles.

Acceptance criteria:
- Published articles are visible to authenticated users.
- Users can search articles.
- Articles can be assigned to categories.
- ADMIN can create, edit, publish and unpublish articles.
- Non-admin users cannot manage articles.

Files likely involved:
- app/(portal)/knowledge/page.tsx
- app/(portal)/knowledge/[slug]/page.tsx
- app/admin/knowledge/page.tsx
- components/knowledge/*
- lib/knowledge.ts

Validation:
- npm run lint
- npm run typecheck
- npm run test
```
