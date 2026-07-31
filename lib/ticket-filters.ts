import type { Ticket, TicketPriority, TicketStatus } from "@/lib/types";

export type TicketListSearchParams = Record<string, string | string[] | undefined>;

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

const slaHours: Record<TicketPriority, number> = {
  CRITICAL: 4,
  HIGH: 8,
  NORMAL: 24,
  LOW: 48
};

const closedStatuses = new Set<TicketStatus>(["RESOLVED", "CLOSED", "CANCELLED"]);

function firstParam(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || undefined;
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

  return {
    ...(query ? { query } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(assigneeId ? { assigneeId } : {}),
    ...(storeId ? { storeId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(booleanParam(firstParam(params.mine)) ? { mine: true } : {}),
    ...(booleanParam(firstParam(params.unassigned)) ? { unassigned: true } : {}),
    ...(booleanParam(firstParam(params.overdue)) ? { overdue: true } : {})
  };
}

export function getTicketSlaDeadline(ticket: Pick<Ticket, "createdAt" | "dueAt" | "priority">): Date {
  if (ticket.dueAt) {
    const dueAt = new Date(ticket.dueAt);
    if (!Number.isNaN(dueAt.getTime())) return dueAt;
  }

  const createdAt = new Date(ticket.createdAt);
  return new Date(createdAt.getTime() + slaHours[ticket.priority] * 60 * 60 * 1000);
}

export function isTicketOverdue(ticket: Pick<Ticket, "createdAt" | "dueAt" | "priority" | "status">, now = new Date()): boolean {
  return !closedStatuses.has(ticket.status) && getTicketSlaDeadline(ticket).getTime() < now.getTime();
}

export function matchesTicketFilters(ticket: Ticket, filters: TicketListFilters, currentUserId?: string, now = new Date()): boolean {
  if (filters.query) {
    const query = filters.query.toLocaleLowerCase();
    const searchable = `${ticket.number} ${ticket.title} ${ticket.description}`.toLocaleLowerCase();
    if (!searchable.includes(query)) return false;
  }

  if (filters.status && ticket.status !== filters.status) return false;
  if (filters.priority && ticket.priority !== filters.priority) return false;
  if (filters.assigneeId && ticket.assigneeId !== filters.assigneeId) return false;
  if (filters.storeId && ticket.storeId !== filters.storeId) return false;
  if (filters.categoryId && ticket.categoryId !== filters.categoryId) return false;
  if (filters.mine && ticket.assigneeId !== currentUserId) return false;
  if (filters.unassigned && ticket.assigneeId) return false;
  if (filters.overdue && !isTicketOverdue(ticket, now)) return false;

  return true;
}

export { closedStatuses, slaHours };
