# IT Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przebudować Pulpit zespołu IT w hybrydowe centrum operacyjne z alarmami, osobistą kolejką pracy i zwięzłą analityką z ostatnich 30 dni.

**Architecture:** Strona serwerowa pobiera jeden ograniczony kontrakt `DashboardData` dla zalogowanego AGENTA lub ADMINA. Czyste funkcje domenowe odpowiadają za definicję SLA, grupowanie statusów, sortowanie alarmów i tworzenie 30-dniowych szeregów, a adaptery Prisma i JSON dostarczają im równoważne dane. Interfejs zachowuje Recharts dla analityki i dodaje mały komponent kliencki wyłącznie do obsługi trzech zakładek osobistej kolejki.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.7, Tailwind CSS, Recharts 3, Prisma 6/PostgreSQL, JSON data provider, Vitest 4, Playwright 1.60.

**Spec:** `docs/superpowers/specs/2026-08-20-dashboard-redesign-design.md`

## Global Constraints

- Uruchamiaj wszystkie komendy przez Node `20.20.2`; przed walidacją wykonaj `source /home/dakos/.nvm/nvm.sh && nvm use`.
- Nie dodawaj nowych zależności npm; użyj istniejących React, Recharts, Lucide i Tailwind.
- Zachowaj dostęp do `/admin/dashboard` wyłącznie dla ról AGENT i ADMIN przez `canUseAdmin`.
- Zachowaj równoważną semantykę providerów Prisma/PostgreSQL i JSON.
- Analityka obejmuje dokładnie bieżący dzień UTC oraz poprzednie 29 dni; nie dodawaj przełącznika okresu.
- Nie zwracaj w `DashboardData` opisów, kontaktów, komentarzy, notatek wewnętrznych ani danych załączników.
- Nie migruj i nie uzupełniaj historycznych wartości `resolvedAt`; popraw tylko zachowanie przyszłych przejść statusów.
- Nie przywracaj sekcji `Ostatnia aktywność`, osobnego rzędu czterech KPI ani alarmów nieprzypisanych/blokujących/nieaktywnych.
- Zachowaj nieśledzone `.superpowers/` i `refaktor.md`; nie dodawaj ich do żadnego commita.
- Nie wykonuj pushu, merge ani wdrożenia bez oddzielnego, jednoznacznego polecenia użytkownika.

---

### Task 1: Ujednolicić reguły SLA dla pamięci i zapytań Prisma

**Files:**
- Create: `lib/ticket-sla.ts`
- Create: `lib/ticket-query.ts`
- Modify: `lib/ticket-filters.ts:38-120`
- Modify: `lib/data-store.ts:161-181`
- Modify: `lib/data-store-tickets.ts:91-107`
- Test: `tests/ticket-filters.test.ts`

**Interfaces:**
- Consumes: `Ticket`, `TicketPriority`, `TicketStatus` from `lib/types.ts`.
- Produces: `SLA_HOURS`, `COMPLETED_TICKET_STATUSES`, `getTicketSlaDeadline(ticket)`, `isTicketOverdue(ticket, now)`, `getTicketSlaState(ticket, now)` from `lib/ticket-sla.ts`.
- Produces: `buildOpenTicketWhere()`, `buildSlaBreachedWhere(now)` from server-only `lib/ticket-query.ts`.
- Preserves: re-exports of `getTicketSlaDeadline`, `isTicketOverdue`, and `getTicketSlaState` from `lib/ticket-filters.ts`, so current consumers do not break.
- Preserves: public `slaRules` from `lib/data-store.ts` as an alias of `SLA_HOURS`, because `app/admin/reports/page.tsx` consumes it.

- [ ] **Step 1: Rozszerzyć testy SLA o `dueAt` i niepoprawną datę**

W `tests/ticket-filters.test.ts` dodaj:

```ts
it("uses dueAt when present and falls back to the priority deadline for invalid dates", () => {
  const now = new Date("2026-08-20T12:00:00.000Z");

  expect(isTicketOverdue({ ...baseTicket, dueAt: "2026-08-20T11:59:00.000Z" }, now)).toBe(true);
  expect(isTicketOverdue({ ...baseTicket, dueAt: "2026-08-20T12:01:00.000Z" }, now)).toBe(false);
  expect(
    getTicketSlaDeadline({
      ...baseTicket,
      createdAt: "2026-08-20T00:00:00.000Z",
      dueAt: "not-a-date",
      priority: "HIGH"
    }).toISOString()
  ).toBe("2026-08-20T08:00:00.000Z");
});
```

- [ ] **Step 2: Uruchomić test i potwierdzić stan początkowy**

Run:

```bash
source /home/dakos/.nvm/nvm.sh && nvm use >/dev/null
npm run test -- --run tests/ticket-filters.test.ts
```

Expected: testy istniejącej logiki przechodzą; ten wynik stanowi punkt odniesienia przed przeniesieniem reguł do współdzielonego modułu.

- [ ] **Step 3: Utworzyć czysty moduł SLA**

W `lib/ticket-sla.ts` zdefiniuj:

```ts
import type { Ticket, TicketPriority, TicketStatus } from "@/lib/types";

export const SLA_HOURS: Record<TicketPriority, number> = {
  CRITICAL: 4,
  HIGH: 8,
  NORMAL: 24,
  LOW: 48
};

export const COMPLETED_TICKET_STATUSES = new Set<TicketStatus>([
  "RESOLVED",
  "CLOSED",
  "CANCELLED"
]);

type SlaTicket = Pick<Ticket, "createdAt" | "dueAt" | "priority" | "status">;

export function getTicketSlaDeadline(ticket: Pick<SlaTicket, "createdAt" | "dueAt" | "priority">): Date {
  if (ticket.dueAt) {
    const dueAt = new Date(ticket.dueAt);
    if (!Number.isNaN(dueAt.getTime())) return dueAt;
  }
  return new Date(new Date(ticket.createdAt).getTime() + SLA_HOURS[ticket.priority] * 60 * 60 * 1000);
}

export function isTicketOverdue(ticket: SlaTicket, now = new Date()): boolean {
  return !COMPLETED_TICKET_STATUSES.has(ticket.status) && getTicketSlaDeadline(ticket).getTime() < now.getTime();
}

export type TicketSlaState = "ON_TRACK" | "AT_RISK" | "BREACHED" | "COMPLETED";

export function getTicketSlaState(ticket: SlaTicket, now = new Date()): TicketSlaState {
  if (COMPLETED_TICKET_STATUSES.has(ticket.status)) return "COMPLETED";
  const remainingHours = (getTicketSlaDeadline(ticket).getTime() - now.getTime()) / 3_600_000;
  if (remainingHours <= 0) return "BREACHED";
  return remainingHours <= Math.max(2, SLA_HOURS[ticket.priority] * 0.25) ? "AT_RISK" : "ON_TRACK";
}
```

Usuń lokalne kopie tych stałych i funkcji z `lib/ticket-filters.ts`. Zaimportuj lokalnie `COMPLETED_TICKET_STATUSES` i `isTicketOverdue`, ponieważ będą używane przez dopasowanie filtrów, a publiczne API zachowaj przez:

```ts
export { getTicketSlaDeadline, getTicketSlaState, isTicketOverdue } from "@/lib/ticket-sla";
export type { TicketSlaState } from "@/lib/ticket-sla";
```

- [ ] **Step 4: Utworzyć kanoniczne warunki Prisma**

W `lib/ticket-query.ts` dodaj:

```ts
import "server-only";
import type { Prisma } from "@prisma/client";
import { COMPLETED_TICKET_STATUSES, SLA_HOURS } from "@/lib/ticket-sla";

export function buildOpenTicketWhere(): Prisma.TicketWhereInput {
  return { status: { notIn: [...COMPLETED_TICKET_STATUSES] } };
}

export function buildSlaBreachedWhere(now: Date): Prisma.TicketWhereInput {
  return {
    ...buildOpenTicketWhere(),
    OR: [
      { dueAt: { lt: now } },
      {
        dueAt: null,
        OR: (Object.entries(SLA_HOURS) as Array<[keyof typeof SLA_HOURS, number]>).map(([priority, hours]) => ({
          priority,
          createdAt: { lt: new Date(now.getTime() - hours * 3_600_000) }
        }))
      }
    ]
  };
}
```

Zastąp lokalny `buildSlaBreachedWhere` w `lib/data-store.ts` importem z `lib/ticket-query.ts`. W `lib/data-store-tickets.ts` użyj tej samej funkcji zamiast ręcznie powtarzanego bloku `dueAt`/priorytetów.

W `lib/data-store.ts` usuń lokalne `slaRules` oraz `resolvedOrClosedStatuses`, zaimportuj `SLA_HOURS`, `COMPLETED_TICKET_STATUSES`, `getTicketSlaDeadline` i `isTicketOverdue`, a kompatybilność strony Raportów zachowaj przez:

```ts
export { SLA_HOURS as slaRules } from "@/lib/ticket-sla";
```

W istniejących metrykach i tymczasowej starej implementacji Pulpitu zastąp ręczne obliczenia `createdAt + slaRules[priority]` wywołaniami `getTicketSlaDeadline`/`isTicketOverdue`. Wszystkie sprawdzenia otwartego statusu oprzyj na `COMPLETED_TICKET_STATUSES`. Po tym kroku w `lib/` nie może pozostać druga tabela godzin SLA ani drugie wyliczenie terminu.

- [ ] **Step 5: Uruchomić testy i statyczną weryfikację**

Run:

```bash
npm run test -- --run tests/ticket-filters.test.ts
npm run typecheck
npm run lint
```

Expected: wszystkie komendy kończą się kodem 0; istniejące importy z `lib/ticket-filters.ts` pozostają zgodne.

- [ ] **Step 6: Commit**

```bash
git add lib/ticket-sla.ts lib/ticket-query.ts lib/ticket-filters.ts lib/data-store.ts lib/data-store-tickets.ts tests/ticket-filters.test.ts
git commit -m "refactor: centralize ticket SLA rules"
```

### Task 2: Dodać grupowe filtry `stage` i `attention`

**Files:**
- Modify: `lib/ticket-filters.ts:3-145`
- Modify: `lib/ticket-query.ts`
- Modify: `lib/data-store-tickets.ts:63-114`
- Modify: `components/admin/ticket-filters.tsx:14-80`
- Test: `tests/ticket-filters.test.ts`
- Test: `tests/data-store.test.ts:91-161`

**Interfaces:**
- Consumes: `isTicketOverdue`, `buildOpenTicketWhere`, `buildSlaBreachedWhere` from Task 1.
- Produces: `TicketStageFilter = "new" | "waiting" | "in_progress"` and `TicketAttentionFilter = "critical" | "overdue" | "all"`.
- Produces: `TicketListFilters.stage?`, `TicketListFilters.attention?`, `getStageStatuses(stage)`, `buildStageWhere(stage)`, `buildAttentionWhere(attention, now)`.
- URL precedence: valid `status` overrides `stage`; both parameters may remain in the URL, but only `status` affects results.

- [ ] **Step 1: Napisać testy parsera i dopasowania w pamięci**

Dodaj do `tests/ticket-filters.test.ts`:

```ts
it("parses dashboard stage and attention filters and ignores invalid values", () => {
  expect(parseTicketListFilters({ stage: "waiting", attention: "all" })).toEqual({
    stage: "waiting",
    attention: "all"
  });
  expect(parseTicketListFilters({ stage: "broken", attention: "later" })).toEqual({});
});

it("lets an exact status override a dashboard stage", () => {
  const filters = parseTicketListFilters({ status: "IN_PROGRESS", stage: "new" });
  expect(matchesTicketFilters({ ...baseTicket, status: "IN_PROGRESS" }, filters)).toBe(true);
  expect(matchesTicketFilters({ ...baseTicket, status: "NEW" }, filters)).toBe(false);
});

it("matches grouped stages and deduplicated attention modes", () => {
  const now = new Date("2026-08-20T12:00:00.000Z");
  expect(matchesTicketFilters({ ...baseTicket, status: "WAITING_FOR_USER" }, { stage: "waiting" }, undefined, now)).toBe(true);
  expect(matchesTicketFilters({ ...baseTicket, status: "WAITING_FOR_VENDOR" }, { stage: "waiting" }, undefined, now)).toBe(true);
  expect(matchesTicketFilters({ ...baseTicket, status: "NEW" }, { stage: "waiting" }, undefined, now)).toBe(false);
  expect(matchesTicketFilters({ ...baseTicket, priority: "CRITICAL" }, { attention: "critical" }, undefined, now)).toBe(true);
  expect(matchesTicketFilters(baseTicket, { attention: "overdue" }, undefined, now)).toBe(true);
  expect(matchesTicketFilters({ ...baseTicket, status: "RESOLVED", priority: "CRITICAL" }, { attention: "all" }, undefined, now)).toBe(false);
});
```

- [ ] **Step 2: Uruchomić test i potwierdzić porażkę**

Run:

```bash
npm run test -- --run tests/ticket-filters.test.ts
```

Expected: FAIL, ponieważ `stage` i `attention` nie istnieją w kontrakcie filtrów.

- [ ] **Step 3: Rozszerzyć czysty kontrakt filtrów**

W `lib/ticket-filters.ts` dodaj typy i mapę:

```ts
export type TicketStageFilter = "new" | "waiting" | "in_progress";
export type TicketAttentionFilter = "critical" | "overdue" | "all";

const stageStatuses: Record<TicketStageFilter, TicketStatus[]> = {
  new: ["NEW", "TRIAGED"],
  waiting: ["WAITING_FOR_USER", "WAITING_FOR_VENDOR"],
  in_progress: ["IN_PROGRESS"]
};

export function getStageStatuses(stage: TicketStageFilter): TicketStatus[] {
  return stageStatuses[stage];
}
```

Rozszerz `TicketListFilters`, parser i `matchesTicketFilters`:

```ts
const stage = enumParam(firstParam(params.stage), ["new", "waiting", "in_progress"] as const);
const attention = enumParam(firstParam(params.attention), ["critical", "overdue", "all"] as const);

if (!filters.status && filters.stage && !getStageStatuses(filters.stage).includes(ticket.status)) return false;
if (filters.attention === "critical" && (COMPLETED_TICKET_STATUSES.has(ticket.status) || ticket.priority !== "CRITICAL")) return false;
if (filters.attention === "overdue" && !isTicketOverdue(ticket, now)) return false;
if (
  filters.attention === "all" &&
  (COMPLETED_TICKET_STATUSES.has(ticket.status) || (ticket.priority !== "CRITICAL" && !isTicketOverdue(ticket, now)))
) return false;
```

- [ ] **Step 4: Dodać równoważne warunki Prisma**

W `lib/ticket-query.ts` dodaj:

```ts
import type { TicketAttentionFilter, TicketStageFilter } from "@/lib/ticket-filters";
import { getStageStatuses } from "@/lib/ticket-filters";

export function buildStageWhere(stage: TicketStageFilter): Prisma.TicketWhereInput {
  return { status: { in: getStageStatuses(stage) } };
}

export function buildAttentionWhere(attention: TicketAttentionFilter, now: Date): Prisma.TicketWhereInput {
  if (attention === "critical") return { ...buildOpenTicketWhere(), priority: "CRITICAL" };
  if (attention === "overdue") return buildSlaBreachedWhere(now);
  return {
    ...buildOpenTicketWhere(),
    OR: [{ priority: "CRITICAL" }, buildSlaBreachedWhere(now)]
  };
}
```

W `buildVisibleTicketQuery` zastosuj `status` albo `stage` oraz `attention`:

```ts
if (filters.status) filterWhere.push({ status: filters.status });
else if (filters.stage) filterWhere.push(buildStageWhere(filters.stage));
if (filters.attention) filterWhere.push(buildAttentionWhere(filters.attention, currentTime));
else if (filters.overdue) filterWhere.push(buildSlaBreachedWhere(currentTime));
```

- [ ] **Step 5: Dodać regresję JSON i widoczność aktywnych filtrów**

W `tests/data-store.test.ts` dodaj przypadek, który zapisuje zgłoszenia `NEW`, `WAITING_FOR_USER`, `WAITING_FOR_VENDOR`, `IN_PROGRESS`, `RESOLVED`:

```ts
const { findUserByEmail, listVisibleTickets, readDatabase, writeDatabase } = await import("@/lib/data-store");
const admin = await findUserByEmail("krzysztofgraczyk@bagietka.pl");
const database = await readDatabase();
const base = {
  id: "filter-new",
  number: "IT-2026-9001",
  title: "Dashboard filter fixture",
  description: "Fixture for grouped dashboard filters.",
  status: "NEW" as const,
  priority: "NORMAL" as const,
  blocksWork: false,
  contact: "admin@bagietka.pl",
  categoryId: "cat_other",
  reporterId: admin!.id,
  createdAt: "2026-08-19T00:00:00.000Z",
  updatedAt: "2026-08-19T00:00:00.000Z"
};
database.tickets.push(
  base,
  { ...base, id: "filter-user", number: "IT-2026-9002", status: "WAITING_FOR_USER" },
  { ...base, id: "filter-vendor", number: "IT-2026-9003", status: "WAITING_FOR_VENDOR" },
  { ...base, id: "filter-progress", number: "IT-2026-9004", status: "IN_PROGRESS" },
  { ...base, id: "filter-resolved", number: "IT-2026-9005", status: "RESOLVED" }
);
await writeDatabase(database);

expect((await listVisibleTickets(admin!, { stage: "waiting" })).map((ticket) => ticket.status).sort()).toEqual([
  "WAITING_FOR_USER",
  "WAITING_FOR_VENDOR"
]);
expect((await listVisibleTickets(admin!, { attention: "all" })).every((ticket) => ticket.status !== "RESOLVED")).toBe(true);
```

W `components/admin/ticket-filters.tsx` pozostaw nowe parametry jako aktywne filtry, nawet jeśli nie mają osobnych kontrolek formularza. `activeFilterCount = Object.keys(filters).length` już je uwzględnia; dodaj ukryte pola, aby ręczne użycie formularza nie usuwało kontekstu Pulpitu:

```tsx
{filters.stage ? <input type="hidden" name="stage" value={filters.stage} /> : null}
{filters.attention ? <input type="hidden" name="attention" value={filters.attention} /> : null}
```

- [ ] **Step 6: Uruchomić testy i walidację statyczną**

Run:

```bash
npm run test -- --run tests/ticket-filters.test.ts tests/data-store.test.ts
npm run typecheck
npm run lint
```

Expected: wszystkie testy filtrów i JSON przechodzą, a TypeScript potwierdza zgodność zapytań Prisma.

- [ ] **Step 7: Commit**

```bash
git add lib/ticket-filters.ts lib/ticket-query.ts lib/data-store-tickets.ts components/admin/ticket-filters.tsx tests/ticket-filters.test.ts tests/data-store.test.ts
git commit -m "feat: add dashboard ticket filters"
```

### Task 3: Zachować `resolvedAt` podczas zamykania rozwiązania

**Files:**
- Modify: `lib/data-store-tickets.ts:408-488`
- Test: `tests/data-store.test.ts:163-215`
- Test: `tests/prisma-integration.test.ts:88-139`

**Interfaces:**
- Consumes: istniejące `updateTicket(input)` dla Prisma i JSON.
- Produces: inwariant: `RESOLVED → CLOSED` zachowuje `resolvedAt`; ponowne otwarcie z `RESOLVED` lub `CLOSED` do aktywnego statusu czyści `resolvedAt`; ponowne `→ RESOLVED` ustawia nowy czas.

- [ ] **Step 1: Napisać failing test dla providera JSON**

Rozszerz test cyklu życia tak, aby najpierw zamknąć rozwiązane zgłoszenie:

```ts
const resolvedAt = resolved?.resolvedAt;
const confirmedClosed = await updateTicket({
  ticketId: ticket.id,
  actorId: admin!.id,
  status: "CLOSED",
  priority: ticket.priority
});
expect(confirmedClosed?.closedAt).toBeDefined();
expect(confirmedClosed?.resolvedAt).toBe(resolvedAt);
```

Następnie ponownie otwórz `confirmedClosed` do `IN_PROGRESS` i oczekuj `resolvedAt === null` oraz `closedAt === null`.

- [ ] **Step 2: Dodać ten sam kontrakt do integracji Prisma**

W `tests/prisma-integration.test.ts` po pierwszym `RESOLVED` dodaj:

```ts
const resolvedAt = resolved?.resolvedAt;
const confirmedClosed = await updateTicket({
  ticketId: first.id,
  actorId: reporter.id,
  status: "CLOSED",
  priority: first.priority
});
expect(confirmedClosed?.closedAt).toBeDefined();
expect(confirmedClosed?.resolvedAt).toBe(resolvedAt);

const reopenedAfterClose = await updateTicket({
  ticketId: first.id,
  actorId: reporter.id,
  status: "IN_PROGRESS",
  priority: first.priority
});
expect(reopenedAfterClose?.resolvedAt).toBeNull();
expect(reopenedAfterClose?.closedAt).toBeNull();
```

- [ ] **Step 3: Uruchomić test JSON i potwierdzić porażkę**

Run:

```bash
npm run test -- --run tests/data-store.test.ts
```

Expected: FAIL, ponieważ obecna logika czyści `resolvedAt` przy każdym wyjściu ze statusu `RESOLVED`, również do `CLOSED`.

- [ ] **Step 4: Poprawić minimalnie obie ścieżki aktualizacji**

Dodaj czysty warunek:

```ts
const nextResolvedAt =
  !statusChanged
    ? undefined
    : input.status === "RESOLVED"
      ? timestamp
      : input.status === "CLOSED"
        ? undefined
        : null;
```

Użyj `nextResolvedAt` w danych Prisma. W ścieżce JSON zastosuj równoważne przypisanie:

```ts
if (input.status === "RESOLVED") ticket.resolvedAt = timestamp;
else if (input.status !== "CLOSED") ticket.resolvedAt = null;
```

- [ ] **Step 5: Uruchomić testy obu providerów**

Run:

```bash
npm run test -- --run tests/data-store.test.ts
FIXIT_DATA_PROVIDER=prisma DATABASE_URL=postgresql://fixit:fixit@localhost:5433/fixit npm run test:integration
```

Expected: JSON przechodzi; integracja Prisma przechodzi, gdy lokalny PostgreSQL działa. Jeśli baza nie działa, uruchom ją przez `docker compose up -d postgres`, wykonaj migracje i powtórz komendę zamiast uznawać test za zaliczony na podstawie skipa.

- [ ] **Step 6: Commit**

```bash
git add lib/data-store-tickets.ts tests/data-store.test.ts tests/prisma-integration.test.ts
git commit -m "fix: preserve ticket resolution timestamp on close"
```

### Task 4: Zdefiniować kontrakt i czyste reguły domenowe Pulpitu

**Files:**
- Create: `lib/dashboard.ts`
- Modify: `lib/types.ts:195-231`
- Create: `tests/dashboard.test.ts`

**Interfaces:**
- Consumes: `Ticket`, `TicketPriority`, `TicketStatus` and `isTicketOverdue`, `getTicketSlaDeadline`.
- Produces: `DashboardQueueStage`, `DashboardTicketItem`, `DashboardAlertItem`, and nowy `DashboardData`.
- Produces: `DashboardSourceTicket`, `getDashboardWindowStart(now)`, `buildDashboardAlerts(tickets, storeCodes, now)`, `buildDashboardMyQueue(tickets, userId)`, `buildDashboardDailyCounts(tickets, now)`, `calculateAverageResolutionHours(tickets, now)`, `buildTopCategories(tickets, categories)`, `buildAgentWorkload(tickets, users)`.
- Constants: `DASHBOARD_DAYS = 30`, `DASHBOARD_ITEM_LIMIT = 5`, `DASHBOARD_STAGE_STATUSES`.

- [ ] **Step 1: Zdefiniować failing testy czystej domeny**

Utwórz `tests/dashboard.test.ts` z deterministycznym `now = new Date("2026-08-20T12:00:00.000Z")` i fabryką `makeTicket(overrides)`. Dodaj testy:

```ts
it("deduplicates and orders critical and overdue alerts", () => {
  const alerts = buildDashboardAlerts([
    makeTicket({ id: "both", priority: "CRITICAL", createdAt: "2026-08-19T00:00:00.000Z" }),
    makeTicket({ id: "critical", priority: "CRITICAL", createdAt: "2026-08-20T11:00:00.000Z" }),
    makeTicket({ id: "overdue", priority: "NORMAL", createdAt: "2026-08-18T00:00:00.000Z" }),
    makeTicket({ id: "done", status: "RESOLVED", priority: "CRITICAL" })
  ], new Map(), now);

  expect(alerts.criticalCount).toBe(2);
  expect(alerts.slaBreachedCount).toBe(2);
  expect(alerts.tickets.map((ticket) => ticket.id)).toEqual(["both", "critical", "overdue"]);
  expect(alerts.tickets[0]).toMatchObject({ isCritical: true, isSlaBreached: true });
});

it("limits the shared urgent list to five tickets without changing total counters", () => {
  const alerts = buildDashboardAlerts(
    Array.from({ length: 7 }, (_, index) => makeTicket({
      id: `critical-${index}`,
      priority: "CRITICAL",
      createdAt: "2026-08-20T11:00:00.000Z"
    })),
    new Map(),
    now
  );

  expect(alerts.criticalCount).toBe(7);
  expect(alerts.slaBreachedCount).toBe(0);
  expect(alerts.tickets).toHaveLength(5);
});

it("groups only the current assignee and limits every stage to five tickets", () => {
  const queue = buildDashboardMyQueue([
    ...Array.from({ length: 7 }, (_, index) => makeTicket({ id: `new-${index}`, assigneeId: "agent", status: "NEW" })),
    makeTicket({ id: "triaged", assigneeId: "agent", status: "TRIAGED" }),
    makeTicket({ id: "waiting-user", assigneeId: "agent", status: "WAITING_FOR_USER" }),
    makeTicket({ id: "waiting-vendor", assigneeId: "agent", status: "WAITING_FOR_VENDOR" }),
    makeTicket({ id: "other-agent", assigneeId: "other", status: "NEW" })
  ], "agent");

  expect(queue.new.count).toBe(8);
  expect(queue.new.tickets).toHaveLength(5);
  expect(queue.waiting.count).toBe(2);
  expect(queue.in_progress.count).toBe(0);
});

it("builds today plus the previous 29 UTC days and scopes the average to that window", () => {
  const tickets = [
    makeTicket({ id: "today", createdAt: "2026-08-20T08:00:00.000Z", resolvedAt: "2026-08-20T10:00:00.000Z" }),
    makeTicket({ id: "first-day", createdAt: "2026-07-22T08:00:00.000Z" }),
    makeTicket({ id: "too-old", createdAt: "2026-07-21T08:00:00.000Z", resolvedAt: "2026-07-21T10:00:00.000Z" })
  ];
  const daily = buildDashboardDailyCounts(tickets, now);

  expect(daily).toHaveLength(30);
  expect(daily[0]?.date).toBe("2026-07-22");
  expect(daily[29]?.date).toBe("2026-08-20");
  expect(calculateAverageResolutionHours(tickets, now)).toBe(2);
});

it("limits categories and excludes inactive or non-IT users from workload", () => {
  const tickets = [
    makeTicket({ id: "one", categoryId: "cat-a", assigneeId: "agent" }),
    makeTicket({ id: "two", categoryId: "cat-a", assigneeId: "agent" }),
    makeTicket({ id: "three", categoryId: "cat-b", assigneeId: "reporter" })
  ];
  expect(buildTopCategories(tickets, [
    { id: "cat-a", name: "Sprzęt" },
    { id: "cat-b", name: "Inne" }
  ])).toEqual([
    { categoryId: "cat-a", categoryName: "Sprzęt", count: 2 },
    { categoryId: "cat-b", categoryName: "Inne", count: 1 }
  ]);
  expect(buildAgentWorkload(tickets, [
    { id: "agent", name: "Agent", email: "agent@bagietka.pl", role: "AGENT", isActive: true },
    { id: "reporter", name: "Reporter", email: "reporter@bagietka.pl", role: "REPORTER", isActive: true }
  ])).toEqual([{ agentId: "agent", agentName: "Agent", openCount: 2 }]);
});

it("returns complete empty states for a dashboard without tickets", () => {
  expect(buildDashboardAlerts([], new Map(), now)).toEqual({
    criticalCount: 0,
    slaBreachedCount: 0,
    tickets: []
  });
  expect(buildDashboardMyQueue([], "agent")).toEqual({
    new: { count: 0, tickets: [] },
    waiting: { count: 0, tickets: [] },
    in_progress: { count: 0, tickets: [] }
  });
  const daily = buildDashboardDailyCounts([], now);
  expect(daily).toHaveLength(30);
  expect(daily.every((day) => day.created === 0 && day.resolved === 0)).toBe(true);
  expect(calculateAverageResolutionHours([], now)).toBeNull();
  expect(buildTopCategories([], [])).toEqual([]);
  expect(buildAgentWorkload([], [])).toEqual([]);
});
```

- [ ] **Step 2: Uruchomić test i potwierdzić brak modułu**

Run:

```bash
npm run test -- --run tests/dashboard.test.ts
```

Expected: FAIL z błędem braku eksportów z `lib/dashboard.ts`.

- [ ] **Step 3: Zdefiniować ograniczone typy Pulpitu**

W `lib/types.ts` zastąp dotychczasowy `DashboardData`:

```ts
export type DashboardQueueStage = "new" | "waiting" | "in_progress";

export type DashboardTicketItem = Pick<Ticket, "id" | "number" | "title" | "status" | "priority" | "createdAt"> & {
  storeCode?: string;
};

export type DashboardAlertItem = DashboardTicketItem & {
  isCritical: boolean;
  isSlaBreached: boolean;
  hoursOverdue: number | null;
};

export type DashboardData = {
  alerts: {
    criticalCount: number;
    slaBreachedCount: number;
    tickets: DashboardAlertItem[];
  };
  myQueue: Record<DashboardQueueStage, { count: number; tickets: DashboardTicketItem[] }>;
  analytics: {
    openTickets: number;
    avgResolutionHours: number | null;
    dailyTicketCounts: { date: string; created: number; resolved: number }[];
    topCategories: { categoryId: string; categoryName: string; count: number }[];
    agentWorkload: { agentId: string; agentName: string; openCount: number }[];
  };
};
```

- [ ] **Step 4: Zaimplementować czyste agregatory**

W `lib/dashboard.ts`:

```ts
import { COMPLETED_TICKET_STATUSES, getTicketSlaDeadline, isTicketOverdue } from "@/lib/ticket-sla";
import type { Category, DashboardAlertItem, DashboardData, DashboardQueueStage, Ticket, TicketPriority, TicketStatus, User } from "@/lib/types";

export const DASHBOARD_DAYS = 30;
export const DASHBOARD_ITEM_LIMIT = 5;
export const DASHBOARD_STAGE_STATUSES: Record<DashboardQueueStage, TicketStatus[]> = {
  new: ["NEW", "TRIAGED"],
  waiting: ["WAITING_FOR_USER", "WAITING_FOR_VENDOR"],
  in_progress: ["IN_PROGRESS"]
};

const priorityRank: Record<TicketPriority, number> = { CRITICAL: 4, HIGH: 3, NORMAL: 2, LOW: 1 };

export type DashboardSourceTicket = Omit<
  Pick<
    Ticket,
    "id" | "number" | "title" | "status" | "priority" | "createdAt" | "dueAt" | "resolvedAt" | "assigneeId" | "categoryId" | "storeId"
  >,
  "assigneeId" | "categoryId" | "storeId"
> & {
  assigneeId?: string;
  categoryId?: string;
  storeId?: string;
};

export function getDashboardWindowStart(now: Date): Date {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (DASHBOARD_DAYS - 1));
  return start;
}

function toDashboardTicketItem(ticket: DashboardSourceTicket, storeCodes = new Map<string, string>()) {
  return {
    id: ticket.id,
    number: ticket.number,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    createdAt: ticket.createdAt,
    storeCode: ticket.storeId ? storeCodes.get(ticket.storeId) : undefined
  };
}

export function buildDashboardAlerts(tickets: DashboardSourceTicket[], storeCodes: Map<string, string>, now: Date): DashboardData["alerts"] {
  const candidates: DashboardAlertItem[] = tickets.flatMap((ticket) => {
    const isCritical = ticket.priority === "CRITICAL" && !COMPLETED_TICKET_STATUSES.has(ticket.status);
    const isSlaBreached = isTicketOverdue(ticket, now);
    if (!isCritical && !isSlaBreached) return [];
    const deadline = getTicketSlaDeadline(ticket);
    return [{
      ...toDashboardTicketItem(ticket, storeCodes),
      isCritical,
      isSlaBreached,
      hoursOverdue: isSlaBreached ? Math.round(((now.getTime() - deadline.getTime()) / 3_600_000) * 10) / 10 : null
    }];
  });
  candidates.sort((a, b) => {
    const group = (item: DashboardAlertItem) => item.isCritical && item.isSlaBreached ? 0 : item.isCritical ? 1 : 2;
    return group(a) - group(b) || (b.hoursOverdue ?? -1) - (a.hoursOverdue ?? -1) || a.createdAt.localeCompare(b.createdAt);
  });
  return {
    criticalCount: candidates.filter((item) => item.isCritical).length,
    slaBreachedCount: candidates.filter((item) => item.isSlaBreached).length,
    tickets: candidates.slice(0, DASHBOARD_ITEM_LIMIT)
  };
}

export function buildDashboardMyQueue(tickets: DashboardSourceTicket[], userId: string): DashboardData["myQueue"] {
  return Object.fromEntries((Object.keys(DASHBOARD_STAGE_STATUSES) as DashboardQueueStage[]).map((stage) => {
    const matching = tickets
      .filter((ticket) => ticket.assigneeId === userId && DASHBOARD_STAGE_STATUSES[stage].includes(ticket.status))
      .sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority] || a.createdAt.localeCompare(b.createdAt));
    return [stage, { count: matching.length, tickets: matching.slice(0, DASHBOARD_ITEM_LIMIT).map((ticket) => toDashboardTicketItem(ticket)) }];
  })) as DashboardData["myQueue"];
}

export function buildDashboardDailyCounts(tickets: Array<Pick<DashboardSourceTicket, "createdAt" | "resolvedAt">>, now: Date): DashboardData["analytics"]["dailyTicketCounts"] {
  const start = getDashboardWindowStart(now);
  const counts = new Map<string, { created: number; resolved: number }>();
  for (let offset = 0; offset < DASHBOARD_DAYS; offset++) {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + offset);
    counts.set(date.toISOString().slice(0, 10), { created: 0, resolved: 0 });
  }
  for (const ticket of tickets) {
    const created = counts.get(ticket.createdAt.slice(0, 10));
    if (created) created.created += 1;
    if (ticket.resolvedAt) {
      const resolved = counts.get(ticket.resolvedAt.slice(0, 10));
      if (resolved) resolved.resolved += 1;
    }
  }
  return [...counts.entries()].map(([date, value]) => ({ date, ...value }));
}

export function calculateAverageResolutionHours(tickets: Array<Pick<DashboardSourceTicket, "createdAt" | "resolvedAt">>, now: Date): number | null {
  const start = getDashboardWindowStart(now).getTime();
  const durations = tickets.flatMap((ticket) => {
    if (!ticket.resolvedAt) return [];
    const resolvedAt = new Date(ticket.resolvedAt).getTime();
    if (resolvedAt < start || resolvedAt > now.getTime()) return [];
    return [(resolvedAt - new Date(ticket.createdAt).getTime()) / 3_600_000];
  });
  return durations.length === 0 ? null : Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) / 10;
}

export function buildTopCategories(tickets: DashboardSourceTicket[], categories: Array<Pick<Category, "id" | "name">>): DashboardData["analytics"]["topCategories"] {
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    if (ticket.categoryId) counts.set(ticket.categoryId, (counts.get(ticket.categoryId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([categoryId, count]) => ({ categoryId, categoryName: names.get(categoryId) ?? "Nieznana", count }))
    .sort((a, b) => b.count - a.count || a.categoryName.localeCompare(b.categoryName, "pl"))
    .slice(0, 8);
}

export function buildAgentWorkload(tickets: DashboardSourceTicket[], users: User[]): DashboardData["analytics"]["agentWorkload"] {
  const agents = new Map(users.filter((user) => user.isActive && (user.role === "AGENT" || user.role === "ADMIN")).map((user) => [user.id, user]));
  const counts = new Map<string, number>();
  for (const ticket of tickets) if (ticket.assigneeId && agents.has(ticket.assigneeId)) counts.set(ticket.assigneeId, (counts.get(ticket.assigneeId) ?? 0) + 1);
  return [...counts.entries()]
    .map(([agentId, openCount]) => ({ agentId, agentName: agents.get(agentId)?.name ?? agents.get(agentId)?.email ?? "Nieznany", openCount }))
    .sort((a, b) => b.openCount - a.openCount || a.agentName.localeCompare(b.agentName, "pl"));
}
```

- [ ] **Step 5: Uruchomić testy domenowe i statyczne**

Run:

```bash
npm run test -- --run tests/dashboard.test.ts
npm run typecheck
npm run lint
```

Expected: trzy grupy testów domenowych przechodzą, bez nieużywanych eksportów i bez ostrzeżeń ESLint.

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard.ts lib/types.ts tests/dashboard.test.ts
git commit -m "feat: define dashboard domain model"
```

### Task 5: Zbudować równoważny kontrakt danych Prisma i JSON

**Files:**
- Modify: `lib/data-store.ts:354-589`
- Modify: `app/admin/dashboard/page.tsx:12-35`
- Test: `tests/data-store.test.ts`
- Test: `tests/prisma-integration.test.ts`

**Interfaces:**
- Consumes: `getDashboardData(user: User): Promise<DashboardData>` called by the page.
- Consumes: aggregators from `lib/dashboard.ts` and query helpers from `lib/ticket-query.ts`.
- Produces: `DashboardData` with `alerts`, `myQueue`, and `analytics`; no `recentEvents` and no legacy `kpi` object.

- [ ] **Step 1: Napisać test kontraktu JSON**

W `tests/data-store.test.ts` dodaj blok `describe("getDashboardData")`, użyj `vi.useFakeTimers()` oraz `vi.setSystemTime("2026-08-20T12:00:00.000Z")`. Przygotuj fixture:

```ts
const { getDashboardData, readDatabase, writeDatabase } = await import("@/lib/data-store");
const database = await readDatabase();
const agent: User = { id: "dashboard-agent", name: "Dashboard Agent", email: "dashboard.agent@bagietka.pl", role: "AGENT", isActive: true };
const otherAgent: User = { id: "dashboard-other", name: "Other Agent", email: "other.agent@bagietka.pl", role: "AGENT", isActive: true };
database.users.push(agent, otherAgent);
const base = {
  id: "dashboard-base",
  number: "IT-2026-8000",
  title: "Dashboard fixture",
  description: "Fixture for dashboard aggregation.",
  status: "NEW" as const,
  priority: "NORMAL" as const,
  blocksWork: false,
  contact: "dashboard.agent@bagietka.pl",
  categoryId: "cat_other",
  reporterId: agent.id,
  assigneeId: agent.id,
  createdAt: "2026-08-20T08:00:00.000Z",
  updatedAt: "2026-08-20T08:00:00.000Z"
};
database.tickets.push(
  { ...base, id: "dashboard-alert", number: "IT-2026-8001", status: "IN_PROGRESS", priority: "CRITICAL", createdAt: "2026-08-19T00:00:00.000Z" },
  ...Array.from({ length: 7 }, (_, index) => ({ ...base, id: `dashboard-new-${index}`, number: `IT-2026-81${index}` })),
  { ...base, id: "dashboard-other-waiting", number: "IT-2026-8200", assigneeId: otherAgent.id, status: "WAITING_FOR_USER" },
  { ...base, id: "dashboard-resolved", number: "IT-2026-8300", status: "RESOLVED", resolvedAt: "2026-08-20T10:00:00.000Z" }
);
await writeDatabase(database);

const dashboard = await getDashboardData(agent);
expect(dashboard.alerts).toMatchObject({ criticalCount: 1, slaBreachedCount: 1 });
expect(dashboard.alerts.tickets).toHaveLength(1);
expect(dashboard.myQueue.new.count).toBe(7);
expect(dashboard.myQueue.new.tickets).toHaveLength(5);
expect(dashboard.myQueue.waiting.count).toBe(0);
expect(dashboard.analytics.dailyTicketCounts).toHaveLength(30);
expect(dashboard.analytics.avgResolutionHours).not.toBeNull();
expect("recentEvents" in dashboard).toBe(false);
expect(dashboard.alerts.tickets[0]).not.toHaveProperty("description");
expect(dashboard.alerts.tickets[0]).not.toHaveProperty("contact");
```

- [ ] **Step 2: Uruchomić test JSON i potwierdzić porażkę kontraktu**

Run:

```bash
npm run test -- --run tests/data-store.test.ts
```

Expected: FAIL, ponieważ `getDashboardData` nie przyjmuje użytkownika i zwraca stary kształt `kpi`/`recentEvents`.

- [ ] **Step 3: Zastąpić implementację JSON**

W gałęzi JSON:

```ts
export async function getDashboardData(user: User): Promise<DashboardData> {
  noStore();
  const now = new Date();
  if (!shouldUsePrisma()) {
    const database = await readDatabase();
    const storeCodes = new Map(database.stores.map((store) => [store.id, store.code]));
    const openTickets = database.tickets.filter((ticket) => !COMPLETED_TICKET_STATUSES.has(ticket.status));
    return {
      alerts: buildDashboardAlerts(openTickets, storeCodes, now),
      myQueue: buildDashboardMyQueue(openTickets, user.id),
      analytics: {
        openTickets: openTickets.length,
        avgResolutionHours: calculateAverageResolutionHours(database.tickets, now),
        dailyTicketCounts: buildDashboardDailyCounts(database.tickets, now),
        topCategories: buildTopCategories(openTickets, database.categories),
        agentWorkload: buildAgentWorkload(openTickets, database.users)
      }
    };
  }
```

`buildTopCategories` zwraca maksymalnie osiem kategorii, a `buildAgentWorkload` obejmuje wyłącznie aktywnych AGENTÓW/ADMINÓW z co najmniej jednym otwartym zgłoszeniem.

- [ ] **Step 4: Zaimplementować ograniczone zapytania Prisma**

Pobierz równolegle minimalne dane:

```ts
const [openRows, recentRows, categoryCounts, workloadCounts] = await Promise.all([
  db.ticket.findMany({
    where: buildOpenTicketWhere(),
    select: {
      id: true, number: true, title: true, status: true, priority: true,
      createdAt: true, dueAt: true, resolvedAt: true, assigneeId: true,
      categoryId: true, storeId: true,
      store: { select: { code: true } }
    }
  }),
  db.ticket.findMany({
    where: { OR: [{ createdAt: { gte: getDashboardWindowStart(now) } }, { resolvedAt: { gte: getDashboardWindowStart(now) } }] },
    select: { id: true, createdAt: true, resolvedAt: true }
  }),
  db.ticket.groupBy({ by: ["categoryId"], where: { ...buildOpenTicketWhere(), categoryId: { not: null } }, _count: { _all: true } }),
  db.ticket.groupBy({ by: ["assigneeId"], where: { ...buildOpenTicketWhere(), assigneeId: { not: null } }, _count: { _all: true } })
]);
```

Zmapuj daty Prisma do kontraktu domenowego i zbuduj mapę kodów sklepów:

```ts
const openTickets: DashboardSourceTicket[] = openRows.map(({ store, ...ticket }) => ({
  ...ticket,
  createdAt: ticket.createdAt.toISOString(),
  dueAt: ticket.dueAt?.toISOString() ?? null,
  resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
  assigneeId: ticket.assigneeId ?? undefined,
  categoryId: ticket.categoryId ?? undefined,
  storeId: ticket.storeId ?? undefined
}));
const storeCodes = new Map(openRows.flatMap((row) => row.storeId && row.store ? [[row.storeId, row.store.code] as const] : []));
const recentTickets = recentRows.map((ticket) => ({
  createdAt: ticket.createdAt.toISOString(),
  resolvedAt: ticket.resolvedAt?.toISOString() ?? null
}));
```

Posortuj `categoryCounts`, ogranicz do ośmiu i pobierz tylko odpowiadające im kategorie. Z `workloadCounts` pobierz tylko aktywnych użytkowników o roli AGENT lub ADMIN. Zachowaj deterministyczne sortowanie zgodne z helperami JSON:

```ts
const topCategoryCounts = [...categoryCounts]
  .sort((a, b) => b._count._all - a._count._all)
  .slice(0, 8);
const categoryIds = topCategoryCounts.flatMap((item) => item.categoryId ? [item.categoryId] : []);
const agentIds = workloadCounts.flatMap((item) => item.assigneeId ? [item.assigneeId] : []);
const [categories, agents] = await Promise.all([
  categoryIds.length > 0
    ? db.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
    : Promise.resolve([]),
  agentIds.length > 0
    ? db.user.findMany({
        where: { id: { in: agentIds }, isActive: true, role: { in: ["AGENT", "ADMIN"] } },
        select: { id: true, name: true, email: true }
      })
    : Promise.resolve([])
]);
const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
const agentNames = new Map(agents.map((agent) => [agent.id, agent.name ?? agent.email]));
const topCategories = topCategoryCounts
  .flatMap((item) => item.categoryId ? [{
    categoryId: item.categoryId,
    categoryName: categoryNames.get(item.categoryId) ?? "Nieznana",
    count: item._count._all
  }] : [])
  .sort((a, b) => b.count - a.count || a.categoryName.localeCompare(b.categoryName, "pl"));
const agentWorkload = workloadCounts
  .flatMap((item) => item.assigneeId && agentNames.has(item.assigneeId) ? [{
    agentId: item.assigneeId,
    agentName: agentNames.get(item.assigneeId)!,
    openCount: item._count._all
  }] : [])
  .sort((a, b) => b.openCount - a.openCount || a.agentName.localeCompare(b.agentName, "pl"));
```

Zwróć:

```ts
return {
  alerts: buildDashboardAlerts(openTickets, storeCodes, now),
  myQueue: buildDashboardMyQueue(openTickets, user.id),
  analytics: {
    openTickets: openTickets.length,
    avgResolutionHours: calculateAverageResolutionHours(recentTickets, now),
    dailyTicketCounts: buildDashboardDailyCounts(recentTickets, now),
    topCategories,
    agentWorkload
  }
};
```

Nie wykonuj zapytania o `TicketEvent` i nie mapuj żadnych pól spoza nowego kontraktu.

- [ ] **Step 5: Dodać integracyjny test Prisma**

W `tests/prisma-integration.test.ts` utwórz AGENTA, kategorię i trzy zgłoszenia przez Prisma: krytyczne po SLA przypisane do agenta, nowe przypisane do agenta i rozwiązane w ostatnich 30 dniach. Asercje:

```ts
const dashboardUser = {
  id: agent.id,
  name: agent.name,
  email: agent.email,
  role: agent.role,
  isActive: agent.isActive
};
const dashboard = await getDashboardData(dashboardUser);
expect(dashboard.alerts.criticalCount).toBe(1);
expect(dashboard.alerts.slaBreachedCount).toBe(1);
expect(dashboard.myQueue.new.count).toBe(1);
expect(dashboard.analytics.dailyTicketCounts).toHaveLength(30);
expect(dashboard.analytics.topCategories[0]?.count).toBeGreaterThan(0);
expect(dashboard.analytics.agentWorkload[0]).toMatchObject({ agentId: agent.id });
```

- [ ] **Step 6: Przekazać użytkownika ze strony**

W `app/admin/dashboard/page.tsx` zmień wywołanie na:

```ts
const dashboardData = await getDashboardData(user);
```

Zachowaj `requireUser`, `canUseAdmin`, przekierowanie oraz `dynamic = "force-dynamic"`.

- [ ] **Step 7: Uruchomić oba kontrakty danych**

Run:

```bash
npm run test -- --run tests/dashboard.test.ts tests/data-store.test.ts
FIXIT_DATA_PROVIDER=prisma DATABASE_URL=postgresql://fixit:fixit@localhost:5433/fixit npm run test:integration
npm run typecheck
npm run lint
```

Expected: JSON, czysta domena i realny PostgreSQL przechodzą; brak skipa integracji Prisma.

- [ ] **Step 8: Commit**

```bash
git add lib/data-store.ts app/admin/dashboard/page.tsx tests/data-store.test.ts tests/prisma-integration.test.ts
git commit -m "feat: provide operational dashboard data"
```

### Task 6: Zbudować zatwierdzony interfejs Pulpitu i testy E2E

**Files:**
- Create: `components/admin/dashboard-my-tickets.tsx`
- Modify: `components/admin/it-dashboard.tsx`
- Modify: `lib/seed.ts:30-110`
- Create: `tests/e2e/dashboard.spec.ts`
- Preserve: `app/admin/dashboard/error.tsx`

**Interfaces:**
- Consumes: `DashboardData` from Task 4 and the server result from Task 5.
- Produces: `DashboardMyTickets({ queue }: { queue: DashboardData["myQueue"] })`.
- Produces test IDs: `dashboard-alerts`, `dashboard-my-tickets`, `dashboard-analytics`, `dashboard-tab-new`, `dashboard-tab-waiting`, `dashboard-tab-in_progress`, `dashboard-tabpanel`.
- Navigation: alert counters use `attention=critical|overdue`; footer uses `attention=all`; queue footer uses `mine=1&stage=<stage>`.

- [ ] **Step 1: Przygotować deterministyczny fixture E2E**

W warunkowej tablicy `e2eTickets` w `lib/seed.ts` przypisz `t_001` i `t_002` do `usr_e2e_agent`, a następnie dodaj:

```ts
{
  id: "t_003",
  number: "IT-2026-0003",
  title: "E2E waiting ticket",
  description: "Ticket used by dashboard tab tests.",
  status: "WAITING_FOR_USER" as const,
  priority: "NORMAL" as const,
  blocksWork: false,
  contact: "sklep.waw01@bagietka.pl",
  categoryId: "cat_other",
  storeId: storeDirectory[0]?.id,
  reporterId: "usr_e2e_manager",
  assigneeId: "usr_e2e_agent",
  createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  updatedAt: new Date().toISOString()
},
{
  id: "t_004",
  number: "IT-2026-0004",
  title: "E2E critical overdue ticket",
  description: "Ticket used by dashboard alert tests.",
  status: "IN_PROGRESS" as const,
  priority: "CRITICAL" as const,
  blocksWork: true,
  contact: "sklep.waw01@bagietka.pl",
  categoryId: "cat_pos",
  storeId: storeDirectory[0]?.id,
  reporterId: "usr_e2e_manager",
  assigneeId: "usr_e2e_agent",
  dueAt: new Date(Date.now() - 3_600_000).toISOString(),
  createdAt: new Date(Date.now() - 8 * 3_600_000).toISOString(),
  updatedAt: new Date().toISOString()
}
```

- [ ] **Step 2: Napisać failing testy widoku, zakładek i mobile**

W `tests/e2e/dashboard.spec.ts` dodaj:

```ts
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { loginAs, resetDatabase } from "./helpers";

test.beforeEach(() => resetDatabase());

test("agent sees operational dashboard and switches personal stages", async ({ page }) => {
  await loginAs(page, "agent@bagietka.pl");
  await page.goto("/admin/dashboard");

  await expect(page.getByTestId("dashboard-alerts")).toContainText("Wymaga reakcji");
  await expect(page.getByTestId("dashboard-alerts")).toContainText("E2E critical overdue ticket");
  await expect(page.getByTestId("dashboard-alerts").locator('a[href="/admin/tickets?attention=critical"]')).toHaveCount(1);
  await expect(page.getByTestId("dashboard-alerts").locator('a[href="/admin/tickets?attention=overdue"]')).toHaveCount(1);
  await expect(page.getByTestId("dashboard-alerts").locator('a[href="/admin/tickets?attention=all"]')).toHaveCount(1);
  await expect(page.getByTestId("dashboard-tab-new")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("dashboard-tabpanel")).toContainText("E2E new ticket");

  await page.getByTestId("dashboard-tab-waiting").click();
  await expect(page.getByTestId("dashboard-tab-waiting")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("dashboard-tabpanel")).toContainText("E2E waiting ticket");
  await expect(page.getByRole("link", { name: /Zobacz wszystkie oczekujące/i })).toHaveAttribute("href", "/admin/tickets?mine=1&stage=waiting");
});

test("dashboard tabs support keyboard navigation and mobile has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, "agent@bagietka.pl");
  await page.goto("/admin/dashboard");
  await page.getByTestId("dashboard-tab-new").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("dashboard-tab-waiting")).toHaveAttribute("aria-selected", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("dashboard remains usable in dark mode", async ({ page }) => {
  await loginAs(page, "agent@bagietka.pl");
  await page.goto("/admin/dashboard");

  const root = page.locator("html");
  if (await root.evaluate((element) => element.classList.contains("dark"))) {
    await page.getByRole("button", { name: "Włącz jasny motyw" }).click();
  }
  await page.getByRole("button", { name: "Włącz ciemny motyw" }).click();

  await expect(root).toHaveClass(/dark/);
  await expect(page.getByTestId("dashboard-alerts")).toBeVisible();
  await expect(page.getByTestId("dashboard-my-tickets")).toBeVisible();
  await expect(page.getByTestId("dashboard-analytics")).toBeVisible();
});

test("administrator can access the IT dashboard", async ({ page }) => {
  await loginAs(page, "admin@bagietka.pl");
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page.getByTestId("dashboard-alerts")).toBeVisible();
});

test("dashboard renders all empty states", async ({ page }) => {
  await loginAs(page, "agent@bagietka.pl");
  const databasePath = path.join(process.cwd(), ".data", "fixit-db.json");
  const database = JSON.parse(fs.readFileSync(databasePath, "utf8"));
  database.tickets = [];
  fs.writeFileSync(databasePath, JSON.stringify(database, null, 2));

  await page.goto("/admin/dashboard");
  await expect(page.getByTestId("dashboard-alerts")).toContainText("Brak krytycznych zgłoszeń i naruszeń SLA");
  await expect(page.getByTestId("dashboard-tabpanel")).toContainText("Nie masz nowych zgłoszeń");
  await page.getByTestId("dashboard-tab-waiting").click();
  await expect(page.getByTestId("dashboard-tabpanel")).toContainText("Nie masz oczekujących zgłoszeń");
  await page.getByTestId("dashboard-tab-in_progress").click();
  await expect(page.getByTestId("dashboard-tabpanel")).toContainText("Nie masz zgłoszeń w realizacji");
  await expect(page.getByTestId("dashboard-analytics")).toContainText("Brak danych do wyświetlenia wykresu.");
  await expect(page.getByTestId("dashboard-analytics")).toContainText("Brak danych.");
  await expect(page.getByTestId("dashboard-analytics")).toContainText("Brak przypisanych zgłoszeń.");
});

test("store manager cannot access the IT dashboard", async ({ page }) => {
  await loginAs(page, "sklep.waw01@bagietka.pl");
  await page.goto("/admin/dashboard");
  await expect(page).not.toHaveURL(/\/admin\/dashboard/);
});
```

- [ ] **Step 3: Uruchomić E2E i potwierdzić brak nowych kontraktów**

Run:

```bash
npm run test:e2e -- tests/e2e/dashboard.spec.ts
```

Expected: FAIL z powodu brakujących sekcji/test ID i starego interfejsu Pulpitu.

- [ ] **Step 4: Zbudować dostępne zakładki osobistej kolejki**

W `components/admin/dashboard-my-tickets.tsx` utrzymuj `activeStage` z domyślną wartością `new`. Zdefiniuj stałą konfigurację:

```ts
const stages: Array<{ key: DashboardQueueStage; label: string }> = [
  { key: "new", label: "Nowe" },
  { key: "waiting", label: "Oczekujące" },
  { key: "in_progress", label: "W realizacji" }
];
```

Każdy przycisk otrzymuje `role="tab"`, `aria-selected`, `aria-controls="dashboard-my-panel"`, `id="dashboard-tab-<key>"` i odpowiadający test ID. Panel otrzymuje `role="tabpanel"`, `aria-labelledby`, `id="dashboard-my-panel"` i `data-testid="dashboard-tabpanel"`.

Obsłuż klawisze:

```ts
function onTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? stages.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + stages.length) % stages.length;
  const next = stages[nextIndex];
  setActiveStage(next.key);
  document.getElementById(`dashboard-tab-${next.key}`)?.focus();
}
```

Renderuj pięć otrzymanych rekordów jako linki `/admin/tickets/<id>`. Dla pustej listy użyj tekstu `Nie masz nowych zgłoszeń`, `Nie masz oczekujących zgłoszeń` albo `Nie masz zgłoszeń w realizacji`. Link końcowy buduj jako `/admin/tickets?mine=1&stage=${activeStage}`.

- [ ] **Step 5: Przebudować `ITDashboard` zgodnie z zatwierdzoną makietą**

W `components/admin/it-dashboard.tsx` usuń `recentEvents`, cztery stare `KPICard` i dolną sekcję aktywności. Zbuduj:

```tsx
<div className="space-y-8">
  <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,1fr)]">
    <DashboardAlerts alerts={data.alerts} />
    <DashboardMyTickets queue={data.myQueue} />
  </div>
  <DashboardAnalytics analytics={data.analytics} />
</div>
```

Dodaj wewnętrzny komponent alarmów o dokładnym wejściu `DashboardData["alerts"]`:

```tsx
function DashboardAlerts({ alerts }: { alerts: DashboardData["alerts"] }) {
  return (
    <section data-testid="dashboard-alerts" className="rounded-md border border-red-500/20 bg-white/75 p-4 dark:border-red-400/20 dark:bg-white/10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black"><AlertTriangle size={18} className="text-red-600 dark:text-red-400" />Wymaga reakcji</h2>
        <span className="text-xs font-bold text-ink/50 dark:text-paper/50">Cały zespół</span>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Link href="/admin/tickets?attention=critical" className="rounded-md border border-red-500/20 bg-red-500/5 p-3"><span className="text-xs font-black uppercase text-red-700 dark:text-red-300">Krytyczne</span><strong className="block text-2xl">{alerts.criticalCount}</strong></Link>
        <Link href="/admin/tickets?attention=overdue" className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3"><span className="text-xs font-black uppercase text-amber-700 dark:text-amber-300">SLA przekroczone</span><strong className="block text-2xl">{alerts.slaBreachedCount}</strong></Link>
      </div>
      {alerts.tickets.length === 0 ? <p className="py-8 text-center text-sm text-ink/55 dark:text-paper/55">Brak krytycznych zgłoszeń i naruszeń SLA</p> : (
        <div className="space-y-2">{alerts.tickets.map((ticket) => <DashboardAlertRow key={ticket.id} ticket={ticket} />)}</div>
      )}
      <Link href="/admin/tickets?attention=all" className="mt-4 inline-flex text-sm font-bold text-mint">Zobacz wszystkie wymagające reakcji →</Link>
    </section>
  );
}
```

`DashboardAlertRow` przyjmuje `{ ticket: DashboardAlertItem }`, renderuje link `/admin/tickets/${ticket.id}` oraz tekstowe etykiety wyliczone bez skrótów znaczeniowych:

```ts
const reasons = [
  ticket.isCritical ? "Krytyczne" : null,
  ticket.isSlaBreached && ticket.hoursOverdue !== null ? `SLA +${ticket.hoursOverdue} h` : null
].filter(Boolean).join(" · ");
```

Wiersz pokazuje `ticket.number`, `ticket.title`, opcjonalny `ticket.storeCode` i `reasons`; kolor jest tylko dodatkowym sygnałem.

Dodaj `DashboardAnalytics({ analytics }: { analytics: DashboardData["analytics"] })` z `data-testid="dashboard-analytics"`. W nagłówku pokaż tekst `Ostatnie 30 dni` oraz dwie kompaktowe wartości:

```tsx
<Metric label="Otwarte" value={analytics.openTickets} />
<Metric label="Średni czas rozwiązania" value={analytics.avgResolutionHours === null ? "---" : `${analytics.avgResolutionHours}h`} />
```

Pod nagłówkiem użyj siatki `xl:grid-cols-[minmax(0,1.6fr)_minmax(14rem,1fr)_minmax(14rem,1fr)]`. Do pierwszej kolumny przenieś istniejący `AreaChart`, zmieniając źródło na `analytics.dailyTicketCounts`. W drugiej przenieś pionowy `BarChart` i ustaw `analytics.topCategories`. W trzeciej użyj dotychczasowych poziomych pasków z `analytics.agentWorkload`. Zachowaj istniejący `CustomTooltip`, `formatShortDate`, legendę, obsługę jasnego/ciemnego motywu i tekstowe stany puste `Brak danych do wyświetlenia wykresu.`, `Brak danych.` oraz `Brak przypisanych zgłoszeń.`.

- [ ] **Step 6: Uruchomić focused E2E oraz statyczną walidację**

Run:

```bash
npm run test:e2e -- tests/e2e/dashboard.spec.ts
npm run typecheck
npm run lint
```

Expected: sześć testów Pulpitu przechodzi; odnośniki alarmów zachowują parametry filtrów, wszystkie stany puste są czytelne, tryb ciemny pokazuje wszystkie trzy sekcje, ADMIN ma dostęp, a STORE_MANAGER zostaje przekierowany; brak poziomego overflow na szerokości 390 px; lint nie zgłasza problemów hooków ani dostępności.

- [ ] **Step 7: Commit**

```bash
git add components/admin/dashboard-my-tickets.tsx components/admin/it-dashboard.tsx lib/seed.ts tests/e2e/dashboard.spec.ts
git commit -m "feat: redesign the IT dashboard"
```

### Task 7: Pełna weryfikacja i przygotowanie do przeglądu

**Files:**
- Modify: none unless a validation failure reveals an in-scope regression.
- Inspect: `docs/superpowers/specs/2026-08-20-dashboard-redesign-design.md`
- Inspect: `docs/superpowers/plans/2026-08-20-dashboard-redesign.md`

**Interfaces:**
- Consumes: all committed tasks and their tests.
- Produces: evidence that the branch is ready for code review; no push, merge, or deployment.

- [ ] **Step 1: Uruchomić pełny Vitest w Node 20.20.2**

```bash
source /home/dakos/.nvm/nvm.sh && nvm use >/dev/null
TMPDIR=/tmp npm run test
```

Expected: wszystkie testy jednostkowe i JSON przechodzą; PostgreSQL-only tests may remain skipped only in this general command.

- [ ] **Step 2: Uruchomić obowiązkową integrację PostgreSQL**

```bash
FIXIT_DATA_PROVIDER=prisma DATABASE_URL=postgresql://fixit:fixit@localhost:5433/fixit npm run test:integration
```

Expected: wszystkie testy w `tests/prisma-integration.test.ts` przechodzą bez skipa. Jeżeli port 5433 nie odpowiada, uruchom `docker compose up -d postgres`, wykonaj `npm run db:migrate:deploy` z tym samym `DATABASE_URL` i powtórz test.

- [ ] **Step 3: Uruchomić lint, typecheck i produkcyjny build**

```bash
npm run lint
npm run typecheck
npm run build
```

Expected: każda komenda kończy się kodem 0; build nie zgłasza błędu renderowania `/admin/dashboard`.

- [ ] **Step 4: Uruchomić pełny Playwright**

```bash
TMPDIR=/tmp npm run test:e2e
```

Expected: wszystkie testy przeglądarkowe przechodzą na projekcie `chromium`, w tym nowy `tests/e2e/dashboard.spec.ts`.

- [ ] **Step 5: Sprawdzić diff i zakres commita**

```bash
git diff origin/main...HEAD --check
git diff origin/main...HEAD --stat
git status --short
```

Expected: diff zawiera tylko zatwierdzoną specyfikację, plan, implementację Pulpitu i testy. `.superpowers/` oraz `refaktor.md` pozostają nieśledzone i nie są staged.

- [ ] **Step 6: Wykonać przegląd przed integracją**

Uruchom `superpowers:requesting-code-review` i sprawdź zgodność implementacji z kryteriami akceptacji specyfikacji. Usuń wyłącznie potwierdzone problemy w zakresie Pulpitu, ponownie uruchamiając dotknięte testy oraz pełne bramy z kroków 1–4.

- [ ] **Step 7: Zakończyć bez operacji zdalnych**

Zaraportuj użytkownikowi nazwę gałęzi, listę commitów, dokładne wyniki walidacji i pozostałe ryzyka. Nie wykonuj `git push`, merge do `main` ani wdrożenia Railway bez nowego, jednoznacznego polecenia wskazującego zdalny cel.
