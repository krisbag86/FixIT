import "server-only";

import type { Prisma } from "@prisma/client";
import { getStageStatuses } from "@/lib/ticket-filters";
import type {
  TicketAttentionFilter,
  TicketStageFilter
} from "@/lib/ticket-filters";
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

export function buildStageWhere(stage: TicketStageFilter): Prisma.TicketWhereInput {
  return { status: { in: getStageStatuses(stage) } };
}

export function buildAttentionWhere(
  attention: TicketAttentionFilter,
  now: Date
): Prisma.TicketWhereInput {
  if (attention === "critical") {
    return { ...buildOpenTicketWhere(), priority: "CRITICAL" };
  }
  if (attention === "overdue") return buildSlaBreachedWhere(now);

  return {
    ...buildOpenTicketWhere(),
    OR: [{ priority: "CRITICAL" }, buildSlaBreachedWhere(now)]
  };
}
