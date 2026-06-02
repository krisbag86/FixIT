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
      className="group relative grid gap-3 overflow-hidden rounded-xl border border-black/8 bg-white/70 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-mint/5 dark:border-white/8 dark:bg-white/[0.06] dark:hover:shadow-mint/10"
    >
      {/* Górny akcent */}
      <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-mint to-river opacity-60" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-mint/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-mint dark:bg-mint/15">
              <span className="h-1.5 w-1.5 rounded-full bg-mint" />
              {ticket.number}
            </span>
          </div>
          <h3 className="mt-2 text-base font-bold leading-snug">{ticket.title}</h3>
        </div>
        <ArrowRight className="mt-1.5 shrink-0 text-ink/30 transition-all duration-300 group-hover:translate-x-1 group-hover:text-mint dark:text-paper/30" size={18} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
      </div>

      <div className="space-y-1 text-sm leading-relaxed text-ink/60 dark:text-paper/60">
        <span className="block">{category?.name ?? "Bez kategorii"}</span>
        <span className="block">{store?.name ?? ticket.department ?? "Bez lokalizacji"}</span>
        <span className="block">
          Zgłasza: {reporter?.name ?? "Nieznany"}
          {assignee ? <>, prowadzi: <span className="font-medium text-ink/80 dark:text-paper/80">{assignee.name}</span></> : ""}
        </span>
        <span className="block text-xs text-ink/45 dark:text-paper/45">
          Aktualizacja: {formatDateTime(ticket.updatedAt)}
        </span>
      </div>
    </Link>
  );
}
