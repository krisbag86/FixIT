# Plan: Dashboard kierownika sklepu + Widok Kanban dla IT

## 1. Podsumowanie

Dwie nowe funkcje rozszerzajace mozliwosci aplikacji FixIT Helpdesk:

| Funkcja | Dla kogo | Cel |
|---|---|---|
| Dashboard kierownika sklepu | Rola `STORE_MANAGER` | Widok metryk i ticketow wlasnego sklepu |
| Widok Kanban dla IT | Role `AGENT` / `ADMIN` | Wizualna tablica ticketow z przeciaganiem |

---

## 2. Dashboard kierownika sklepu

### 2.1. Cel

Kierownik sklepu (`STORE_MANAGER`) potrzebuje szybkiego wgladu w sprawy swojego sklepu bez przegladania listy wszystkich ticketow. Obecnie ma tylko liste "/tickets" z filtrowaniem po `storeId` (dzieki `listVisibleTickets`).

### 2.2. Co dokladnie bedzie widzial

Dedykowana strona `/store` (dostepna z navbara), ktora pokazuje:

1. **Karty metryk** (wzorowane na `/admin/tickets`):
   - Otwarte tickety (status != RESOLVED/CLOSED/CANCELLED)
   - Krytyczne (priority === "CRITICAL")
   - Blokujace sprzedaz (blocksWork === true)
   - Rozwiazane dzisiaj

2. **Lista aktywnych ticketow** sklepu (z `listVisibleTickets` juz dziala):
   - Filtry: status, priorytet
   - Sortowanie: po update
   - Karty `TicketCard` (istniejacy komponent)

3. **Ostatnie zdarzenia** (ostatnie 5 eventow dla ticketow sklepu):
   - Kto, co, kiedy

### 2.3. Sciezka implementacji

#### Krok 1: Przygotowanie data-store

**Plik:** `lib/data-store.ts`

Dodac funkcje `getStoreDashboard(storeId: string)`:

```typescript
export async function getStoreDashboard(storeId: string): Promise<{
  openTickets: number;
  criticalTickets: number;
  blockingTickets: number;
  resolvedToday: number;
  recentEvents: TicketEvent[];
}> {
  // JSON branch: filter database.tickets by storeId
  // Prisma branch: db.ticket.findMany({ where: { storeId } })
}
```

**Szczegoly implementacji:**
- `openTickets`: tickets.filter(t => t.storeId === storeId && !isResolved(t.status))
- `criticalTickets`: tickets.filter(t => t.storeId === storeId && t.priority === "CRITICAL")
- `blockingTickets`: tickets.filter(t => t.storeId === storeId && t.blocksWork)
- `resolvedToday`: tickets.filter(t => t.storeId === storeId && t.resolvedAt?.startsWith(today))
- `recentEvents`: events.filter(e => ticketIds.includes(e.ticketId)).sort(desc).slice(0, 5)

**Prisma:**
```typescript
if (shouldUsePrisma()) {
  const db = await getPrisma();
  const storeTickets = await db.ticket.findMany({ where: { storeId } });
  const today = new Date().toISOString().slice(0, 10);
  // ... obliczenia ...
}
```

#### Krok 2: Nowa strona `/store/page.tsx`

**Plik:** `app/store/page.tsx`

Server component wzorowany na `app/tickets/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { Store, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { TicketCard } from "@/components/ticket-card";
import { requireUser } from "@/lib/auth";
import { getStoreDashboard, listVisibleTickets, readDatabase } from "@/lib/data-store";
import { formatDateTime } from "@/lib/format";
import type { TicketPriority, TicketStatus } from "@/lib/types";

export default async function StoreDashboardPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; priority?: string }>;
}) {
  const user = await requireUser();

  // Tylko STORE_MANAGER i ADMIN/AGENT (dla wgladu)
  if (user.role !== "STORE_MANAGER" && user.role !== "ADMIN" && user.role !== "AGENT") {
    redirect("/tickets");
  }

  const storeId = user.storeId;
  if (!storeId) {
    redirect("/tickets");
  }

  const params = await searchParams;
  const [dashboard, database] = await Promise.all([
    getStoreDashboard(storeId),
    readDatabase()
  ]);

  const allTickets = await listVisibleTickets(user);
  const tickets = allTickets.filter(t => {
    const statusMatch = !params.status || t.status === params.status;
    const priorityMatch = !params.priority || t.priority === params.priority;
    return statusMatch && priorityMatch;
  });

  const store = database.stores.find(s => s.id === storeId);

  // ... render ...
}
```

**Szablon (JSX):**
- Header: "Sklep: WAW01 - Bagietka Warszawa Centrum"
- 4 karty metryk (2x2 grid)
- Lista ticketow (grid podobny do /tickets)
- Sekcja ostatnich zdarzen (prawa kolumna lub pod lista)

#### Krok 3: Nawigacja w `app-shell.tsx`

**Plik:** `components/app-shell.tsx`

Dodac link do `/store` dla `STORE_MANAGER` w nav barze:

```typescript
{user.role === "STORE_MANAGER" && user.storeId ? (
  <NavLink href="/store" icon={<Store size={17} />}>
    Moj sklep
  </NavLink>
) : null}
```

#### Krok 4: Walidacja

- `npm run typecheck` — bez bledow
- `npm run test` — 32 passed / 1 skipped
- Ręczne: zaloguj jako Kasia Kierownik (`sklep.waw01@bagietka.pl`), sprawdz widok `/store`

### 2.4. Pliki do zmiany

| Plik | Operacja |
|---|---|
| `lib/data-store.ts` | Dodac `getStoreDashboard()` |
| `app/store/page.tsx` | Nowy plik |
| `components/app-shell.tsx` | Dodac link "Moj sklep" |

---

## 3. Widok Kanban dla IT

### 3.1. Cel

Agent/Admin IT potrzebuje wizualnego widoku tablicy (kanban) dla ticketow, z mozliwoscia przeciagania miedzy kolumnami statusow. To przyspiesza zarzadanie kolejka i daje lepszy poglad niz lista.

### 3.2. Co dokladnie bedzie widzial

Dedykowana strona `/admin/kanban` (link w `AdminNav`), ktora pokazuje:

1. **Kolumny** dla kazdego statusu (opcjonalnie tylko aktywne: NEW, TRIAGED, IN_PROGRESS, WAITING_FOR_USER, WAITING_FOR_VENDOR):
   - Naglowek z nazwa statusu i licznikiem
   - Karty ticketow w kolumnie
   - Mozliwosc przeciagniecia karty do innej kolumny

2. **Karta ticketu** w Kanban:
   - Numer, tytul (skrocony)
   - Priorytet (kolorowy badge)
   - Assignee (avatard/nazwa)
   - Czas od utworzenia
   - Blokowanie sprzedazy (ikonka)

3. **Drag & Drop**:
   - Po upuszczeniu w nowej kolumnie -> wywoluje `updateTicketAction` z nowym statusem
   - Optymistyczne UI (na razie moze byc pelne odswiezenie strony)

### 3.3. Sciezka implementacji

#### Krok 1: Backend data-store — funkcja `updateTicketStatus`

**Plik:** `lib/data-store.ts`

`updateTicket` juz istnieje i obsluguje zmiane statusu. Nie trzeba dodawac nowej funkcji — wystarczy uzyc istniejacej.

#### Krok 2: Server action dla Kanban

**Plik:** `app/admin/actions.ts`

Dodac akcje:

```typescript
export async function moveTicketKanbanAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user, "ticket:update")) {
    throw new Error("Brak uprawnien.");
  }

  const ticketId = String(formData.get("ticketId") ?? "");
  const newStatus = String(formData.get("status") ?? "") as TicketStatus;

  // Pobierz aktualny ticket, zeby zachowac priority i assignee
  const ticket = await findTicket(ticketId);
  if (!ticket) throw new Error("Ticket nie istnieje.");

  await updateTicket({
    ticketId,
    actorId: user.id,
    status: newStatus,
    priority: ticket.priority,
    assigneeId: ticket.assigneeId
  });

  revalidatePath("/admin/kanban");
  revalidatePath("/admin/tickets");
}
```

#### Krok 3: Komponent KanbanBoard (kliencki)

**Plik:** `components/admin/kanban-board.tsx`

Nowy komponent kliencki z `"use client"`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import type { Ticket, TicketStatus, User } from "@/lib/types";

// Konfiguracja kolumn
const KANBAN_COLUMNS: { status: TicketStatus; label: string }[] = [
  { status: "NEW", label: "Nowe" },
  { status: "TRIAGED", label: "Zweryfikowane" },
  { status: "IN_PROGRESS", label: "W trakcie" },
  { status: "WAITING_FOR_USER", label: "Czeka na uzytk." },
  { status: "WAITING_FOR_VENDOR", label: "Czeka na dostawce" },
  { status: "RESOLVED", label: "Rozwiazane" },
  { status: "CLOSED", label: "Zamkniete" },
  { status: "CANCELLED", label: "Anulowane" },
];

export function KanbanBoard({
  tickets,
  users
}: {
  tickets: Ticket[];
  users: User[];
}) {
  const router = useRouter();
  const [draggedTicket, setDraggedTicket] = useState<string | null>(null);

  const columns = KANBAN_COLUMNS.map(col => ({
    ...col,
    tickets: tickets.filter(t => t.status === col.status).sort(prioritySort)
  }));

  async function handleDrop(ticketId: string, newStatus: TicketStatus) {
    const fd = new FormData();
    fd.set("ticketId", ticketId);
    fd.set("status", newStatus);

    await fetch("/admin/kanban/move", {
      method: "POST",
      body: fd
    });

    router.refresh();
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map(col => (
        <div
          key={col.status}
          className="min-w-[16rem] flex-1 rounded-md border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            const id = e.dataTransfer.getData("text/ticket-id");
            if (id) handleDrop(id, col.status);
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold">{col.label}</h3>
            <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-bold dark:bg-white/10">
              {col.tickets.length}
            </span>
          </div>

          <div className="space-y-2">
            {col.tickets.map(ticket => (
              <KanbanCard
                key={ticket.id}
                ticket={ticket}
                assignee={users.find(u => u.id === ticket.assigneeId)}
                onDragStart={setDraggedTicket}
              />
            ))}
            {col.tickets.length === 0 && (
              <div className="py-8 text-center text-xs text-ink/40 dark:text-paper/40">
                Brak
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Card component:**

```typescript
function KanbanCard({
  ticket,
  assignee,
  onDragStart
}: {
  ticket: Ticket;
  assignee?: User;
  onDragStart: (id: string | null) => void;
}) {
  const hoursAgo = Math.round(
    (Date.now() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60)
  );

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData("text/ticket-id", ticket.id);
        onDragStart(ticket.id);
      }}
      onDragEnd={() => onDragStart(null)}
      className="cursor-grab rounded-md border border-black/10 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing dark:border-white/10 dark:bg-white/10"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-mint">{ticket.number}</span>
        <PriorityBadge priority={ticket.priority} />
      </div>
      <p className="text-sm font-semibold leading-snug line-clamp-2">{ticket.title}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-ink/55 dark:text-paper/55">
        <span>{assignee?.name ?? "Nieprzypisany"}</span>
        <span>{hoursAgo}h</span>
      </div>
    </div>
  );
}

function prioritySort(a: Ticket, b: Ticket): number {
  const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
  return (order[a.priority] ?? 99) - (order[b.priority] ?? 99);
}
```

#### Krok 4: Strona `/admin/kanban/page.tsx`

**Plik:** `app/admin/kanban/page.tsx`

Server component z lista wszystkich ticketow:

```typescript
import { redirect } from "next/navigation";
import { Columns3 } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { KanbanBoard } from "@/components/admin/kanban-board";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { listVisibleTickets, readDatabase } from "@/lib/data-store";
import { canUseAdmin } from "@/lib/permissions";

export default async function KanbanPage() {
  const user = await requireUser();

  if (!canUseAdmin(user)) {
    redirect("/tickets");
  }

  const database = await readDatabase();
  const tickets = await listVisibleTickets(user);

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-mint">
          <Columns3 size={20} />
          <span className="text-sm font-black uppercase">Panel IT</span>
        </div>
        <h1 className="text-3xl font-black">Kanban</h1>
        <p className="mt-2 text-ink/65 dark:text-paper/65">
          Tablica zgloszen — przeciagnij karte, aby zmienic status.
        </p>
      </div>

      <AdminNav user={user} currentPath="/admin/kanban" />
      <KanbanBoard tickets={tickets} users={database.users} />
    </AppShell>
  );
}
```

#### Krok 5: API route dla move (uproszczony)

Zamiast tworzyc oddzielna server action, mozna uzyc tej w `app/admin/actions.ts` z POST do `/admin/kanban/move`:

**Plik:** `app/admin/kanban/move/route.ts`

```typescript
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { findTicket, updateTicket } from "@/lib/data-store";
import { can } from "@/lib/permissions";
import type { TicketStatus } from "@/lib/types";

export async function POST(request: Request): Promise<Response> {
  const user = await requireUser();

  if (!can(user, "ticket:update")) {
    return new Response("Brak uprawnien.", { status: 403 });
  }

  const fd = await request.formData();
  const ticketId = String(fd.get("ticketId") ?? "");
  const newStatus = String(fd.get("status") ?? "") as TicketStatus;

  const ticket = await findTicket(ticketId);
  if (!ticket) {
    return new Response("Ticket nie istnieje.", { status: 404 });
  }

  await updateTicket({
    ticketId,
    actorId: user.id,
    status: newStatus,
    priority: ticket.priority,
    assigneeId: ticket.assigneeId
  });

  revalidatePath("/admin/kanban");
  revalidatePath("/admin/tickets");

  return new Response(null, { status: 204 });
}
```

#### Krok 6: Nawigacja w `AdminNav`

**Plik:** `components/admin/admin-nav.tsx`

Dodac link "Kanban" (ikona `Columns3`) miedzy "Tickety" a "Raporty":

```typescript
{ href: "/admin/kanban", label: "Kanban", icon: Columns3, adminOnly: false },
```

#### Krok 7: Walidacja

- `npm run typecheck` — bez bledow
- Ręczne: zaloguj jako agent/admin, sprawdz widok `/admin/kanban`
- Przeciagnij karte miedzy kolumnami, sprawdz czy status sie zmienil

### 3.4. Pliki do zmiany

| Plik | Operacja |
|---|---|
| `app/admin/kanban/page.tsx` | Nowy plik |
| `app/admin/kanban/move/route.ts` | Nowy plik |
| `components/admin/kanban-board.tsx` | Nowy plik (komponent kliencki) |
| `components/admin/admin-nav.tsx` | Dodac link "Kanban" |

---

## 4. Zależności między funkcjami

Funkcje sa niezalezne — mozna je implementowac w dowolnej kolejnosci.

```
Dashboard managera          Kanban
      |                        |
  lib/data-store.ts       app/admin/kanban/*
  app/store/page.tsx      components/admin/kanban-board.tsx
  components/app-shell    app/admin/actions.ts
```

---

## 5. Szacowany czas implementacji (razem: ~5-7h)

| Etap | Opis | Czas |
|---|---|---|
| 2.1 | `getStoreDashboard()` w data-store | 30min |
| 2.2 | `/store/page.tsx` | 45min |
| 2.3 | Link w app-shell.tsx | 10min |
| 3.1 | Server action / route dla move | 20min |
| 3.2 | Komponent KanbanBoard | 1.5h |
| 3.3 | `/admin/kanban/page.tsx` | 30min |
| 3.4 | API route move | 20min |
| 3.5 | Link w admin-nav.tsx | 10min |
| | Walidacja (typecheck, testy) | 30min |
| | **Razem** | **~5h** |

---

## 6. Kryteria akceptacji

### Dashboard kierownika sklepu

- [ ] `STORE_MANAGER` widzi link "Moj sklep" w nav barze
- [ ] Strona `/store` pokazuje metryki dla sklepu kierownika
- [ ] Lista ticketow jest filtrowana po storeId
- [ ] `REPORTER` nie ma dostepu do `/store` (redirect)
- [ ] Oba runty dzialaja (JSON + Prisma)

### Widok Kanban

- [ ] Link "Kanban" w admin nav
- [ ] Strona `/admin/kanban` pokazuje kolumny statusow
- [ ] Karty sa posortowane po priorytecie w kazdej kolumnie
- [ ] Przeciagniecie karty zmienia status ticketu
- [ ] Po zmianie statusu strona sie odswieza
- [ ] Agent i admin maja dostep
- [ ] Oba runty dzialaja (JSON + Prisma)

---

## 7. Testy

### Dashboard managera

Dodac test w `tests/data-store.test.ts`:

```typescript
it("getStoreDashboard returns correct metrics for store_waw01", async () => {
  const dashboard = await getStoreDashboard("store_waw01");
  expect(dashboard.openTickets).toBeGreaterThan(0);
  expect(dashboard.criticalTickets).toBeDefined();
});
```

### Kanban

Test e2e w `tests/e2e/kanban.spec.ts`:

```typescript
// Zaloguj jako admin
// Przejdz do /admin/kanban
// Sprawdz czy kolumny sa widoczne
// Uzyj dragAndDrop do przeniesienia karty
// Sprawdz czy status sie zmienil
```

---

## 8. Uwagi techniczne

- **Kanban bez biblioteki DnD**: Uzywamy natywnego HTML5 Drag & Drop API. To wystarczy dla MVP. W przyszlosci mozna dodac @dnd-kit.
- **Brak websocketow**: Po przeciagnieciu nastepuje pelne odswiezenie strony (`router.refresh()`). W przyszlosci mozna dodac real-time.
- **Store Dashboard korzysta z istniejacych funkcji**: `listVisibleTickets` juz filtruje po `storeId` dla `STORE_MANAGER` — nie trzeba zmieniac logiki widocznosci.
