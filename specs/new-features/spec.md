# Spec: New Features Development — FixIT Helpdesk

## Overview

This spec covers three feature areas for the FixIT Helpdesk application, prioritized by user impact. The features address key pain points identified through interview: repetitive IT workflows, lack of at-a-glance analytics, and overall UX polish gaps.

**Priority order:** Dashboard → Response Templates & Macros → UX Polish

---

## Feature 1: IT Dashboard with Charts

### Goal

Provide IT agents and admins with an at-a-glance overview of ticket health, workload distribution, and time-based trends — without needing to dig into the detailed reports page.

### Access Control

- **Visible to:** AGENT and ADMIN roles only (reports page already exists for admins; this dashboard replaces or supplements the admin home).
- **Reporters/Store Managers** are NOT shown the dashboard. They continue to land on `/tickets`.
- When an AGENT logs in, they are redirected to `/admin/dashboard` instead of `/admin/tickets`.

### Page Location

- **New route:** `/admin/dashboard`
- Add "Dashboard" link to `AdminNav` as the first item (before "Tickety").
- This page becomes the default landing for AGENT and ADMIN roles (update `app/page.tsx` redirect logic).

### Metrics to Display

#### Row 1 — KPI Cards (4 cards, horizontal)

| Card | Value | Description |
|------|-------|-------------|
| Total Open | count | All tickets with status NOT in `[RESOLVED, CLOSED, CANCELLED]` |
| Critical | count | Open tickets with `priority = CRITICAL` |
| Avg Resolution | hours (decimal) | Mean `resolvedAt - createdAt` for tickets resolved in the last 30 days |
| SLA Breached | count | Tickets currently past their SLA deadline (reuse existing `slaRules` from `lib/data-store.ts`) |

Each card should show the value prominently, with a small subtitle describing the metric and optionally a trend indicator (e.g., "↑ 12% from last week" if comparing to the prior 30-day window).

#### Row 2 — Charts (2 charts side by side)

**Chart A: Ticket Volume Over Time (line chart)**
- X-axis: last 30 days (daily granularity)
- Y-axis: number of tickets
- Two lines: "Created" (tickets created that day) and "Resolved" (tickets resolved that day)
- Smooth line with area fill, color-coded (green for resolved, blue for created)
- Hover tooltip showing date + count for each line

**Chart B: Tickets by Category (horizontal bar chart)**
- Y-axis: category names (top 8 categories)
- X-axis: ticket count
- Color-coded bars with count labels
- Sorted by count descending

#### Row 3 — Two sections side by side

**Section A: Agent Workload (bar chart or table)**
- Horizontal bar chart showing number of open tickets per AGENT/assignee
- Sorted by workload descending
- Show agent name and count
- "Unassigned" should appear as its own bar at the top

**Section B: Recent Activity (list)**
- Last 10 `TicketEvent` records across the system
- Each row: icon (based on event type), agent name, action description, relative time (e.g., "2 min ago")
- Link to the ticket detail page on click

### Data Layer

- **New function in `lib/data-store.ts`:** `getDashboardData(user: User): Promise<DashboardData>`
  - Must work in both JSON and Prisma runtimes.
  - Aggregates: open count, critical count, avg resolution hours (30-day window), SLA breached count, ticket volume by day (30 days), tickets by category, agent workload, recent events.
  - The existing `getDashboardMetrics()` function can be reused/extended for some of these.
- **New type in `lib/types.ts`:** `DashboardData` with fields for all the above.

### Charts Library

- **Recharts** (`recharts` package) — lightweight, composable, React-native, fits the Next.js + Tailwind stack.
- Charts should respect dark mode (use CSS variables or Tailwind color tokens).
- Charts should be responsive (stack on mobile, side-by-side on desktop).

### File Changes

| File | Change |
|------|--------|
| `package.json` | Add `recharts` dependency |
| `lib/types.ts` | Add `DashboardData` type |
| `lib/data-store.ts` | Add `getDashboardData()` for both runtimes |
| `app/admin/dashboard/page.tsx` | New page (server component) |
| `components/admin/dashboard.tsx` | New client component with KPI cards + charts |
| `components/admin/admin-nav.tsx` | Add "Dashboard" as first nav item |
| `app/page.tsx` | Update redirect logic: AGENT → `/admin/dashboard` |
| `lib/data-store.ts` (Prisma runtime) | Add aggregation queries for dashboard |

### Acceptance Criteria

- [ ] AGENT and ADMIN users see a dashboard at `/admin/dashboard` with 4 KPI cards, 2 charts, agent workload, and recent activity
- [ ] Dashboard shows correct data for both JSON and Prisma runtimes
- [ ] Charts are responsive (mobile: stacked, desktop: side-by-side)
- [ ] Dark mode is fully supported for all chart elements
- [ ] Loading state shows skeleton placeholders while data loads
- [ ] Empty state is shown when there are no tickets
- [ ] "Dashboard" link appears first in `AdminNav`
- [ ] AGENT users are redirected to `/admin/dashboard` on login (not `/admin/tickets`)
- [ ] All existing tests continue to pass

---

## Feature 2: Response Templates & Quick-Action Macros

### Goal

Reduce repetitive work for IT agents by providing reusable response templates with variable interpolation and one-click workflow macros.

### Access Control

- **Template management (CRUD):** ADMIN only — managed via a new admin section.
- **Using templates/macros:** AGENT and ADMIN — available on ticket detail pages and in the comment form.

### Data Model

#### ResponseTemplate (new Prisma model)

```prisma
model ResponseTemplate {
  id          String   @id @default(cuid())
  name        String
  body        String
  category    String?          // optional category tag (e.g., "password", "vpn", "printer")
  variables   String[]         // list of supported variables: ["ticket.title", "user.name", etc.]
  isActive    Boolean  @default(true)
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  createdBy User @relation(fields: [createdById], references: [id])
}
```

#### Supported Template Variables

| Variable | Resolves To |
|----------|-------------|
| `{{ticket.title}}` | The ticket's title |
| `{{ticket.number}}` | The ticket number (e.g., IT-2026-0042) |
| `{{ticket.description}}` | The ticket's description |
| `{{user.name}}` | The ticket reporter's name |
| `{{user.email}}` | The ticket reporter's email |
| `{{assignee.name}}` | The current assignee's name |
| `{{category.name}}` | The ticket's category name |
| `{{store.name}}` | The ticket's store name (if applicable) |

#### Macro (quick-action preset)

A macro combines a template + status change + optional priority change into a single action. Stored as a JSON config, not a separate table.

**Macro schema (stored in `lib/types.ts`):**

```typescript
type ResponseMacro = {
  id: string;
  name: string;
  templateId?: string;          // optional — reference to a ResponseTemplate
  body?: string;                // or inline body (if no template reference)
  newStatus?: TicketStatus;     // auto-change status when macro is used
  newPriority?: TicketPriority; // optional priority change
  isActive: boolean;
  createdBy: string;
};
```

**Storage:** Add a `responseMacros` field to the `Database` type and a Prisma model:

```prisma
model ResponseMacro {
  id          String   @id @default(cuid())
  name        String
  templateId  String?
  body        String?
  newStatus   TicketStatus?
  newPriority TicketPriority?
  isActive    Boolean  @default(true)
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  createdBy User @relation(fields: [createdById], references: [id])
}
```

### UI Components

#### 1. Template Picker (on ticket detail / comment form)

- A button "Dodaj szablon" (Add template) next to the comment textarea.
- On click: opens a dropdown/popover listing active templates.
- Templates are filterable by category tag.
- Selecting a template inserts the resolved body into the comment textarea (replacing variables).
- The agent can edit the text before submitting.

#### 2. Macro Bar (on ticket detail, IT view only)

- A horizontal bar of macro buttons displayed above the comment area.
- Each macro shows its name as a button label.
- Clicking a macro:
  1. Inserts the template body (with variables resolved) into the comment textarea.
  2. Pre-selects the status change (shown as a badge next to the comment).
  3. Pre-selects the priority change (if applicable).
  4. The agent can review and adjust before hitting "Wyślij" (Send).
- One-click mode: a "Szybko wyślij" (Quick send) option on each macro that posts the comment + applies status/priority changes immediately without further confirmation.

#### 3. Admin: Template Management (`/admin/templates`)

- Table view of all templates with columns: Name, Category, Variables, Status (active/inactive), Created, Actions.
- Actions: Edit, Delete (with confirmation), Toggle active/inactive.
- New template form: Name, Category (text input with suggestions), Body (textarea with variable insert buttons), Preview (shows resolved example).
- Same pattern for Macro management on the same page or a sub-route.

### Variable Resolution

- **New function in `lib/utils.ts` (or `lib/format.ts`):** `resolveTemplateVariables(template: string, context: { ticket: Ticket; user?: User; assignee?: User; category?: Category; store?: Store }): string`
- Replaces `{{variable}}` placeholders with actual values.
- Gracefully handles missing data (e.g., if no assignee, `{{assignee.name}}` → "nieprzypisany").

### File Changes

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `ResponseTemplate` and `ResponseMacro` models |
| New migration | `prisma/migrations/.../add_response_templates_and_macros/` |
| `lib/types.ts` | Add `ResponseTemplate`, `ResponseMacro` types |
| `lib/data-store.ts` | Add CRUD functions for templates and macros (both runtimes) |
| `lib/format.ts` | Add `resolveTemplateVariables()` utility |
| `components/ticket-detail.tsx` | Add template picker and macro bar for IT users |
| `app/admin/templates/page.tsx` | New admin page for template/macro management |
| `components/admin/template-form.tsx` | New form component for creating/editing templates |
| `components/admin/admin-nav.tsx` | Add "Szablony" link |
| `app/admin/actions.ts` | Add server actions for template/macro CRUD |
| `lib/seed.ts` | Add seed data: 5-6 sample templates for common IT scenarios |

### Seed Templates (examples)

| Name | Category | Body |
|------|----------|------|
| Hasło tymczasowe | hasło | `Dzień dobry {{user.name}},\n\nTwoje tymczasowe hasło to: [GENERATE]\n\nPo zalogowaniu proszę o zmianę hasła.\n\nPozdrawiam,\n{{assignee.name}}` |
| Zgłoszenie resolved | ogólne | `Dzień dobry {{user.name}},\n\nSprawa {{ticket.number}} została rozwiązana. W razie problemów proszę o dopisanie komentarza.\n\nPozdrawiam,\n{{assignee.name}}` |
| Potrzebne informacje | diagnostyka | `Dzień dobry {{user.name}},\n\nProszę o podanie dodatkowych informacji:\n- System operacyjny\n- Numer stanowiska\n- Zdjęcie błędu (jeśli możliwe)\n\nPozdrawiam,\n{{assignee.name}}` |
| Przekierowanie do dostawcy | dostawca | `Wewnętrznie: Przekazano sprawę {{ticket.number}} do dostawcy [VENDOR]. Oczekujemy na odpowiedź.` |
| Oczekiwanie na użytkownika | oczekiwanie | `Dzień dobry {{user.name}},\n\nProszę o potwierdzenie, czy problem w ticketcie {{ticket.number}} został rozwiązany po ostatnich zmianach.\n\nPozdrawiam,\n{{assignee.name}}` |

### Acceptance Criteria

- [ ] ADMIN users can create, edit, delete, and toggle active/inactive status of response templates at `/admin/templates`
- [ ] AGENT and ADMIN users see template picker on ticket detail pages
- [ ] Selecting a template inserts resolved text into the comment textarea
- [ ] Variables like `{{ticket.title}}`, `{{user.name}}`, `{{assignee.name}}` are correctly resolved
- [ ] Macros apply status/priority changes along with inserting template text
- [ ] "Quick send" mode on macros posts immediately without further editing
- [ ] Templates are stored in both JSON and Prisma runtimes
- [ ] Admin can filter/search templates by name or category
- [ ] Empty state shown when no templates exist
- [ ] 5-6 seed templates are created for common IT scenarios
- [ ] All existing tests continue to pass

---

## Feature 3: UX Polish & Robustness

### Goal

Improve the overall user experience by adding proper loading states, error handling, feedback mechanisms, and responsive design improvements. This is the foundational polish that makes the entire app feel more professional and reliable.

### 3A. Toast Notifications (Sonner)

**Library:** `sonner` — lightweight, customizable, recommended by shadcn/ui.

**Scope:** Add toast notifications for all user-facing actions:

| Action | Toast Type | Message |
|--------|-----------|---------|
| Ticket created | success | "Ticket {{number}} został utworzony" |
| Ticket status changed | success | "Status zmieniony na {{status}}" |
| Ticket priority changed | success | "Priorytet zmieniony na {{priority}}" |
| Assignee changed | success | "Wykonawca przypisany: {{name}}" |
| Comment added | success | "Komentarz dodany" |
| Template applied | info | "Szablon '{{name}}' zastosowany" |
| Macro applied | info | "Makro '{{name}}' zastosowane: {{status change}}" |
| Attachment uploaded | success | "Plik '{{filename}}' przesłany" |
| Attachment upload failed | error | "Nie udało się przesłać plika: {{error}}" |
| Knowledge article created | success | "Artykuł utworzony" |
| User deactivated | success | "Użytkownik dezaktywowany" |
| Store/Cat CRUD | success | "Zapisano" |
| Permission denied | error | "Brak uprawnień do tej operacji" |
| Network error | error | "Błąd połączenia. Spróbuj ponownie." |
| Form validation error | error | "Sprawdź dane formularza" |
| Logout | info | "Wylogowano" |

**Implementation:**
- Add `<Toaster />` from sonner to `app/layout.tsx`.
- Create a small `lib/toast.ts` helper with typed toast functions (`toastSuccess`, `toastError`, `toastInfo`) for consistency.
- Server actions return success/error payloads; client components use `useTransition` + `useRouter` pattern and call toast on completion.

**File changes:**
| File | Change |
|------|--------|
| `package.json` | Add `sonner` dependency |
| `app/layout.tsx` | Add `<Toaster />` component |
| `lib/toast.ts` | New helper with typed toast functions |
| `components/ticket-detail.tsx` | Add toasts for status/priority/assignee changes |
| `app/tickets/new/page.tsx` | Add toast on successful ticket creation |
| `components/tickets/attachment-upload.tsx` | Add toasts for upload success/failure |
| `app/admin/actions.ts` | Client components consume results with toasts |
| Other admin CRUD pages | Add toasts for create/update/delete actions |

### 3B. Skeleton Loading States

**Scope:** Add skeleton loading placeholders on all major pages:

| Page | Skeleton Content |
|------|-----------------|
| `/tickets` (my tickets list) | 5-6 skeleton ticket cards matching `TicketCard` layout |
| `/tickets/[id]` (ticket detail) | Full detail skeleton: header bar, info rows, comment list, sidebar |
| `/tickets/new` (new ticket form) | Form skeleton with input placeholders |
| `/admin/tickets` (IT queue) | Table skeleton: 8 rows with column placeholders |
| `/admin/tickets/[id]` | Same as `/tickets/[id]` skeleton |
| `/admin/dashboard` | KPI cards (4), chart placeholders (2), table skeleton |
| `/admin/kanban` | Column skeletons with card placeholders |
| `/knowledge` | Article card skeletons (6 items grid) |
| `/admin/users`, `/admin/stores`, `/admin/categories` | Table skeletons |

**Implementation pattern:**
- Create reusable skeleton primitives in `components/ui/skeleton.tsx`: `SkeletonCard`, `SkeletonTable`, `SkeletonChart`, `SkeletonForm`.
- Each skeleton uses Tailwind `animate-pulse` with appropriate background colors.
- Pages use `Suspense` boundaries with skeleton fallbacks for data loading.
- Ensure skeletons match the actual content layout to prevent layout shift (CLS).

**File changes:**
| File | Change |
|------|--------|
| `components/ui/skeleton.tsx` | New file: reusable skeleton components |
| All page files listed above | Wrap data-fetching in `<Suspense fallback={<SkeletonX />}>` |

### 3C. Error Boundaries & Fallbacks

**Scope:** Prevent single-component failures from crashing entire pages.

**Implementation:**
- Create `components/error-boundary.tsx` — a generic React error boundary component.
- Wrap key sections of major pages in error boundaries:
  - Dashboard charts section (if charts fail, still show KPI cards)
  - Agent workload section
  - Kanban board
  - Comment list on ticket detail
  - Attachment section
- Each error boundary shows a friendly fallback: "Nie udało się załadować tej sekcji. [Spróbuj ponownie]" with a retry button that resets the boundary state.
- Use Next.js `error.tsx` files in route directories for page-level error handling.

**File changes:**
| File | Change |
|------|--------|
| `components/error-boundary.tsx` | New file: reusable error boundary |
| `app/admin/dashboard/error.tsx` | Page-level error boundary |
| `app/admin/tickets/error.tsx` | Page-level error boundary |
| `app/admin/kanban/error.tsx` | Page-level error boundary |
| Dashboard, kanban, ticket detail components | Wrap sections in error boundaries |

### 3D. Better Empty States

**Scope:** Replace blank areas with helpful, illustrated empty states.

| Page/Section | Empty State |
|-------------|-------------|
| "Moje zgloszenia" (no tickets) | Illustration + "Nie masz jeszcze żadnych zgłoszeń" + "Zgłoś awarię" CTA button |
| "Moje zgloszenia" (no results after filtering) | "Brak zgłoszeń pasujących do filtrów" + reset filters button |
| IT queue (no tickets) | "Kolejka jest pusta — wszystkie zgłoszenia zostały obsłużone!" |
| Kanban (empty column) | Small text: "Brak" (already exists, keep as-is) |
| Knowledge base (no articles) | "Baza wiedzy jest pusta" + admin CTA to create articles |
| Admin templates (no templates) | "Brak szablonów odpowiedzi" + "Utwórz pierwszy szablon" CTA |
| Comments section (no comments) | "Brak komentarzy" (small, muted text — keep minimal) |

**Implementation:**
- Create `components/ui/empty-state.tsx` — reusable component with icon, title, description, and optional CTA button.
- Use lucide-react icons for the illustration (e.g., `Inbox`, `SearchX`, `CheckCircle`, `FileText`).

**File changes:**
| File | Change |
|------|--------|
| `components/ui/empty-state.tsx` | New file: reusable empty state component |
| All pages/sections listed above | Replace blank states with `<EmptyState />` |

### 3E. Mobile & Responsive Polish

**Scope:** Improve the experience on mobile and tablet devices.

**Specific improvements:**
1. **Collapsible admin sidebar on tablet:** On screens between `md` and `lg`, the `AdminNav` should collapse into a horizontal scrollable tab bar (like mobile nav) instead of wrapping awkwardly.
2. **Kanban board on mobile:** Add a column selector dropdown on mobile so users can focus on one column at a time (horizontal scroll on desktop stays).
3. **Ticket detail on mobile:** Stack the metadata fields vertically on small screens. Action buttons (status change, priority, assignee) should use full-width layout on mobile.
4. **Forms on mobile:** All form inputs and buttons should be full-width on small screens. Add proper `inputMode` attributes for phone/email fields.
5. **Tables on mobile:** Admin tables (users, stores, categories, templates) should have a card-based layout on small screens instead of horizontal scroll.
6. **Touch targets:** Ensure all interactive elements have minimum 44x44px touch targets.

**File changes:**
| File | Change |
|------|--------|
| `components/admin/admin-nav.tsx` | Horizontal scrollable tab bar on tablet |
| `components/admin/kanban-board.tsx` | Column selector for mobile |
| `components/ticket-detail.tsx` | Responsive metadata stacking, full-width actions |
| All form pages | Full-width inputs/buttons on mobile, proper inputMode |
| Admin table pages | Card-based layout on mobile |
| `app/globals.css` | Add utility classes for mobile-specific styles if needed |

### Acceptance Criteria (Feature 3 overall)

- [ ] Toast notifications appear for all major user actions (success, error, info)
- [ ] Toasts are dismissible and auto-expire after ~4 seconds
- [ ] Skeleton loading states appear on all major pages while data loads
- [ ] Skeletons match actual content layout (no layout shift)
- [ ] Error boundaries catch component errors and show friendly fallback with retry
- [ ] Page-level errors show Next.js error page with back-to-home option
- [ ] Empty states show helpful messaging and CTAs on all list/empty sections
- [ ] Admin nav is scrollable on tablet screens
- [ ] Kanban board has a column selector on mobile
- [ ] Ticket detail is fully usable on mobile (stacked layout, full-width buttons)
- [ ] Admin tables show card layout on small screens
- [ ] All interactive elements have 44x44px minimum touch targets
- [ ] All existing tests continue to pass
- [ ] No new lint or type errors

---

## Cross-Cutting Concerns

### Testing

- **Unit tests:** Add tests for `resolveTemplateVariables()`, `getDashboardData()` aggregation logic, and toast helper functions.
- **E2E tests:** Add Playwright tests for:
  - Creating a template as admin, using it on a ticket
  - Using a macro on a ticket (status change + comment)
  - Dashboard loads with correct data
  - Toast appears on ticket creation
  - Empty state shown when no tickets exist
- **Regression:** All existing tests must continue to pass.

### Performance

- Dashboard data queries should be optimized — avoid N+1 queries in Prisma runtime.
- Chart rendering should use `React.memo` or lazy loading to avoid re-renders.
- Skeleton states should prevent layout shift (CLS < 0.1).

### Accessibility

- Toast notifications should be announced via `aria-live` regions.
- Skeleton loading should have `aria-busy` attributes.
- Error boundaries should have appropriate `role="alert"`.
- Chart elements should have `aria-label` descriptions.
- Empty states should be readable by screen readers.

### Dark Mode

- All new components must support dark mode.
- Charts must use dark-mode-compatible colors.
- Toasts must be readable in both light and dark mode.
- Skeletons must use appropriate background colors per theme.

### Database Migrations

Two new migrations needed:
1. `ResponseTemplate` model
2. `ResponseMacro` model

Both should be idempotent and safe for production deployment via `prisma migrate deploy`.

### Dependencies to Add

| Package | Purpose |
|---------|---------|
| `recharts` | Chart library for dashboard |
| `sonner` | Toast notifications |

---

## Implementation Order

1. **Phase 1: IT Dashboard** (Feature 1)
   - Add Recharts dependency
   - Create `getDashboardData()` in data-store
   - Build dashboard page and components
   - Update navigation and redirect logic
   - Test with both runtimes

2. **Phase 2: Response Templates & Macros** (Feature 2)
   - Create Prisma models and migration
   - Add data-store CRUD functions
   - Add `resolveTemplateVariables()` utility
   - Build admin template management page
   - Add template picker and macro bar to ticket detail
   - Add seed data
   - Test both runtimes

3. **Phase 3: UX Polish** (Feature 3)
   - Add Sonner dependency and `<Toaster />`
   - Add toast helper and implement toasts across all actions
   - Create skeleton components and add to all pages
   - Create error boundary and wrap key sections
   - Create empty state component and replace blank areas
   - Mobile/responsive improvements
   - Test all pages on mobile viewport

4. **Phase 4: Testing & Validation**
   - Run `npm run lint`, `npm run typecheck`, `npm run test`
   - Add new unit tests
   - Add new E2E tests
   - Final regression check
