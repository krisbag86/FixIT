import {
  COMPLETED_TICKET_STATUSES,
  getTicketSlaDeadline,
  isTicketOverdue
} from "@/lib/ticket-sla";
import type {
  Category,
  DashboardAlertItem,
  DashboardData,
  DashboardQueueStage,
  Ticket,
  TicketPriority,
  TicketStatus,
  User
} from "@/lib/types";

export const DASHBOARD_DAYS = 30;
export const DASHBOARD_ITEM_LIMIT = 5;
export const DASHBOARD_STAGE_STATUSES: Record<DashboardQueueStage, TicketStatus[]> = {
  new: ["NEW", "TRIAGED"],
  waiting: ["WAITING_FOR_USER", "WAITING_FOR_VENDOR"],
  in_progress: ["IN_PROGRESS"]
};

const priorityRank: Record<TicketPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1
};

export type DashboardSourceTicket = Omit<
  Pick<
    Ticket,
    | "id"
    | "number"
    | "title"
    | "status"
    | "priority"
    | "createdAt"
    | "dueAt"
    | "resolvedAt"
    | "assigneeId"
    | "categoryId"
    | "storeId"
  >,
  "assigneeId" | "categoryId" | "storeId"
> & {
  assigneeId?: string;
  categoryId?: string;
  storeId?: string;
};

export function getDashboardWindowStart(now: Date): Date {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (DASHBOARD_DAYS - 1));
  return start;
}

function toDashboardTicketItem(
  ticket: DashboardSourceTicket,
  storeCodes = new Map<string, string>()
) {
  return {
    id: ticket.id,
    number: ticket.number,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    createdAt: ticket.createdAt,
    storeCode: ticket.storeId ? storeCodes.get(ticket.storeId) : undefined
  };
}

export function buildDashboardAlerts(
  tickets: DashboardSourceTicket[],
  storeCodes: Map<string, string>,
  now: Date
): DashboardData["alerts"] {
  const candidates: DashboardAlertItem[] = tickets.flatMap((ticket) => {
    const isCritical =
      ticket.priority === "CRITICAL" &&
      !COMPLETED_TICKET_STATUSES.has(ticket.status);
    const isSlaBreached = isTicketOverdue(ticket, now);
    if (!isCritical && !isSlaBreached) return [];

    const deadline = getTicketSlaDeadline(ticket);
    return [{
      ...toDashboardTicketItem(ticket, storeCodes),
      isCritical,
      isSlaBreached,
      hoursOverdue: isSlaBreached
        ? Math.round(((now.getTime() - deadline.getTime()) / 3_600_000) * 10) / 10
        : null
    }];
  });

  candidates.sort((a, b) => {
    const group = (item: DashboardAlertItem) =>
      item.isCritical && item.isSlaBreached ? 0 : item.isCritical ? 1 : 2;
    return (
      group(a) - group(b) ||
      (b.hoursOverdue ?? -1) - (a.hoursOverdue ?? -1) ||
      a.createdAt.localeCompare(b.createdAt)
    );
  });

  return {
    criticalCount: candidates.filter((item) => item.isCritical).length,
    slaBreachedCount: candidates.filter((item) => item.isSlaBreached).length,
    tickets: candidates.slice(0, DASHBOARD_ITEM_LIMIT)
  };
}

export function buildDashboardMyQueue(
  tickets: DashboardSourceTicket[],
  userId: string
): DashboardData["myQueue"] {
  return Object.fromEntries(
    (Object.keys(DASHBOARD_STAGE_STATUSES) as DashboardQueueStage[]).map((stage) => {
      const matching = tickets
        .filter(
          (ticket) =>
            ticket.assigneeId === userId &&
            DASHBOARD_STAGE_STATUSES[stage].includes(ticket.status)
        )
        .sort(
          (a, b) =>
            priorityRank[b.priority] - priorityRank[a.priority] ||
            a.createdAt.localeCompare(b.createdAt)
        );
      return [
        stage,
        {
          count: matching.length,
          tickets: matching
            .slice(0, DASHBOARD_ITEM_LIMIT)
            .map((ticket) => toDashboardTicketItem(ticket))
        }
      ];
    })
  ) as DashboardData["myQueue"];
}

export function buildDashboardDailyCounts(
  tickets: Array<Pick<DashboardSourceTicket, "createdAt" | "resolvedAt">>,
  now: Date
): DashboardData["analytics"]["dailyTicketCounts"] {
  const start = getDashboardWindowStart(now);
  const counts = new Map<string, { created: number; resolved: number }>();
  for (let offset = 0; offset < DASHBOARD_DAYS; offset += 1) {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + offset);
    counts.set(date.toISOString().slice(0, 10), { created: 0, resolved: 0 });
  }

  for (const ticket of tickets) {
    const created = counts.get(ticket.createdAt.slice(0, 10));
    if (created) created.created += 1;
    if (ticket.resolvedAt) {
      const resolved = counts.get(ticket.resolvedAt.slice(0, 10));
      if (resolved) resolved.resolved += 1;
    }
  }

  return [...counts.entries()].map(([date, value]) => ({ date, ...value }));
}

export function calculateAverageResolutionHours(
  tickets: Array<Pick<DashboardSourceTicket, "createdAt" | "resolvedAt">>,
  now: Date
): number | null {
  const start = getDashboardWindowStart(now).getTime();
  const durations = tickets.flatMap((ticket) => {
    if (!ticket.resolvedAt) return [];
    const resolvedAt = new Date(ticket.resolvedAt).getTime();
    if (resolvedAt < start || resolvedAt > now.getTime()) return [];
    return [(resolvedAt - new Date(ticket.createdAt).getTime()) / 3_600_000];
  });

  if (durations.length === 0) return null;
  const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  return Math.round(average * 10) / 10;
}

export function buildTopCategories(
  tickets: DashboardSourceTicket[],
  categories: Array<Pick<Category, "id" | "name">>
): DashboardData["analytics"]["topCategories"] {
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    if (ticket.categoryId) {
      counts.set(ticket.categoryId, (counts.get(ticket.categoryId) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([categoryId, count]) => ({
      categoryId,
      categoryName: names.get(categoryId) ?? "Nieznana",
      count
    }))
    .sort(
      (a, b) =>
        b.count - a.count || a.categoryName.localeCompare(b.categoryName, "pl")
    )
    .slice(0, 8);
}

export function buildAgentWorkload(
  tickets: DashboardSourceTicket[],
  users: User[]
): DashboardData["analytics"]["agentWorkload"] {
  const agents = new Map(
    users
      .filter(
        (user) =>
          user.isActive && (user.role === "AGENT" || user.role === "ADMIN")
      )
      .map((user) => [user.id, user])
  );
  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    if (ticket.assigneeId && agents.has(ticket.assigneeId)) {
      counts.set(ticket.assigneeId, (counts.get(ticket.assigneeId) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([agentId, openCount]) => ({
      agentId,
      agentName: agents.get(agentId)?.name ?? agents.get(agentId)?.email ?? "Nieznany",
      openCount
    }))
    .sort(
      (a, b) =>
        b.openCount - a.openCount || a.agentName.localeCompare(b.agentName, "pl")
    );
}
