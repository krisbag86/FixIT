import { cn } from "@/lib/cn";
import { priorityLabels, roleLabels, statusLabels, visibilityLabels } from "@/lib/labels";
import type { CommentVisibility, TicketPriority, TicketStatus, UserRole } from "@/lib/types";

const statusClass: Record<TicketStatus, string> = {
  NEW: "bg-river/10 text-river ring-river/25 dark:bg-river/20 dark:text-blue-200",
  TRIAGED: "bg-mint/10 text-mint ring-mint/25 dark:bg-mint/20 dark:text-emerald-200",
  IN_PROGRESS: "bg-amberline/15 text-yellow-700 ring-amberline/30 dark:text-yellow-200",
  WAITING_FOR_USER: "bg-berry/10 text-berry ring-berry/25 dark:bg-berry/20 dark:text-pink-200",
  WAITING_FOR_VENDOR: "bg-purple-500/10 text-purple-700 ring-purple-500/25 dark:text-purple-200",
  RESOLVED: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-200",
  CLOSED: "bg-slate-500/10 text-slate-700 ring-slate-500/25 dark:text-slate-200",
  CANCELLED: "bg-red-500/10 text-red-700 ring-red-500/25 dark:text-red-200"
};

const priorityClass: Record<TicketPriority, string> = {
  LOW: "bg-slate-500/10 text-slate-700 ring-slate-500/25 dark:text-slate-200",
  NORMAL: "bg-mint/10 text-mint ring-mint/25 dark:text-emerald-200",
  HIGH: "bg-amberline/15 text-yellow-700 ring-amberline/30 dark:text-yellow-200",
  CRITICAL: "bg-red-500/10 text-red-700 ring-red-500/25 dark:text-red-200"
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge className={statusClass[status]}>{statusLabels[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <Badge className={priorityClass[priority]}>{priorityLabels[priority]}</Badge>;
}

export function RoleBadge({ role }: { role: UserRole }) {
  return <Badge className="bg-ink/5 text-ink ring-ink/10 dark:bg-white/10 dark:text-paper dark:ring-white/10">{roleLabels[role]}</Badge>;
}

export function VisibilityBadge({ visibility }: { visibility: CommentVisibility }) {
  return (
    <Badge
      data-testid="visibility-badge"
      className={
        visibility === "PUBLIC"
          ? "bg-mint/10 text-mint ring-mint/25 dark:text-emerald-200"
          : "bg-berry/10 text-berry ring-berry/25 dark:text-pink-200"
      }
    >
      {visibilityLabels[visibility]}
    </Badge>
  );
}

function Badge({ children, className, ...props }: React.ComponentProps<"span"> & { className: string }) {
  return (
    <span {...props} className={cn("inline-flex items-center rounded px-2 py-1 text-xs font-semibold ring-1", className)}>
      {children}
    </span>
  );
}
