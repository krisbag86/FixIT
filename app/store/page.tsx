import { redirect } from "next/navigation";
import { Activity, AlertTriangle, CheckCircle, Clock, Filter, Store } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { TicketCard } from "@/components/ticket-card";
import { requireUser } from "@/lib/auth";
import { getStoreDashboard, listVisibleTickets, readDatabase } from "@/lib/data-store";
import { formatDateTime } from "@/lib/format";
import { priorityLabels, statusLabels, ticketPriorities, ticketStatuses } from "@/lib/labels";
import type { TicketPriority, TicketStatus } from "@/lib/types";

export default async function StoreDashboardPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; priority?: string }>;
}) {
  const user = await requireUser();

  // Tylko STORE_MANAGER lub wyzsze role
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
  const tickets = allTickets.filter((t) => {
    const statusMatch = !params.status || t.status === (params.status as TicketStatus);
    const priorityMatch = !params.priority || t.priority === (params.priority as TicketPriority);
    return statusMatch && priorityMatch;
  });

  const store = database.stores.find((s) => s.id === storeId);

  if (!store) {
    redirect("/tickets");
  }

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-mint">
            <Store size={20} />
            <span className="text-sm font-black uppercase">Sklep</span>
          </div>
          <h1 className="text-3xl font-black">
            {store.code} &mdash; {store.name}
          </h1>
          <p className="mt-2 text-ink/65 dark:text-paper/65">
            {store.city} / {store.region} &middot; Dashboard dla kierownika sklepu
          </p>
        </div>
      </div>

      {/* Metrics cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          icon={<Activity size={22} />}
          label="Otwarte"
          value={dashboard.openTickets}
          color="text-amber-600 dark:text-amber-400"
        />
        <MetricCard
          icon={<AlertTriangle size={22} />}
          label="Krytyczne"
          value={dashboard.criticalTickets}
          color="text-red-600 dark:text-red-400"
        />
        <MetricCard
          icon={<Clock size={22} />}
          label="Blokujące sprzedaż"
          value={dashboard.blockingTickets}
          color="text-amberline"
        />
        <MetricCard
          icon={<CheckCircle size={22} />}
          label="Rozwiązane dzisiaj"
          value={dashboard.resolvedToday}
          color="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        {/* Ticket list */}
        <div>
          <h2 className="mb-4 text-lg font-black">Aktywne zgłoszenia</h2>

          <form className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/10">
            <Filter size={18} className="text-ink/50 dark:text-paper/50" />
            <select name="status" defaultValue={params.status ?? ""} className={filterClass}>
              <option value="">Status</option>
              {ticketStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
            <select name="priority" defaultValue={params.priority ?? ""} className={filterClass}>
              <option value="">Priorytet</option>
              {ticketPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabels[priority]}
                </option>
              ))}
            </select>
            <button className="h-10 rounded-md bg-ink px-3 text-sm font-bold text-white dark:bg-paper dark:text-ink" type="submit">
              Filtruj
            </button>
          </form>

          {tickets.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {tickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  href={`/tickets/${ticket.id}`}
                  reporter={database.users.find((item) => item.id === ticket.reporterId)}
                  assignee={database.users.find((item) => item.id === ticket.assigneeId)}
                  category={database.categories.find((item) => item.id === ticket.categoryId)}
                  store={store}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-black/20 bg-white/60 p-10 text-center dark:border-white/20 dark:bg-white/10">
              <h3 className="text-xl font-black">Brak zgłoszeń</h3>
              <p className="mt-2 text-ink/65 dark:text-paper/65">
                Wszystkie sprawy w tym sklepie sa rozwiazane. Zmien filtr, aby zobaczyc wiecej.
              </p>
            </div>
          )}
        </div>

        {/* Recent events */}
        <div>
          <h2 className="mb-4 text-lg font-black">Ostatnie zdarzenia</h2>
          <div className="space-y-3">
            {dashboard.recentEvents.length > 0 ? (
              dashboard.recentEvents.map((event) => {
                const actor = database.users.find((u) => u.id === event.actorId);
                return (
                  <div
                    key={event.id}
                    className="rounded-md border border-black/10 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-mint">{event.ticketNumber ?? "??"}</span>
                      <span className="rounded bg-black/5 px-1.5 py-0.5 font-semibold text-ink/60 dark:bg-white/10 dark:text-paper/60">
                        {event.type}
                      </span>
                    </div>
                    {event.payload && Object.keys(event.payload).length > 0 && (
                      <div className="mt-1 text-xs text-ink/55 dark:text-paper/55">
                        {Object.entries(event.payload).map(([key, value]) => (
                          <span key={key} className="mr-2">
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-ink/45 dark:text-paper/45">
                      {actor?.name ?? "System"} &middot; {formatDateTime(event.createdAt)}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-ink/55 dark:text-paper/55">Brak zdarzen.</p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

const filterClass = "h-10 rounded-md border border-black/10 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/10";

function MetricCard({
  icon,
  label,
  value,
  color
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-md border border-black/10 bg-white/75 px-4 py-4 dark:border-white/10 dark:bg-white/10">
      <div className={`mb-2 ${color}`}>{icon}</div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-bold uppercase text-ink/50 dark:text-paper/50">{label}</div>
    </div>
  );
}
