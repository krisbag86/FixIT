import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicTicketProgress } from "@/components/requester/public-ticket-progress";
import { formatDateTime } from "@/lib/format";
import type { Ticket } from "@/lib/types";

export function RequesterTicketCard({ ticket, href }: { ticket: Ticket; href: string }) {
  return (
    <Link
      href={href}
      data-testid="requester-ticket-card"
      className="group relative grid gap-4 overflow-hidden rounded-xl border border-black/8 bg-white/75 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-mint/5 dark:border-white/8 dark:bg-white/[0.06]"
    >
      <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-mint to-river opacity-70" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-wider text-mint">{ticket.number}</div>
          <h2 className="mt-2 text-lg font-black leading-snug">{ticket.title}</h2>
        </div>
        <ArrowRight className="mt-1 shrink-0 text-ink/30 transition-all group-hover:translate-x-1 group-hover:text-mint dark:text-paper/30" size={18} />
      </div>
      <div data-testid="requester-ticket-stage">
        <PublicTicketProgress status={ticket.status} compact />
      </div>
      <time dateTime={ticket.updatedAt} className="text-xs text-ink/50 dark:text-paper/50">
        Ostatnia aktualizacja: {formatDateTime(ticket.updatedAt)}
      </time>
    </Link>
  );
}
