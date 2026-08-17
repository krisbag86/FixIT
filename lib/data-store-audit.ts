import "server-only";

import { id, now } from "@/lib/data-store-core";
import type { AdminAuditLog, Database } from "@/lib/types";

export function appendAdminAuditLog(
  database: Database,
  input: {
    actorId?: string;
    action: string;
    entityType: AdminAuditLog["entityType"];
    entityId: string;
    summary: string;
    payload?: Record<string, string>;
  }
): AdminAuditLog {
  const log: AdminAuditLog = {
    id: id("audit"),
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    summary: input.summary,
    payload: input.payload,
    createdAt: now()
  };
  database.adminAuditLogs.push(log);
  return log;
}
