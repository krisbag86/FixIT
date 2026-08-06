import { Filter } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { TicketCard } from "@/components/ticket-card";
import { requireUser } from "@/lib/auth";
import { getTicketListPageData } from "@/lib/data-store";
import { activeTicketStatuses, statusLabels } from "@/lib/labels";
import { buildTicketListHref, getTicketListCursor, parseTicketListFilters, type TicketListSearchParams } from "@/lib/ticket-filters";

export default async function TicketsPage({ searchParams }: { searchParams: Promise<TicketListSearchParams> }) {
  const user = await requireUser();
  const params = await searchParams;
  const filters = parseTicketListFilters(params);
  const page = await getTicketListPageData(user, filters, { cursor: getTicketListCursor(params) });

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-black">Moje zgłoszenia</h1>
          <p className="mt-2 text-ink/65 dark:text-paper/65">
            Lista spraw, które możesz śledzić zgodnie ze swoją rolą.
          </p>
        </div>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <Filter size={18} className="text-ink/50 dark:text-paper/50" />
          <input
            name="q"
            defaultValue={filters.query ?? ""}
            placeholder="Szukaj zgłoszeń"
            className="h-10 min-w-52 rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper"
            aria-label="Szukaj zgłoszeń"
          />
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="h-10 min-w-48 rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper"
          >
            <option value="">Wszystkie statusy</option>
            {activeTicketStatuses.map((item) => (
              <option key={item} value={item}>
                {statusLabels[item]}
              </option>
            ))}
          </select>
          <button className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-bold text-white dark:bg-paper dark:text-ink" type="submit">
            Filtruj
          </button>
          <a href="/tickets" className="px-2 text-sm font-bold text-ink/65 hover:text-ink dark:text-paper/65 dark:hover:text-paper">
            Wyczyść
          </a>
        </form>
      </div>

      {page.tickets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {page.tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              href={`/tickets/${ticket.id}`}
              reporter={page.users.find((item) => item.id === ticket.reporterId)}
              assignee={page.users.find((item) => item.id === ticket.assigneeId)}
              category={page.categories.find((item) => item.id === ticket.categoryId)}
              store={page.stores.find((item) => item.id === ticket.storeId)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          variant="tickets"
          description={filters.status || filters.query ? "Brak zgłoszeń dla wybranych filtrów. Zmień filtr lub utwórz nowe zgłoszenie." : "Zmień filtr albo utwórz pierwsze zgłoszenie."}
          actionHref="/tickets/new"
          actionLabel="Zgłoś awarię"
        />
      )}
      {page.hasMore ? (
        <div className="mt-6 flex justify-end">
          <a
            href={buildTicketListHref("/tickets", params, page.nextCursor)}
            className="inline-flex h-10 items-center justify-center rounded-md border border-black/10 px-4 text-sm font-bold text-ink/70 hover:border-mint hover:text-ink dark:border-white/10 dark:text-paper/70 dark:hover:text-paper"
          >
            Następna strona
          </a>
        </div>
      ) : null}
    </AppShell>
  );
}
