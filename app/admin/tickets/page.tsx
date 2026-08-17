import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { AppShell } from "@/components/app-shell";
import { TicketFilters } from "@/components/admin/ticket-filters";
import { TicketCard } from "@/components/ticket-card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { getTicketListPageData } from "@/lib/data-store";
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

      <TicketFilters filters={filters} users={page.users} stores={page.stores} categories={page.categories} />

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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-black/10 bg-white/75 px-4 py-3 text-right dark:border-white/10 dark:bg-white/10">
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-bold uppercase text-ink/50 dark:text-paper/50">{label}</div>
    </div>
  );
}
