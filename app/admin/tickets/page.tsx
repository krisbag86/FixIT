import { redirect } from "next/navigation";
import { Filter, LayoutDashboard } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AppShell } from "@/components/app-shell";
import { TicketCard } from "@/components/ticket-card";
import { requireUser } from "@/lib/auth";
import { listVisibleTickets, readDatabase } from "@/lib/data-store";
import { priorityLabels, statusLabels, ticketPriorities, ticketStatuses } from "@/lib/labels";
import { canUseAdmin } from "@/lib/permissions";
import type { TicketPriority, TicketStatus } from "@/lib/types";

export default async function AdminTicketsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; priority?: string; assignee?: string }>;
}) {
  const user = await requireUser();

  if (!canUseAdmin(user)) {
    redirect("/tickets");
  }

  const params = await searchParams;
  const database = await readDatabase();
  const tickets = (await listVisibleTickets(user)).filter((ticket) => {
    const statusMatch = !params.status || ticket.status === (params.status as TicketStatus);
    const priorityMatch = !params.priority || ticket.priority === (params.priority as TicketPriority);
    const assigneeMatch = !params.assignee || ticket.assigneeId === params.assignee;
    return statusMatch && priorityMatch && assigneeMatch;
  });
  const openTickets = database.tickets.filter((ticket) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(ticket.status)).length;
  const criticalTickets = database.tickets.filter((ticket) => ticket.priority === "CRITICAL").length;

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
          <Metric label="Otwarte" value={openTickets} />
          <Metric label="Krytyczne" value={criticalTickets} />
          <Metric label="W filtrze" value={tickets.length} />
        </div>
      </div>

      <AdminNav user={user} currentPath="/admin/tickets" />

      <form className="mb-5 flex flex-wrap items-center gap-2 rounded-md border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/10">
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
        <select name="assignee" defaultValue={params.assignee ?? ""} className={filterClass}>
          <option value="">Wykonawca</option>
          {database.users
            .filter((item) => item.role === "AGENT" || item.role === "ADMIN")
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
        <button className="h-10 rounded-md bg-ink px-3 text-sm font-bold text-white dark:bg-paper dark:text-ink" type="submit">
          Filtruj
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            href={`/admin/tickets/${ticket.id}`}
            reporter={database.users.find((item) => item.id === ticket.reporterId)}
            assignee={database.users.find((item) => item.id === ticket.assigneeId)}
            category={database.categories.find((item) => item.id === ticket.categoryId)}
            store={database.stores.find((item) => item.id === ticket.storeId)}
          />
        ))}
      </div>
    </AppShell>
  );
}

const filterClass = "h-10 rounded-md border border-black/10 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/10";

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-black/10 bg-white/75 px-4 py-3 text-right dark:border-white/10 dark:bg-white/10">
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-bold uppercase text-ink/50 dark:text-paper/50">{label}</div>
    </div>
  );
}
