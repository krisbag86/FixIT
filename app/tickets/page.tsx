import { Filter } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { TicketCard } from "@/components/ticket-card";
import { requireUser } from "@/lib/auth";
import { listVisibleTickets, readDatabase } from "@/lib/data-store";
import { statusLabels, ticketStatuses } from "@/lib/labels";
import type { TicketStatus } from "@/lib/types";

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const database = await readDatabase();
  const status = params.status as TicketStatus | undefined;
  const tickets = (await listVisibleTickets(user)).filter((ticket) => !status || ticket.status === status);

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-black">Moje zgloszenia</h1>
          <p className="mt-2 text-ink/65 dark:text-paper/65">
            Lista spraw, ktore mozesz sledzic zgodnie ze swoja rola.
          </p>
        </div>
        <form className="flex items-center gap-2">
          <Filter size={18} className="text-ink/50 dark:text-paper/50" />
          <select
            name="status"
            defaultValue={status ?? ""}
            className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/10"
          >
            <option value="">Wszystkie statusy</option>
            {ticketStatuses.map((item) => (
              <option key={item} value={item}>
                {statusLabels[item]}
              </option>
            ))}
          </select>
          <button className="h-10 rounded-md bg-ink px-3 text-sm font-bold text-white dark:bg-paper dark:text-ink" type="submit">
            Filtruj
          </button>
        </form>
      </div>

      {tickets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              href={`/tickets/${ticket.id}`}
              reporter={database.users.find((item) => item.id === ticket.reporterId)}
              assignee={database.users.find((item) => item.id === ticket.assigneeId)}
              category={database.categories.find((item) => item.id === ticket.categoryId)}
              store={database.stores.find((item) => item.id === ticket.storeId)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          variant="tickets"
          description={status ? "Brak zgloszen w tym statusie. Zmien filtr lub utworz nowe zgloszenie." : "Zmien filtr albo utworz pierwsze zgloszenie."}
          actionHref="/tickets/new"
          actionLabel="Zglos awarie"
        />
      )}
    </AppShell>
  );
}
