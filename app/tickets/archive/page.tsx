import Link from "next/link";
import { Archive, Filter } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AppShell } from "@/components/app-shell";
import { TicketCard } from "@/components/ticket-card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { getTicketListPageData } from "@/lib/data-store";
import { archivedTicketStatuses, statusLabels } from "@/lib/labels";
import { buildTicketListHref, getTicketListCursor, parseTicketListFilters, type TicketListSearchParams } from "@/lib/ticket-filters";
import { canUseAdmin } from "@/lib/permissions";

export default async function TicketArchivePage({
  searchParams
}: {
  searchParams: Promise<TicketListSearchParams>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const filters = { ...parseTicketListFilters(params), archived: true };
  const page = await getTicketListPageData(user, filters, { cursor: getTicketListCursor(params) });
  const admin = canUseAdmin(user);
  const ticketPath = admin ? "/admin/tickets" : "/tickets";
  const usersById = new Map(page.users.map((item) => [item.id, item]));
  const categoriesById = new Map(page.categories.map((item) => [item.id, item]));
  const storesById = new Map(page.stores.map((item) => [item.id, item]));

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-mint">
          <Archive size={20} />
          <span className="text-sm font-black uppercase">Zgłoszenia</span>
        </div>
        <h1 className="text-3xl font-black">Archiwum zgłoszeń</h1>
        <p className="mt-2 max-w-2xl text-ink/65 dark:text-paper/65">
          Zamknięte i anulowane zgłoszenia pozostają dostępne do wglądu, ale nie zajmują miejsca na aktywnej tablicy.
        </p>
      </div>

      {admin ? <AdminNav user={user} currentPath="/tickets/archive" /> : null}

      <form method="get" className="control-panel mb-5 flex flex-wrap items-center gap-2 rounded-md p-3">
        <Filter size={18} className="text-ink/50 dark:text-paper/50" />
        <input
          name="q"
          defaultValue={filters.query ?? ""}
          placeholder="Szukaj numeru, tytułu lub opisu"
          className={`${filterClass} min-w-64`}
          aria-label="Szukaj w archiwum"
        />
        <select name="status" defaultValue={filters.status ?? ""} className={filterClass}>
          <option value="">Status zakończenia</option>
          {archivedTicketStatuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
        <button className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-bold text-white dark:bg-paper dark:text-ink" type="submit">
          Filtruj
        </button>
        <Link href="/tickets/archive" className="inline-flex h-10 items-center justify-center px-3 text-sm font-bold text-ink/65 hover:text-ink dark:text-paper/65 dark:hover:text-paper">
          Wyczyść
        </Link>
        <span className="ml-auto rounded-full bg-ink/5 px-3 py-1 text-xs font-bold text-ink/60 dark:bg-white/10 dark:text-paper/60">
          {page.tickets.length} zgłoszeń
        </span>
      </form>

      {page.tickets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {page.tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              href={`${ticketPath}/${ticket.id}`}
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
          title="Archiwum jest puste"
          description={filters.query || filters.status ? "Brak archiwalnych zgłoszeń dla wybranych filtrów." : "Nie ma jeszcze zamkniętych ani anulowanych zgłoszeń."}
          actionHref={ticketPath}
          actionLabel="Wróć do zgłoszeń"
        />
      )}

      {page.hasMore ? (
        <div className="mt-6 flex justify-end">
          <a
            href={buildTicketListHref("/tickets/archive", params, page.nextCursor)}
            className="inline-flex h-10 items-center justify-center rounded-md border border-black/10 px-4 text-sm font-bold text-ink/70 hover:border-mint hover:text-ink dark:border-white/10 dark:text-paper/70 dark:hover:text-paper"
          >
            Następna strona
          </a>
        </div>
      ) : null}
    </AppShell>
  );
}

const filterClass =
  "h-10 rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper";
