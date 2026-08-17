# Requester Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `REPORTER` and `STORE_MANAGER` one simple, server-enforced portal for submitting and tracking only their own tickets.

**Architecture:** Add a small requester-portal domain helper for role detection and public status mapping, then use dedicated requester components for cards, progress, the minimal form, and ticket details. Keep the existing IT/admin components and routes for `AGENT` and `ADMIN`, while tightening ticket visibility and mutation handling for requester roles at the permission/data/action boundaries.

**Tech Stack:** Next.js App Router, React server components, server actions, Tailwind CSS, Vitest, Playwright E2E.

## Global Constraints

- `REPORTER` and `STORE_MANAGER` use the same simplified requester portal; do not rename or remove `STORE_MANAGER` in this task.
- `/tickets` shows only active tickets reported by the current user.
- `/tickets/archive` shows only closed or cancelled tickets reported by the current user.
- The requester UI shows public progress and public comments, never internal comments or technical IT data.
- The requester form keeps category, title, description, optional contact, and FAQ; the store comes from the user profile.
- Requester replies are always persisted as `PUBLIC`, regardless of client-submitted visibility values.
- Do not change the IT queue or the `AGENT`/`ADMIN` administration experience.
- Do not stage or modify the unrelated `.freebuff/` directory.

---

### Task 1: Add requester role and public status domain helpers

**Files:**
- Create: `lib/requester-portal.ts`
- Create: `tests/requester-portal.test.ts`

**Interfaces:**
- Consumes: `UserRole` and `TicketStatus` from `lib/types.ts`.
- Produces: `isRequesterPortalUser(user)`, `getPublicTicketStage(status)`, `publicTicketStages`, and `publicTicketStageLabels` for pages, components, and permission tests.

- [ ] **Step 1: Write failing pure tests for requester role detection**

Add:

```ts
it("treats reporter and store manager as requester portal users", () => {
  expect(isRequesterPortalUser({ role: "REPORTER" })).toBe(true);
  expect(isRequesterPortalUser({ role: "STORE_MANAGER" })).toBe(true);
  expect(isRequesterPortalUser({ role: "AGENT" })).toBe(false);
  expect(isRequesterPortalUser({ role: "ADMIN" })).toBe(false);
});
```

- [ ] **Step 2: Write failing pure tests for all public status mappings**

Add one table-driven test covering:

```ts
const cases = [
  ["NEW", "RECEIVED"],
  ["TRIAGED", "RECEIVED"],
  ["IN_PROGRESS", "IN_PROGRESS"],
  ["WAITING_FOR_USER", "WAITING"],
  ["WAITING_FOR_VENDOR", "WAITING"],
  ["RESOLVED", "RESOLVED"],
  ["CLOSED", "CLOSED"],
  ["CANCELLED", "CANCELLED"]
] as const;
```

Assert `getPublicTicketStage(status)` equals the expected stage and that every stage has a non-empty Polish label.

- [ ] **Step 3: Run the pure tests and confirm RED**

Run:

```bash
npm run test -- tests/requester-portal.test.ts
```

Expected: FAIL because `lib/requester-portal.ts` does not exist.

- [ ] **Step 4: Implement the minimal typed helper module**

Define:

```ts
export type PublicTicketStage = "RECEIVED" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED" | "CANCELLED";

export function isRequesterPortalUser(user: Pick<User, "role">): boolean;
export function getPublicTicketStage(status: TicketStatus): PublicTicketStage;
```

Export ordered `publicTicketStages` and labels in the same module; map each internal status exactly as specified in the design document.

- [ ] **Step 5: Run the pure tests and confirm GREEN**

Run:

```bash
npm run test -- tests/requester-portal.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the domain helper**

```bash
git add lib/requester-portal.ts tests/requester-portal.test.ts
git commit -m "feat: add requester portal status model"
```

### Task 2: Enforce own-ticket visibility for requester roles

**Files:**
- Modify: `lib/permissions.ts`
- Modify: `lib/data-store-tickets.ts`
- Modify: `app/store/page.tsx`
- Modify: `tests/permissions.test.ts`
- Modify: `tests/data-store.test.ts`

**Interfaces:**
- Consumes: `isRequesterPortalUser` from `lib/requester-portal.ts`.
- Produces: identical own-ticket visibility in `canViewTicket`, JSON filtering, and Prisma filtering; `STORE_MANAGER` no longer reaches the old store dashboard.

- [ ] **Step 1: Add failing permission tests for store manager isolation**

Extend `tests/permissions.test.ts` with:

```ts
it("limits requester roles to tickets they reported", () => {
  const manager: User = { ...baseUser, id: "manager", role: "STORE_MANAGER", storeId: "store1" };
  const own = { ...baseTicket, reporterId: manager.id, storeId: "store1" };
  const coworker = { ...baseTicket, reporterId: "other", storeId: "store1" };

  expect(canViewTicket(manager, own)).toBe(true);
  expect(canViewTicket(manager, coworker)).toBe(false);
});
```

Add `import type { User } from "@/lib/types";` beside the existing imports, then add this JSON-provider assertion to `tests/data-store.test.ts`:

```ts
it("limits store manager lists to tickets they reported", async () => {
  const { readDatabase, writeDatabase, listVisibleTickets } = await import("@/lib/data-store");
  const database = await readDatabase();
  const manager: User = { id: "manager", name: "Manager", email: "manager@bagietka.pl", role: "STORE_MANAGER", storeId: "store1", isActive: true };
  const otherReporter: User = { ...manager, id: "other", email: "other@bagietka.pl", role: "REPORTER" };
  const baseTicket = {
    id: "ticket-template",
    number: "IT-2026-0001",
    title: "Test ticket",
    description: "Description long enough for a data-store fixture.",
    status: "NEW" as const,
    priority: "NORMAL" as const,
    blocksWork: false,
    contact: "manager@bagietka.pl",
    categoryId: "cat_other",
    storeId: "store1",
    reporterId: manager.id,
    createdAt: "2026-08-17T10:00:00.000Z",
    updatedAt: "2026-08-17T10:00:00.000Z"
  };
  database.users.push(manager, otherReporter);
  database.tickets.push(
    { ...baseTicket, id: "own", reporterId: manager.id },
    { ...baseTicket, id: "coworker", reporterId: otherReporter.id }
  );
  await writeDatabase(database);

  const visible = await listVisibleTickets(manager);
  expect(visible.map((item) => item.id)).toEqual(["own"]);
});
```

- [ ] **Step 2: Run focused permission/data tests and confirm RED**

Run:

```bash
npm run test -- tests/permissions.test.ts tests/data-store.test.ts
```

Expected: the new store-manager isolation assertion fails against the current same-store visibility rule.

- [ ] **Step 3: Narrow permission and data-store visibility at the source**

In `canViewTicket`, return `ticket.reporterId === user.id` for `REPORTER` and `STORE_MANAGER` before the store-wide fallback. In `buildVisibleTicketQuery` and `filterVisibleTickets`, use `{ reporterId: user.id }` for requester roles; retain all-ticket visibility for `AGENT` and `ADMIN`.

Keep the existing store-wide behavior available only to code paths that explicitly remain administrative/agent-facing. Redirect `STORE_MANAGER` from `/store` to `/tickets`; leave `/store` available to `AGENT` and `ADMIN` if they use it for operational inspection.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run:

```bash
npm run test -- tests/permissions.test.ts tests/data-store.test.ts
```

Expected: all existing permission/data tests plus the new isolation assertions pass.

- [ ] **Step 5: Commit requester visibility hardening**

```bash
git add lib/permissions.ts lib/data-store-tickets.ts app/store/page.tsx tests/permissions.test.ts
git commit -m "fix: isolate requester tickets to their reporter"
```

### Task 3: Simplify requester shell, navigation, dashboard, and archive

**Files:**
- Create: `components/requester/requester-ticket-card.tsx`
- Modify: `components/app-nav.tsx`
- Modify: `components/app-shell.tsx`
- Modify: `app/tickets/page.tsx`
- Modify: `app/tickets/archive/page.tsx`
- Create or modify: `tests/e2e/requester-portal.spec.ts`

**Interfaces:**
- Consumes: `Ticket`, `isRequesterPortalUser`, and `getPublicTicketStage`.
- Produces: requester-only navigation and compact ticket cards that expose no technical fields.

- [ ] **Step 1: Add failing E2E assertions for the requester dashboard and navigation**

In `tests/e2e/requester-portal.spec.ts`, log in as `kasjer@bagietka.pl`, open `/tickets`, and assert:

```ts
await expect(page.getByRole("heading", { name: "W czym możemy pomóc?" })).toBeVisible();
await expect(page.getByRole("link", { name: "Zgłoś problem" })).toBeVisible();
await expect(page.getByRole("link", { name: "Mój sklep" })).toHaveCount(0);
await expect(page.getByTestId("requester-ticket-card").first()).toBeVisible();
await expect(page.getByTestId("requester-ticket-card").first()).not.toContainText("Priorytet");
await expect(page.getByTestId("requester-ticket-card").first()).not.toContainText("SLA");
```

Also assert `/tickets/archive` has no filter/search controls and the navigation contains only the four requester links.

- [ ] **Step 2: Run the new E2E test and confirm RED**

Run:

```bash
npm run test:e2e -- tests/e2e/requester-portal.spec.ts
```

Expected: FAIL because the existing dashboard still renders filters, technical ticket cards, and the store dashboard link.

- [ ] **Step 3: Implement the requester ticket card**

Create a server-rendered card that accepts `ticket` and `href`, renders `data-testid="requester-ticket-card"`, and shows only:

```tsx
<span>{ticket.number}</span>
<h2>{ticket.title}</h2>
<PublicTicketProgress status={ticket.status} compact />
<time>{formatDateTime(ticket.updatedAt)}</time>
```

Do not pass users, categories, stores, assignees, or SLA data to this component.

- [ ] **Step 4: Render the simple dashboard and archive**

Remove the requester-facing search/filter form and `TicketCard` usage from `/tickets` and `/tickets/archive`. Keep `getTicketListPageData` scoped by the hardened requester visibility, render the CTA and active cards on `/tickets`, and render the same compact card variant for archive results. Preserve pagination only if the page has more tickets; do not add new filtering UI.

- [ ] **Step 5: Simplify requester navigation and shell chrome**

Use `isRequesterPortalUser` to remove the `Mój sklep` link. Update `AppShell` so requester users see their name, theme control, and logout but not `RoleBadge` or the email block. Keep the existing navigation and shell unchanged for agents and admins.

- [ ] **Step 6: Run focused dashboard E2E and static checks**

Run:

```bash
npm run test:e2e -- tests/e2e/requester-portal.spec.ts
npm run typecheck
npm run lint
```

Expected: the dashboard and archive assertions defined in this task pass.

- [ ] **Step 7: Commit the requester shell and list pages**

```bash
git add components/requester/requester-ticket-card.tsx components/app-nav.tsx components/app-shell.tsx app/tickets/page.tsx app/tickets/archive/page.tsx tests/e2e/requester-portal.spec.ts
git commit -m "feat: add simplified requester dashboard"
```

### Task 4: Build the minimal requester form and harden ticket/comment actions

**Files:**
- Create: `components/requester/requester-ticket-form.tsx`
- Modify: `app/tickets/new/page.tsx`
- Modify: `app/actions.ts`
- Modify: `tests/e2e/helpers.ts`
- Modify: `tests/e2e/requester-portal.spec.ts`
- Create: `tests/requester-actions.test.ts`

**Interfaces:**
- Consumes: `createTicketAction`, `TicketFormFaq`, requester role helper, categories, and published FAQ articles.
- Produces: minimal requester form with hidden idempotency token, server-enforced requester defaults, and public-only requester replies.

- [ ] **Step 1: Add failing E2E form assertions**

After logging in as the reporter and opening `/tickets/new`, assert:

```ts
await expect(page.getByTestId("requester-ticket-form")).toBeVisible();
await expect(page.locator('select[name="categoryId"]')).toBeVisible();
await expect(page.locator('input[name="title"]')).toBeVisible();
await expect(page.locator('textarea[name="description"]')).toBeVisible();
await expect(page.locator('input[name="contact"]')).toBeVisible();
await expect(page.locator("#faq-suggestions")).toBeVisible();
await expect(page.locator('select[name="priority"]')).toHaveCount(0);
await expect(page.locator('select[name="storeId"]')).toHaveCount(0);
await expect(page.locator('input[name="blocksWork"]')).toHaveCount(0);
```

- [ ] **Step 2: Add failing action tests for requester defaults and public replies**

Test the server action with a requester form payload containing forged `priority`, `blocksWork`, another `storeId`, and `visibility: "INTERNAL"`; assert the created ticket uses the reporter’s store/category priority, `blocksWork === false`, and the comment is `PUBLIC`.

- [ ] **Step 3: Run focused tests and confirm RED**

Run:

```bash
npm run test:e2e -- tests/e2e/requester-portal.spec.ts
npm run test -- tests/requester-actions.test.ts
```

Expected: the UI assertions fail against the full form, and the forged action test fails because current actions trust submitted technical fields/visibility for authorized users.

- [ ] **Step 4: Implement the minimal requester form**

Create `RequesterTicketForm` with `data-testid="requester-ticket-form"`, category, title, description, optional contact, the existing `TicketFormFaq`, a hidden generated `submissionId`, and no visible store/priority/department/blocks-work controls. In `/tickets/new`, render this component when `isRequesterPortalUser(user)` is true and retain the current full form branch for `AGENT` and `ADMIN` users so DayLog prefill and IT controls keep their current behavior.

Update `createTicketViaUI` in `tests/e2e/helpers.ts` so it selects `select[name="priority"]` only when that control exists; this keeps existing reporter E2E flows valid after the requester form removes the priority field.

- [ ] **Step 5: Enforce requester defaults in `createTicketAction`**

For `isRequesterPortalUser(user)`, derive:

```ts
const storeId = user.storeId;
const department = user.department;
const priority = category?.defaultPriority ?? "NORMAL";
const blocksWork = false;
```

Ignore submitted requester values for these fields. Keep existing submitted behavior for non-requester users and retain server validation for title, description, category, contact, and idempotency token.

- [ ] **Step 6: Force requester comments to public**

In `addCommentAction`, use:

```ts
const visibility = isRequesterPortalUser(user) ? "PUBLIC" : input.visibility;
```

Keep the existing internal-comment permission check for IT users. Revalidate both requester and admin ticket paths as currently required.

- [ ] **Step 7: Run focused tests and confirm GREEN**

Run:

```bash
npm run test:e2e -- tests/e2e/requester-portal.spec.ts
npm run test -- tests/requester-actions.test.ts
npm run typecheck
npm run lint
```

Expected: minimal form and forged-input/public-reply tests pass.

- [ ] **Step 8: Commit the requester form and action hardening**

```bash
git add components/requester/requester-ticket-form.tsx app/tickets/new/page.tsx app/actions.ts tests/e2e/requester-portal.spec.ts tests/requester-actions.test.ts
git commit -m "feat: simplify requester ticket submission"
```

### Task 5: Add public progress and simplified ticket details

**Files:**
- Create: `components/requester/public-ticket-progress.tsx`
- Create: `components/requester/requester-ticket-detail.tsx`
- Create: `components/requester/requester-reply-form.tsx`
- Modify: `app/tickets/[id]/page.tsx`
- Modify: `tests/requester-portal.test.ts`
- Modify: `tests/e2e/requester-portal.spec.ts`

**Interfaces:**
- Consumes: `PublicTicketStage`, `publicTicketStages`, `getPublicTicketStage`, public comments, ticket data, and `confirmTicketResolutionAction`/`addCommentAction`.
- Produces: `PublicTicketProgress({ status, compact? })`, `RequesterTicketDetail`, and a reply form with no visibility selector or IT templates.

- [ ] **Step 1: Add failing progress unit tests and detail E2E assertions**

Extend pure tests to verify stage ordering and labels. In E2E, open `/tickets/t_001` as the reporter and assert:

```ts
await expect(page.getByTestId("public-ticket-progress")).toContainText("W trakcie");
await expect(page.getByTestId("requester-reply-form")).toBeVisible();
await expect(page.getByTestId("requester-reply-form").locator('select[name="visibility"]')).toHaveCount(0);
await expect(page.getByTestId("requester-ticket-detail")).not.toContainText("Priorytet");
await expect(page.getByTestId("requester-ticket-detail")).not.toContainText("SLA");
await expect(page.getByTestId("requester-ticket-detail")).not.toContainText("Prowadzi");
```

Add a direct-URL test using the manager’s ticket while logged in as the reporter and assert the response is not a visible ticket detail.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```bash
npm run test -- tests/requester-portal.test.ts
npm run test:e2e -- tests/e2e/requester-portal.spec.ts
```

Expected: progress test helpers/components and requester detail selectors are missing; the existing detail still exposes technical fields.

- [ ] **Step 3: Implement the public progress component**

Render the ordered stages with `data-testid="public-ticket-progress"`, an accessible list, a current-stage marker, and a compact mode for cards. Map terminal `CLOSED` and `CANCELLED` states to their own final labels instead of displaying the internal enum.

- [ ] **Step 4: Implement the requester reply form**

Render `data-testid="requester-reply-form"`, hidden `ticketId`, hidden `visibility=PUBLIC`, a short textarea with the existing server validation limits, and one public “Wyślij odpowiedź” button. Do not render templates, macros, visibility controls, assignee data, or internal-note options.

- [ ] **Step 5: Implement requester detail data loading and rendering**

In `/tickets/[id]`, after `canViewTicket` succeeds, branch requester roles to call `listComments(ticket.id, false)` and `findUsersByIds([...comments.map((comment) => comment.authorId)])`, then render `RequesterTicketDetail`. Do not fetch or pass event history, templates, macros, attachments, users for assignees, categories for side metadata, or store data to the requester component. Keep the current `TicketDetail` branch for agents/admins and preserve admin route behavior.

- [ ] **Step 6: Add public reply and resolution E2E coverage**

From the reporter detail page, fill the short reply, submit, and assert the message appears. For the resolution action, create a reporter ticket with `createTicketViaUI`, open its matching `/admin/tickets/[id]` URL in a second logged-in admin page, change its status to `RESOLVED`, save it, return to the reporter page, and assert the confirmation action is visible.

- [ ] **Step 7: Run focused tests and confirm GREEN**

Run:

```bash
npm run test -- tests/requester-portal.test.ts tests/permissions.test.ts
npm run test:e2e -- tests/e2e/requester-portal.spec.ts tests/e2e/security.spec.ts
npm run typecheck
npm run lint
```

Expected: requester progress, isolation, minimal UI, and public reply tests pass while existing security tests remain green.

- [ ] **Step 8: Commit public requester details**

```bash
git add components/requester/public-ticket-progress.tsx components/requester/requester-ticket-detail.tsx components/requester/requester-reply-form.tsx 'app/tickets/[id]/page.tsx' tests/requester-portal.test.ts tests/e2e/requester-portal.spec.ts
git commit -m "feat: add requester ticket progress view"
```

### Task 6: Verify the complete portal and publish it

**Files:**
- Inspect: `docs/superpowers/specs/2026-08-17-requester-portal-design.md`
- Modify: none unless validation exposes a regression

**Interfaces:**
- Consumes: Completed requester role boundaries, UI components, and tests.
- Produces: A green full suite and a pushed `main` branch containing the approved requester portal work.

- [ ] **Step 1: Run the complete unit test suite**

Run:

```bash
TMPDIR=/tmp npm run test
```

Expected: all applicable Vitest tests pass; only pre-existing explicitly skipped tests remain skipped.

- [ ] **Step 2: Run lint, typecheck, and production build sequentially**

Run:

```bash
npm run lint
npm run typecheck
npm run build
```

Expected: each command exits successfully.

- [ ] **Step 3: Run the complete Playwright suite**

Run:

```bash
TMPDIR=/tmp npm run test:e2e
```

Expected: all existing and new requester portal tests pass.

- [ ] **Step 4: Inspect diff and repository status**

Run:

```bash
git diff origin/main...HEAD --check
git diff origin/main...HEAD --stat
git status --short
```

Confirm that only approved requester portal files are included and `.freebuff/` remains untracked and unstaged.

- [ ] **Step 5: Push the validated commits to `main`**

Run:

```bash
git push origin main
```

Expected: `origin/main` advances to the validated local `main` commit.
