import { redirect } from "next/navigation";
import { Filter, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { AppShell } from "@/components/app-shell";
import { TicketCard } from "@/components/ticket-card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { getTicketListPageData } from "@/lib/data-store";
import { activeTicketStatuses, priorityLabels, statusLabels, ticketPriorities } from "@/lib/labels";
import { buildTicketListHref, getTicketListCursor, parseTicketListFilters, type TicketListSearchParams } from "@/lib/ticket-filters";
import { canUseAdmin } from "@/lib/permissions";

export default async function AdminTicketsPage({
  searchParams
}: {
  searchParams: Promise<TicketListSearchParams>;
}) {
  const user = await requireUser();

  if (!canUseAdmin(user)) {
    redirect("/tickets");
  }

  const params = await searchParams;
  const filters = parseTicketListFilters(params);
  const page = await getTicketListPageData(user, filters, {
    cursor: getTicketListCursor(params),
    includeFilterOptions: true,
    includeQueueSummary: true
  });
  const usersById = new Map(page.users.map((item) => [item.id, item]));
  const categoriesById = new Map(page.categories.map((item) => [item.id, item]));
  const storesById = new Map(page.stores.map((item) => [item.id, item]));

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-mint">
            <LayoutDashboard size={20} />
            <span className="text-sm font-black uppercase">Panel IT</span>
          </div>
          <h1 className="text-3xl font-black">Kolejka zgłoszeń</h1>
          <p className="mt-2 text-ink/65 dark:text-paper/65">Wspólna kolejka dla agentów i administratorów.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric label="Otwarte" value={page.openTickets} />
          <Metric label="Krytyczne" value={page.criticalTickets} />
          <Metric label="W filtrze" value={page.tickets.length} />
        </div>
      </div>

      <AdminNav user={user} currentPath="/admin/tickets" />

      <form method="get" className="control-panel mb-5 flex flex-wrap items-center gap-2 rounded-md p-3">
        <Filter size={18} className="text-ink/50 dark:text-paper/50" />
        <input
          name="q"
          type="search"
          defaultValue={filters.query ?? ""}
          placeholder="Szukaj numeru, tytułu lub opisu"
          className={`${filterClass} min-w-64`}
          aria-label="Szukaj ticketów"
        />
        <select name="status" aria-label="Filtruj po statusie" defaultValue={filters.status ?? ""} className={filterClass}>
          <option value="">Status</option>
          {activeTicketStatuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
        <select name="priority" aria-label="Filtruj po priorytecie" defaultValue={filters.priority ?? ""} className={filterClass}>
          <option value="">Priorytet</option>
          {ticketPriorities.map((priority) => (
            <option key={priority} value={priority}>
              {priorityLabels[priority]}
            </option>
          ))}
        </select>
        <select name="assignee" aria-label="Filtruj po wykonawcy" defaultValue={filters.assigneeId ?? ""} className={filterClass}>
          <option value="">Wykonawca</option>
          {page.users
            .filter((item) => item.isActive && (item.role === "AGENT" || item.role === "ADMIN"))
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
        <select name="store" aria-label="Filtruj po sklepie" defaultValue={filters.storeId ?? ""} className={filterClass}>
          <option value="">Sklep</option>
          {page.stores
            .filter((item) => item.isActive)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} — {item.name}
              </option>
            ))}
        </select>
        <select name="category" aria-label="Filtruj po kategorii" defaultValue={filters.categoryId ?? ""} className={filterClass}>
          <option value="">Kategoria</option>
          {page.categories
            .filter((item) => item.isActive)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
        <label className={checkLabelClass}>
          <input type="checkbox" name="mine" value="1" defaultChecked={filters.mine} />
          Moje
        </label>
        <label className={checkLabelClass}>
          <input type="checkbox" name="unassigned" value="1" defaultChecked={filters.unassigned} />
          Nieprzypisane
        </label>
        <label className={checkLabelClass}>
          <input type="checkbox" name="overdue" value="1" defaultChecked={filters.overdue} />
          Po SLA
        </label>
        <button className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-bold text-white dark:bg-paper dark:text-ink" type="submit">
          Filtruj
        </button>
        <Link href="/admin/tickets" className="inline-flex h-10 items-center justify-center rounded-md px-3 text-sm font-bold text-ink/65 hover:text-ink dark:text-paper/65 dark:hover:text-paper">
          Wyczyść
        </Link>
      </form>

      {page.tickets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {page.tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              href={`/admin/tickets/${ticket.id}`}
              reporter={usersById.get(ticket.reporterId)}
              assignee={usersById.get(ticket.assigneeId ?? "")}
              category={categoriesById.get(ticket.categoryId)}
              store={storesById.get(ticket.storeId ?? "")}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          variant="search"
          title="Brak wyników"
          description={Object.keys(filters).length > 0 ? "Zmień filtry albo wyczyść wyszukiwanie." : "Kolejka nie zawiera jeszcze żadnych zgłoszeń."}
          actionHref="/admin/tickets"
          actionLabel="Wyczyść filtry"
        />
      )}
      {page.hasMore ? (
        <div className="mt-6 flex justify-end">
          <Link
            href={buildTicketListHref("/admin/tickets", params, page.nextCursor)}
            className="inline-flex h-10 items-center justify-center rounded-md border border-black/10 px-4 text-sm font-bold text-ink/70 hover:border-mint hover:text-ink dark:border-white/10 dark:text-paper/70 dark:hover:text-paper"
          >
            Następna strona
          </Link>
        </div>
      ) : null}
    </AppShell>
  );
}

const filterClass =
  "h-10 min-w-40 rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper";

const checkLabelClass =
  "inline-flex h-10 items-center gap-2 rounded-md border border-black/10 px-3 text-sm font-semibold text-ink/70 dark:border-white/10 dark:text-paper/70";

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-black/10 bg-white/75 px-4 py-3 text-right dark:border-white/10 dark:bg-white/10">
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-bold uppercase text-ink/50 dark:text-paper/50">{label}</div>
    </div>
  );
}
