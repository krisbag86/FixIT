import { CheckCircle2, Clock3, ShieldAlert, Timer } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { getTicketSlaDeadline, getTicketSlaState } from "@/lib/ticket-filters";
import type { Ticket } from "@/lib/types";

const stateConfig = {
  ON_TRACK: {
    label: "SLA: w terminie",
    icon: Clock3,
    className: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300"
  },
  AT_RISK: {
    label: "SLA: zbliża się",
    icon: Timer,
    className: "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300"
  },
  BREACHED: {
    label: "SLA: przekroczone",
    icon: ShieldAlert,
    className: "bg-red-500/10 text-red-700 ring-red-500/20 dark:text-red-300"
  },
  COMPLETED: {
    label: "SLA: zakończone",
    icon: CheckCircle2,
    className: "bg-slate-500/10 text-slate-700 ring-slate-500/20 dark:text-slate-300"
  }
} as const;

export function SlaBadge({ ticket, compact = false }: { ticket: Ticket; compact?: boolean }) {
  const state = getTicketSlaState(ticket);
  const config = stateConfig[state];
  const Icon = config.icon;
  const deadline = getTicketSlaDeadline(ticket);

  return (
    <div
      data-testid="sla-badge"
      title={`Termin SLA: ${formatDateTime(deadline.toISOString())}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${config.className}`}
    >
      <Icon size={13} />
      <span>{config.label}</span>
      {!compact && state !== "COMPLETED" ? <span className="font-medium opacity-75">do {formatDateTime(deadline.toISOString())}</span> : null}
    </div>
  );
}
