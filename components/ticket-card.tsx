import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { formatDateTime } from "@/lib/format";
import type { Category, Store, Ticket, User } from "@/lib/types";

export function TicketCard({
  ticket,
  reporter,
  assignee,
  category,
  store,
  href
}: {
  ticket: Ticket;
  reporter?: User;
  assignee?: User;
  category?: Category;
  store?: Store;
  href: string;
}) {
  return (
    <Link
      href={href}
      data-testid="ticket-card"
      className="group grid gap-3 rounded-md border border-black/10 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft dark:border-white/10 dark:bg-white/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-mint">{ticket.number}</div>
          <h3 className="mt-1 text-base font-black leading-snug">{ticket.title}</h3>
        </div>
        <ArrowRight className="mt-1 shrink-0 text-ink/35 transition group-hover:translate-x-1 group-hover:text-mint dark:text-paper/35" size={18} />
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
      </div>
      <div className="grid gap-1 text-sm text-ink/65 dark:text-paper/65">
        <span>{category?.name ?? "Bez kategorii"}</span>
        <span>{store?.name ?? ticket.department ?? "Bez lokalizacji"}</span>
        <span>Zglasza: {reporter?.name ?? "Nieznany"}{assignee ? `, prowadzi: ${assignee.name}` : ""}</span>
        <span>Aktualizacja: {formatDateTime(ticket.updatedAt)}</span>
      </div>
    </Link>
  );
}
