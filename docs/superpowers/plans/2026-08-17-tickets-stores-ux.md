# Tickets and Stores UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin ticket filters compact and discoverable while presenting store administration as readable responsive cards instead of a cramped table.

**Architecture:** Extract the ticket filter form into a focused client component that owns only the expand/collapse state; the server page continues to parse and execute the existing URL filters. Replace the stores table with server-rendered responsive cards, preserving the existing server actions, field names, permission checks, and usage data. Add Playwright coverage for the visible interaction and layout contracts.

**Tech Stack:** Next.js App Router, React client component state, Tailwind CSS, server actions, Playwright E2E tests, Vitest for pure filter behavior where applicable.

## Global Constraints

- Preserve the existing `parseTicketListFilters` URL contract and ticket pagination behavior.
- Keep the ticket search input visible when advanced filters are collapsed.
- Automatically expand ticket filters when at least one valid filter is active; otherwise start collapsed.
- Keep all existing ticket filter controls, labels, submit behavior, and clear-link behavior.
- Keep store create, update, delete actions and their existing field names unchanged.
- Keep store admin authorization through `can(user, "admin:manage-stores")`.
- Do not change data-store APIs, permissions, or validation as part of this UX refactor.
- Do not stage or modify the unrelated `.freebuff/` directory.

---

### Task 1: Add regression coverage for compact ticket filters and store cards

**Files:**
- Create: `tests/e2e/admin-ux.spec.ts`
- Test: existing Playwright fixture through `tests/e2e/helpers.ts`

**Interfaces:**
- Consumes: Existing seeded admin user `admin@bagietka.pl`, `loginAs`, and `resetDatabase`.
- Produces: Stable browser-level contracts for `data-testid="ticket-filters-toggle"`, `aria-controls="ticket-filters-panel"`, `data-testid="ticket-filters-panel"`, and `data-testid="store-card"` that implementation must satisfy.

- [ ] **Step 1: Write the failing ticket filter interaction test**

Add a test that logs in as the admin, opens `/admin/tickets`, and asserts:

```ts
const toggle = page.getByTestId("ticket-filters-toggle");
await expect(toggle).toHaveAttribute("aria-expanded", "false");
await expect(page.getByTestId("ticket-filters-panel")).toBeHidden();

await toggle.click();
await expect(toggle).toHaveAttribute("aria-expanded", "true");
await expect(page.getByTestId("ticket-filters-panel")).toBeVisible();
await expect(page.getByLabel("Filtruj po statusie")).toBeVisible();
```

- [ ] **Step 2: Write the failing active-filter expansion test**

In the same file, add a test that opens `/admin/tickets?status=IN_PROGRESS`, then verifies the advanced panel starts open and the selected status remains `IN_PROGRESS`:

```ts
await page.goto("/admin/tickets?status=IN_PROGRESS");
await expect(page.getByTestId("ticket-filters-toggle")).toHaveAttribute("aria-expanded", "true");
await expect(page.getByTestId("ticket-filters-panel")).toBeVisible();
await expect(page.getByLabel("Filtruj po statusie")).toHaveValue("IN_PROGRESS");
```

- [ ] **Step 3: Write the failing store card layout test**

Add a test that logs in as the admin, opens `/admin/stores`, and verifies that seeded stores are rendered as cards with editable fields and no table:

```ts
const cards = page.getByTestId("store-card");
await expect(cards.first()).toBeVisible();
await expect(cards.first().locator('input[name="code"]')).toBeVisible();
await expect(cards.first().locator('input[name="address"]')).toBeVisible();
await expect(page.locator("table")).toHaveCount(0);
```

- [ ] **Step 4: Run the focused E2E tests and verify they fail for the missing contracts**

Run:

```bash
npm run test:e2e -- tests/e2e/admin-ux.spec.ts
```

Expected: the new tests fail because the current ticket page has no toggle/panel test IDs and the current stores page still renders a table.

- [ ] **Step 5: Commit the regression tests**

```bash
git add tests/e2e/admin-ux.spec.ts
git commit -m "test: cover compact admin ticket and store layouts"
```

### Task 2: Extract and collapse the admin ticket filters

**Files:**
- Create: `components/admin/ticket-filters.tsx`
- Modify: `app/admin/tickets/page.tsx`
- Modify: `tests/e2e/admin-ux.spec.ts` only if selectors need a final accessibility assertion

**Interfaces:**
- Consumes: `TicketListFilters` from `lib/ticket-filters`, `User`, `Store`, and `Category` from `lib/types`, and the existing label arrays/maps.
- Produces: `TicketFilters` component with the signature `TicketFilters({ filters, users, stores, categories }: TicketFiltersProps)`; it renders the same GET form controls and uses `data-testid="ticket-filters-toggle"` plus `data-testid="ticket-filters-panel"`.

- [ ] **Step 1: Define the component props and initial state**

Create a client component with typed props:

```ts
type TicketFiltersProps = {
  filters: TicketListFilters;
  users: User[];
  stores: Store[];
  categories: Category[];
};
```

Initialize `isExpanded` from `Object.keys(filters).length > 0`, so invalid or empty URL values do not open the panel while any valid parsed filter does.

- [ ] **Step 2: Move the existing filter controls without changing their names or values**

Keep the existing `method="get"` form, search input, status/priority/assignee/store/category selects, `mine`, `unassigned`, and `overdue` checkboxes, submit button, and `/admin/tickets` clear link. Preserve the current option filtering for active users, stores, and categories.

Render the search input in an always-visible header row. Render the remaining controls in a panel with:

```tsx
<div id="ticket-filters-panel" data-testid="ticket-filters-panel" hidden={!isExpanded}>
  {/* existing advanced controls */}
</div>
```

- [ ] **Step 3: Add accessible toggle behavior and active-filter feedback**

Use a `type="button"` toggle with `aria-expanded={isExpanded}`, `aria-controls="ticket-filters-panel"`, and `data-testid="ticket-filters-toggle"`. Give it a clear Polish label such as `Pokaż filtry`/`Ukryj filtry`, and show the number of active filters when the count is non-zero. Keep the search field and filter icon visible in both states.

- [ ] **Step 4: Replace the inline form on the server page with the component**

Remove the duplicated filter imports/constants from `app/admin/tickets/page.tsx` and render:

```tsx
<TicketFilters filters={filters} users={page.users} stores={page.stores} categories={page.categories} />
```

Do not alter `getTicketListPageData`, `parseTicketListFilters`, `getTicketListCursor`, or `buildTicketListHref`.

- [ ] **Step 5: Run focused tests and static validation**

Run:

```bash
npm run test:e2e -- tests/e2e/admin-ux.spec.ts
npm run typecheck
npm run lint
```

Expected: ticket filter tests pass; the store-card test remains the only focused E2E failure until Task 3.

- [ ] **Step 6: Commit the ticket filter refactor**

```bash
git add components/admin/ticket-filters.tsx app/admin/tickets/page.tsx
git commit -m "feat: collapse admin ticket filters"
```

### Task 3: Replace the stores table with responsive administration cards

**Files:**
- Modify: `app/admin/stores/page.tsx`
- Modify: `tests/e2e/admin-ux.spec.ts` only if the final card selector needs tightening

**Interfaces:**
- Consumes: Existing `stores`, `usage`, `createStoreAdminAction`, `updateStoreAdminAction`, and `deleteStoreAdminAction` values and server actions.
- Produces: One `<article data-testid="store-card">` per store, with readable identity/status, location, usage summary, and the unchanged update/delete form contracts.

- [ ] **Step 1: Reshape the create-store form into a readable responsive grid**

Replace the single highly-specific large-screen grid with a responsive grid such as `grid gap-3 sm:grid-cols-2 xl:grid-cols-4`. Keep each field name (`code`, `name`, `city`, `address`, `region`), the `isActive` checkbox, and the create action intact. Let the address and action rows span columns where useful so fields do not become narrow.

- [ ] **Step 2: Replace the table wrapper with a responsive card grid**

Render the stores collection as a `div` using a responsive two-column layout at large widths, for example `grid gap-4 xl:grid-cols-2`. For every store render:

```tsx
<article data-testid="store-card" className="...">
  {/* header with code, name, and active/inactive status */}
  {/* location block with city, address, and optional region */}
  {/* usage block with user and ticket counts */}
  {/* update form and separate delete form */}
</article>
```

Use a multi-row form grid (`sm:grid-cols-2`, expanding at `xl`) so code, name, city, address, and region have usable widths. Keep `name="id"`, all editable field names, checkbox defaults, action labels, and the delete button unchanged.

- [ ] **Step 3: Preserve the existing visual language and status semantics**

Reuse `fieldClass`, existing dark-mode classes, and existing button styles. Add a compact active/inactive badge in each card header without changing the underlying `isActive` value. Show `-` for empty location values just as the table did, and keep both usage counts visible.

- [ ] **Step 4: Run focused E2E and static validation**

Run:

```bash
npm run test:e2e -- tests/e2e/admin-ux.spec.ts
npm run typecheck
npm run lint
```

Expected: all new UX tests pass, including the assertion that no table is rendered.

- [ ] **Step 5: Commit the stores card layout**

```bash
git add app/admin/stores/page.tsx
git commit -m "feat: render admin stores as responsive cards"
```

### Task 4: Verify the complete change and publish it

**Files:**
- Modify: none unless validation exposes a regression
- Inspect: `docs/superpowers/specs/2026-08-17-tickets-stores-ux-design.md`

**Interfaces:**
- Consumes: The completed ticket filter component, stores card layout, and their focused E2E coverage.
- Produces: A green validation result and a pushed `main` branch containing only the intended UX commits plus the already committed design/plan documents.

- [ ] **Step 1: Run the complete unit test suite**

Run:

```bash
TMPDIR=/tmp npm run test
```

Expected: all applicable Vitest tests pass; any pre-existing explicitly skipped tests remain skipped.

- [ ] **Step 2: Run the complete lint, typecheck, and production build checks sequentially**

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

Expected: the full browser suite passes against the project’s configured E2E server.

- [ ] **Step 4: Inspect the final diff and repository status**

Run:

```bash
git diff origin/main...HEAD --stat
git diff origin/main...HEAD --check
git status --short
```

Confirm that only the approved UX implementation, tests, and planning documents are included, and `.freebuff/` is not staged.

- [ ] **Step 5: Push the completed commits to `main`**

Run:

```bash
git push origin main
```

Expected: `origin/main` advances to the validated local `main` commit.
