import type { Ticket, TicketPriority, TicketStatus } from "@/lib/types";

export const SLA_HOURS: Record<TicketPriority, number> = {
  CRITICAL: 4,
  HIGH: 8,
  NORMAL: 24,
  LOW: 48
};

export const COMPLETED_TICKET_STATUSES = new Set<TicketStatus>([
  "RESOLVED",
  "CLOSED",
  "CANCELLED"
]);

type SlaTicket = Pick<Ticket, "createdAt" | "dueAt" | "priority" | "status">;

export function getTicketSlaDeadline(
  ticket: Pick<SlaTicket, "createdAt" | "dueAt" | "priority">
): Date {
  if (ticket.dueAt) {
    const dueAt = new Date(ticket.dueAt);
    if (!Number.isNaN(dueAt.getTime())) return dueAt;
  }

  return new Date(
    new Date(ticket.createdAt).getTime() + SLA_HOURS[ticket.priority] * 3_600_000
  );
}

export function isTicketOverdue(ticket: SlaTicket, now = new Date()): boolean {
  return (
    !COMPLETED_TICKET_STATUSES.has(ticket.status) &&
    getTicketSlaDeadline(ticket).getTime() < now.getTime()
  );
}

export type TicketSlaState = "ON_TRACK" | "AT_RISK" | "BREACHED" | "COMPLETED";

export function getTicketSlaState(ticket: SlaTicket, now = new Date()): TicketSlaState {
  if (COMPLETED_TICKET_STATUSES.has(ticket.status)) return "COMPLETED";

  const remainingHours =
    (getTicketSlaDeadline(ticket).getTime() - now.getTime()) / 3_600_000;
  if (remainingHours <= 0) return "BREACHED";

  return remainingHours <= Math.max(2, SLA_HOURS[ticket.priority] * 0.25)
    ? "AT_RISK"
    : "ON_TRACK";
}
