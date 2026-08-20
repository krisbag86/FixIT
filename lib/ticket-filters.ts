import type { Ticket, TicketPriority, TicketStatus } from "@/lib/types";
import {
  COMPLETED_TICKET_STATUSES,
  isTicketOverdue
} from "@/lib/ticket-sla";

export {
  getTicketSlaDeadline,
  getTicketSlaState,
  isTicketOverdue
} from "@/lib/ticket-sla";
export type { TicketSlaState } from "@/lib/ticket-sla";

export type TicketListSearchParams = Record<string, string | string[] | undefined>;

export type TicketStageFilter = "new" | "waiting" | "in_progress";
export type TicketAttentionFilter = "critical" | "overdue" | "all";

export type TicketListFilters = {
  query?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeId?: string;
  storeId?: string;
  categoryId?: string;
  mine?: boolean;
  unassigned?: boolean;
  overdue?: boolean;
  archived?: boolean;
  stage?: TicketStageFilter;
  attention?: TicketAttentionFilter;
};

const ticketStatuses: TicketStatus[] = [
  "NEW",
  "TRIAGED",
  "IN_PROGRESS",
  "WAITING_FOR_USER",
  "WAITING_FOR_VENDOR",
  "RESOLVED",
  "CLOSED",
  "CANCELLED"
];

const ticketPriorities: TicketPriority[] = ["LOW", "NORMAL", "HIGH", "CRITICAL"];
const stageStatuses: Record<TicketStageFilter, TicketStatus[]> = {
  new: ["NEW", "TRIAGED"],
  waiting: ["WAITING_FOR_USER", "WAITING_FOR_VENDOR"],
  in_progress: ["IN_PROGRESS"]
};

const closedStatuses = COMPLETED_TICKET_STATUSES;
const archivedStatuses = new Set<TicketStatus>(["CLOSED", "CANCELLED"]);

function firstParam(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || undefined;
}

export function getTicketListCursor(params: TicketListSearchParams): string | undefined {
  return firstParam(params.cursor);
}

export function getStageStatuses(stage: TicketStageFilter): TicketStatus[] {
  return stageStatuses[stage];
}

export function buildTicketListHref(path: string, params: TicketListSearchParams, cursor?: string): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "cursor") continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) search.append(key, item);
    }
  }
  if (cursor) search.set("cursor", cursor);
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function enumParam<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value && allowed.includes(value as T) ? (value as T) : undefined;
}

function booleanParam(value: string | undefined): boolean | undefined {
  if (value === "1" || value === "true") return true;
  return undefined;
}

export function parseTicketListFilters(params: TicketListSearchParams): TicketListFilters {
  const query = firstParam(params.q);
  const status = enumParam(firstParam(params.status), ticketStatuses);
  const priority = enumParam(firstParam(params.priority), ticketPriorities);
  const assigneeId = firstParam(params.assignee);
  const storeId = firstParam(params.store);
  const categoryId = firstParam(params.category);
  const stage = enumParam(firstParam(params.stage), ["new", "waiting", "in_progress"] as const);
  const attention = enumParam(firstParam(params.attention), ["critical", "overdue", "all"] as const);

  return {
    ...(query ? { query } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(assigneeId ? { assigneeId } : {}),
    ...(storeId ? { storeId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(booleanParam(firstParam(params.mine)) ? { mine: true } : {}),
    ...(booleanParam(firstParam(params.unassigned)) ? { unassigned: true } : {}),
    ...(booleanParam(firstParam(params.overdue)) ? { overdue: true } : {}),
    ...(booleanParam(firstParam(params.archived)) ? { archived: true } : {}),
    ...(stage ? { stage } : {}),
    ...(attention ? { attention } : {})
  };
}

export function matchesTicketFilters(ticket: Ticket, filters: TicketListFilters, currentUserId?: string, now = new Date()): boolean {
  if (filters.archived ? !archivedStatuses.has(ticket.status) : archivedStatuses.has(ticket.status)) return false;

  if (filters.query) {
    const query = filters.query.toLocaleLowerCase();
    const searchable = `${ticket.number} ${ticket.title} ${ticket.description}`.toLocaleLowerCase();
    if (!searchable.includes(query)) return false;
  }

  if (filters.status && ticket.status !== filters.status) return false;
  if (!filters.status && filters.stage && !getStageStatuses(filters.stage).includes(ticket.status)) return false;
  if (filters.priority && ticket.priority !== filters.priority) return false;
  if (filters.assigneeId && ticket.assigneeId !== filters.assigneeId) return false;
  if (filters.storeId && ticket.storeId !== filters.storeId) return false;
  if (filters.categoryId && ticket.categoryId !== filters.categoryId) return false;
  if (filters.mine && ticket.assigneeId !== currentUserId) return false;
  if (filters.unassigned && ticket.assigneeId) return false;
  if (!filters.attention && filters.overdue && !isTicketOverdue(ticket, now)) return false;
  if (
    filters.attention === "critical" &&
    (COMPLETED_TICKET_STATUSES.has(ticket.status) || ticket.priority !== "CRITICAL")
  ) return false;
  if (filters.attention === "overdue" && !isTicketOverdue(ticket, now)) return false;
  if (
    filters.attention === "all" &&
    (COMPLETED_TICKET_STATUSES.has(ticket.status) ||
      (ticket.priority !== "CRITICAL" && !isTicketOverdue(ticket, now)))
  ) return false;

  return true;
}

export { archivedStatuses, closedStatuses };
