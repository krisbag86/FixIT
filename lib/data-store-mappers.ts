import type { Prisma } from "@prisma/client";
import type {
  AdminAuditLog,
  Category,
  DayLogEntry,
  KnowledgeArticle,
  NotificationLog,
  ResponseMacro,
  ResponseTemplate,
  ScheduleDuty,
  ScheduleTask,
  Session,
  SetupToken,
  Store,
  Ticket,
  TicketAttachment,
  TicketComment,
  TicketEvent,
  User
} from "@/lib/types";

export function iso(value: Date | string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : value;
}

export function definedString(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

export function mapUser(
  user: Prisma.UserGetPayload<object> & { passwordHash?: string | null; mustChangePassword?: boolean; mfaSecret?: string | null },
  options?: { includePasswordHash?: boolean; includeMfaSecret?: boolean }
): User {
  const passwordHash = definedString((user as { passwordHash?: string | null }).passwordHash);
  const mfaSecret = definedString((user as { mfaSecret?: string | null }).mfaSecret);

  return {
    id: user.id,
    name: user.name ?? user.email,
    email: user.email,
    role: user.role,
    storeId: definedString(user.storeId),
    department: definedString(user.department),
    isActive: user.isActive,
    isScheduleMember: user.isScheduleMember,
    scheduleOrder: user.scheduleOrder ?? undefined,
    mustChangePassword: (user as { mustChangePassword?: boolean }).mustChangePassword,
    mfaEnabled: (user as { mfaEnabled?: boolean }).mfaEnabled ?? false,
    ...(options?.includeMfaSecret && mfaSecret ? { mfaSecret } : {}),
    ...(options?.includePasswordHash && passwordHash ? { passwordHash } : {})
  };
}

export function mapStoredUser(user: User, options?: { includePasswordHash?: boolean; includeMfaSecret?: boolean }): User {
  const { passwordHash, mfaSecret, ...safeUser } = user;
  return {
    ...safeUser,
    ...(options?.includePasswordHash && passwordHash ? { passwordHash } : {}),
    ...(options?.includeMfaSecret && mfaSecret ? { mfaSecret } : {})
  };
}

export function mapStore(store: Prisma.StoreGetPayload<object>): Store {
  return {
    id: store.id,
    code: store.code,
    name: store.name,
    city: definedString(store.city) ?? "",
    address: definedString(store.address) ?? "",
    region: definedString(store.region) ?? "",
    isActive: store.isActive
  };
}

export function mapCategory(category: Prisma.CategoryGetPayload<object>): Category {
  return {
    id: category.id,
    name: category.name,
    defaultPriority: category.defaultPriority,
    isActive: category.isActive
  };
}

export function mapTicket(ticket: Prisma.TicketGetPayload<object>): Ticket {
  return {
    id: ticket.id,
    number: ticket.number,
    submissionId: definedString(ticket.submissionId),
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    blocksWork: ticket.blocksWork,
    contact: ticket.contact ?? "",
    categoryId: ticket.categoryId ?? "",
    storeId: definedString(ticket.storeId),
    department: definedString(ticket.department),
    reporterId: ticket.reporterId,
    assigneeId: definedString(ticket.assigneeId),
    // Keep parity with the JSON store, which returns null for unset timestamps.
    dueAt: iso(ticket.dueAt) ?? null,
    resolvedAt: iso(ticket.resolvedAt) ?? null,
    closedAt: iso(ticket.closedAt) ?? null,
    createdAt: iso(ticket.createdAt) ?? "",
    updatedAt: iso(ticket.updatedAt) ?? ""
  };
}

export function mapComment(comment: Prisma.TicketCommentGetPayload<object>): TicketComment {
  return {
    id: comment.id,
    ticketId: comment.ticketId,
    authorId: comment.authorId,
    body: comment.body,
    visibility: comment.visibility,
    createdAt: iso(comment.createdAt) ?? ""
  };
}

export function mapAttachment(attachment: Prisma.TicketAttachmentGetPayload<object>): TicketAttachment {
  return {
    id: attachment.id,
    ticketId: attachment.ticketId,
    commentId: definedString(attachment.commentId),
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: attachment.size,
    storageKey: attachment.storageKey,
    uploadedById: definedString(attachment.uploadedById),
    createdAt: iso(attachment.createdAt) ?? ""
  };
}

export function mapEvent(event: Prisma.TicketEventGetPayload<object>): TicketEvent {
  const payload = typeof event.payload === "object" && event.payload !== null && !Array.isArray(event.payload) ? event.payload : undefined;

  return {
    id: event.id,
    ticketId: event.ticketId,
    actorId: definedString(event.actorId),
    type: event.type,
    payload: payload as Record<string, string> | undefined,
    createdAt: iso(event.createdAt) ?? ""
  };
}

export function mapKnowledgeArticle(article: Prisma.KnowledgeArticleGetPayload<object>): KnowledgeArticle {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    body: article.body,
    categoryId: definedString(article.categoryId),
    isPublished: article.isPublished,
    createdById: definedString(article.createdById),
    updatedById: definedString(article.updatedById)
  };
}

export function mapSession(session: Prisma.SessionGetPayload<object>): Session {
  return {
    id: session.id,
    userId: session.userId,
    createdAt: iso(session.createdAt) ?? "",
    expiresAt: iso(session.expiresAt) ?? "",
    mfaVerified: session.mfaVerified
  };
}

export function mapSetupToken(token: Prisma.SetupTokenGetPayload<object>): SetupToken {
  return {
    id: token.id,
    tokenHash: token.tokenHash,
    email: token.email,
    expiresAt: iso(token.expiresAt) ?? "",
    usedAt: iso(token.usedAt),
    createdAt: iso(token.createdAt) ?? ""
  };
}

export function mapNotificationLog(log: Prisma.NotificationLogGetPayload<object>): NotificationLog {
  return {
    id: log.id,
    ticketId: definedString(log.ticketId),
    recipientEmail: log.recipientEmail,
    type: log.type,
    status: log.status,
    error: definedString(log.error),
    createdAt: iso(log.createdAt) ?? "",
    sentAt: iso(log.sentAt)
  };
}

export type DayLogEntryWithRelations = Prisma.DayLogEntryGetPayload<{
  include: {
    createdBy: { select: { name: true; email: true } };
    ticket: { select: { id: true; number: true } };
  };
}>;

export function mapDayLogEntry(entry: DayLogEntryWithRelations): DayLogEntry {
  return {
    id: entry.id,
    occurredAt: iso(entry.occurredAt) ?? "",
    fromName: entry.fromName,
    subject: entry.subject,
    description: entry.description,
    createdById: entry.createdById,
    createdByName: entry.createdBy.name ?? entry.createdBy.email,
    createdByEmail: entry.createdBy.email,
    ticketId: definedString(entry.ticketId),
    ticketNumber: entry.ticket?.number,
    createdAt: iso(entry.createdAt) ?? "",
    updatedAt: iso(entry.updatedAt) ?? ""
  };
}

export function mapScheduleTask(task: Prisma.ScheduleTaskGetPayload<object>): ScheduleTask {
  return {
    id: task.id,
    date: task.date.toISOString().slice(0, 10),
    title: task.title,
    description: definedString(task.description),
    isCompleted: task.isCompleted,
    assigneeId: task.assigneeId,
    createdById: task.createdById,
    updatedById: task.updatedById,
    createdAt: iso(task.createdAt) ?? "",
    updatedAt: iso(task.updatedAt) ?? ""
  };
}

export function mapScheduleDuty(duty: Prisma.ScheduleDutyGetPayload<object>): ScheduleDuty {
  return {
    id: duty.id,
    date: duty.date.toISOString().slice(0, 10),
    assigneeId: duty.assigneeId,
    createdById: duty.createdById,
    createdAt: iso(duty.createdAt) ?? ""
  };
}

export function mapAdminAuditLog(log: Prisma.AdminAuditLogGetPayload<object>): AdminAuditLog {
  const payload =
    typeof log.payload === "object" && log.payload !== null && !Array.isArray(log.payload)
      ? Object.fromEntries(Object.entries(log.payload).map(([key, value]) => [key, String(value)]))
      : undefined;

  return {
    id: log.id,
    actorId: definedString(log.actorId),
    action: log.action,
    entityType: log.entityType as AdminAuditLog["entityType"],
    entityId: log.entityId,
    summary: log.summary,
    payload,
    createdAt: iso(log.createdAt) ?? ""
  };
}

export function mapTemplate(t: Prisma.ResponseTemplateGetPayload<object>): ResponseTemplate {
  return {
    id: t.id,
    name: t.name,
    body: t.body,
    category: t.category ?? undefined,
    isActive: t.isActive,
    createdById: t.createdById,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString()
  };
}

export function mapMacro(m: Prisma.ResponseMacroGetPayload<object>): ResponseMacro {
  return {
    id: m.id,
    name: m.name,
    templateId: m.templateId ?? undefined,
    body: m.body ?? undefined,
    newStatus: m.newStatus ?? undefined,
    newPriority: m.newPriority ?? undefined,
    isActive: m.isActive,
    createdById: m.createdById,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString()
  };
}
