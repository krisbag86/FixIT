import "server-only";

import type { Prisma } from "@prisma/client";
import { COMPLETED_TICKET_STATUSES, SLA_HOURS } from "@/lib/ticket-sla";

export function buildOpenTicketWhere(): Prisma.TicketWhereInput {
  return { status: { notIn: [...COMPLETED_TICKET_STATUSES] } };
}

export function buildSlaBreachedWhere(now: Date): Prisma.TicketWhereInput {
  return {
    ...buildOpenTicketWhere(),
    OR: [
      { dueAt: { lt: now } },
      {
        dueAt: null,
        OR: (
          Object.entries(SLA_HOURS) as Array<[keyof typeof SLA_HOURS, number]>
        ).map(([priority, hours]) => ({
          priority,
          createdAt: { lt: new Date(now.getTime() - hours * 3_600_000) }
        }))
      }
    ]
  };
}
