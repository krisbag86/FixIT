import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { unstable_noStore as noStore } from "next/cache";
import type { Prisma } from "@prisma/client";
import {
  buildAuditPayload,
  describeAuditChanges,
  getCategoryAuditChanges,
  getCategoryUsageSummary,
  getKnowledgeArticleAuditChanges,
  getStoreAuditChanges,
  getStoreUsageSummary,
  getUserAuditChanges
} from "@/lib/admin-utils";
import { createSeedDatabase } from "@/lib/seed";
import { addScheduleDays, isScheduleWeekend, resolveScheduleWeekStart, scheduleDateValue } from "@/lib/schedule";
import { generateTicketNumber } from "@/lib/ticket-number";
import { archivedStatuses, closedStatuses, matchesTicketFilters, type TicketListFilters } from "@/lib/ticket-filters";
import type {
  AdminAuditLog,
  Category,
  CommentVisibility,
  DashboardData,
  DashboardMetrics,
  Database,
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
  TicketPriority,
  TicketStatus,
  User,
  UserRole,
  WeeklyScheduleData
} from "@/lib/types";

const dataDir = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "fixit-db.json");
let databaseWriteQueue: Promise<void> = Promise.resolve();

function shouldUsePrisma(): boolean {
  if (process.env.FIXIT_DATA_PROVIDER === "json") {
    return false;
  }

  if (process.env.FIXIT_DATA_PROVIDER === "prisma") {
    return true;
  }

  return process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL);
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

class DayLogEntryLinkError extends Error {}

async function getPrisma() {
  return (await import("@/lib/prisma")).prisma;
}

function now(): string {
  return new Date().toISOString();
}

function nextTimestamp(previous?: string): string {
  const current = Date.now();
  const previousTime = previous ? Date.parse(previous) : Number.NaN;
  return new Date(Math.max(current, Number.isFinite(previousTime) ? previousTime + 1 : current)).toISOString();
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function iso(value: Date | string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function definedString(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

function mapUser(
  user: Prisma.UserGetPayload<object> & { passwordHash?: string | null; mustChangePassword?: boolean },
  options?: { includePasswordHash?: boolean }
): User {
  const passwordHash = definedString((user as { passwordHash?: string | null }).passwordHash);

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
    ...(options?.includePasswordHash && passwordHash ? { passwordHash } : {})
  };
}

function mapStoredUser(user: User, options?: { includePasswordHash?: boolean }): User {
  const { passwordHash, ...safeUser } = user;
  return options?.includePasswordHash && passwordHash ? { ...safeUser, passwordHash } : safeUser;
}

function mapStore(store: Prisma.StoreGetPayload<object>): Store {
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

function mapCategory(category: Prisma.CategoryGetPayload<object>): Category {
  return {
    id: category.id,
    name: category.name,
    defaultPriority: category.defaultPriority,
    isActive: category.isActive
  };
}

function mapTicket(ticket: Prisma.TicketGetPayload<object>): Ticket {
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
    dueAt: iso(ticket.dueAt),
    resolvedAt: iso(ticket.resolvedAt),
    closedAt: iso(ticket.closedAt),
    createdAt: iso(ticket.createdAt) ?? "",
    updatedAt: iso(ticket.updatedAt) ?? ""
  };
}

function mapComment(comment: Prisma.TicketCommentGetPayload<object>): TicketComment {
  return {
    id: comment.id,
    ticketId: comment.ticketId,
    authorId: comment.authorId,
    body: comment.body,
    visibility: comment.visibility,
    createdAt: iso(comment.createdAt) ?? ""
  };
}

function mapAttachment(attachment: Prisma.TicketAttachmentGetPayload<object>): TicketAttachment {
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

function mapEvent(event: Prisma.TicketEventGetPayload<object>): TicketEvent {
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

function mapKnowledgeArticle(article: Prisma.KnowledgeArticleGetPayload<object>): KnowledgeArticle {
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

function mapSession(session: Prisma.SessionGetPayload<object>): Session {
  return {
    id: session.id,
    userId: session.userId,
    createdAt: iso(session.createdAt) ?? "",
    expiresAt: iso(session.expiresAt) ?? ""
  };
}

function mapSetupToken(token: Prisma.SetupTokenGetPayload<object>): SetupToken {
  return {
    id: token.id,
    tokenHash: token.tokenHash,
    email: token.email,
    expiresAt: iso(token.expiresAt) ?? "",
    usedAt: iso(token.usedAt),
    createdAt: iso(token.createdAt) ?? ""
  };
}

function mapNotificationLog(log: Prisma.NotificationLogGetPayload<object>): NotificationLog {
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

type DayLogEntryWithRelations = Prisma.DayLogEntryGetPayload<{
  include: {
    createdBy: { select: { name: true; email: true } };
    ticket: { select: { id: true; number: true } };
  };
}>;

function mapDayLogEntry(entry: DayLogEntryWithRelations): DayLogEntry {
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

function mapScheduleTask(task: Prisma.ScheduleTaskGetPayload<object>): ScheduleTask {
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

function mapScheduleDuty(duty: Prisma.ScheduleDutyGetPayload<object>): ScheduleDuty {
  return {
    id: duty.id,
    date: duty.date.toISOString().slice(0, 10),
    assigneeId: duty.assigneeId,
    createdById: duty.createdById,
    createdAt: iso(duty.createdAt) ?? ""
  };
}

function mapAdminAuditLog(log: Prisma.AdminAuditLogGetPayload<object>): AdminAuditLog {
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

async function ensureDatabase(): Promise<Database> {
  try {
    const raw = await readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<Database>;
    if (!Array.isArray(parsed.attachments)) {
      parsed.attachments = [];
    }
    if (!Array.isArray(parsed.adminAuditLogs)) {
      parsed.adminAuditLogs = [];
    }
    if (!Array.isArray(parsed.responseTemplates)) {
      parsed.responseTemplates = [];
    }
    if (!Array.isArray(parsed.responseMacros)) {
      parsed.responseMacros = [];
    }
    if (!Array.isArray(parsed.dayLogEntries)) {
      parsed.dayLogEntries = [];
    }
    if (!Array.isArray(parsed.scheduleTasks)) {
      parsed.scheduleTasks = [];
    }
    if (!Array.isArray(parsed.scheduleDuties)) {
      parsed.scheduleDuties = [];
    }
    if (!Array.isArray(parsed.setupTokens)) {
      parsed.setupTokens = [];
    }
    if (Array.isArray(parsed.stores)) {
      parsed.stores = parsed.stores.map((store) => ({
        ...store,
        address: store.address ?? ""
      }));
    }
    return parsed as Database;
  } catch {
    const seed = createSeedDatabase();
    await writeDatabase(seed);
    return seed;
  }
}

export async function readDatabase(): Promise<Database> {
  noStore();
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const [users, stores, categories, tickets, comments, attachments, events, knowledgeArticles, notificationLogs, adminAuditLogs, counters, sessions, setupTokens, responseTemplates, responseMacros, dayLogEntries, scheduleTasks, scheduleDuties] =
      await Promise.all([
        db.user.findMany(),
        db.store.findMany(),
        db.category.findMany(),
        db.ticket.findMany(),
        db.ticketComment.findMany(),
        db.ticketAttachment.findMany(),
        db.ticketEvent.findMany(),
        db.knowledgeArticle.findMany(),
        db.notificationLog.findMany(),
        db.adminAuditLog.findMany(),
        db.ticketCounter.findMany(),
        db.session.findMany(),
        db.setupToken.findMany(),
        db.responseTemplate.findMany(),
        db.responseMacro.findMany(),
        db.dayLogEntry.findMany({
          include: {
            createdBy: { select: { name: true, email: true } },
            ticket: { select: { id: true, number: true } }
          },
          orderBy: { occurredAt: "desc" }
        }),
        db.scheduleTask.findMany(),
        db.scheduleDuty.findMany()
      ]);

    return {
      meta: {
        ticketSequences: Object.fromEntries(counters.map((counter) => [String(counter.year), counter.sequence]))
      },
      users: users.map((user) => mapUser(user)),
      stores: stores.map(mapStore),
      categories: categories.map(mapCategory),
      tickets: tickets.map(mapTicket),
      comments: comments.map(mapComment),
      attachments: attachments.map(mapAttachment),
      events: events.map(mapEvent),
      knowledgeArticles: knowledgeArticles.map(mapKnowledgeArticle),
      notificationLogs: notificationLogs.map(mapNotificationLog),
      adminAuditLogs: adminAuditLogs.map(mapAdminAuditLog),
      sessions: sessions.map(mapSession),
      setupTokens: setupTokens.map(mapSetupToken),
      responseTemplates: responseTemplates.map(mapTemplate),
      responseMacros: responseMacros.map(mapMacro),
      dayLogEntries: dayLogEntries.map(mapDayLogEntry),
      scheduleTasks: scheduleTasks.map(mapScheduleTask),
      scheduleDuties: scheduleDuties.map(mapScheduleDuty)
    };
  }

  return ensureDatabase();
}

export async function listDayLogEntries(): Promise<DayLogEntry[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const entries = await db.dayLogEntry.findMany({
      include: {
        createdBy: { select: { name: true, email: true } },
        ticket: { select: { id: true, number: true } }
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
    });
    return entries.map(mapDayLogEntry);
  }

  const database = await readDatabase();
  return [...(database.dayLogEntries ?? [])]
    .map((entry) => ({
      ...entry,
      createdByName: database.users.find((user) => user.id === entry.createdById)?.name,
      createdByEmail: database.users.find((user) => user.id === entry.createdById)?.email,
      ticketNumber: database.tickets.find((ticket) => ticket.id === entry.ticketId)?.number
    }))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt));
}

export async function findDayLogEntry(id: string): Promise<DayLogEntry | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const entry = await db.dayLogEntry.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true, email: true } },
        ticket: { select: { id: true, number: true } }
      }
    });
    return entry ? mapDayLogEntry(entry) : undefined;
  }

  const database = await readDatabase();
  const entry = database.dayLogEntries?.find((item) => item.id === id);
  if (!entry) {
    return undefined;
  }

  const author = database.users.find((user) => user.id === entry.createdById);
  return {
    ...entry,
    createdByName: author?.name,
    createdByEmail: author?.email,
    ticketNumber: database.tickets.find((ticket) => ticket.id === entry.ticketId)?.number
  };
}

export async function createDayLogEntry(input: {
  occurredAt: string;
  fromName: string;
  subject: string;
  description: string;
  createdById: string;
}): Promise<DayLogEntry> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const entry = await db.dayLogEntry.create({
      data: {
        occurredAt: new Date(input.occurredAt),
        fromName: input.fromName,
        subject: input.subject,
        description: input.description,
        createdById: input.createdById
      },
      include: {
        createdBy: { select: { name: true, email: true } },
        ticket: { select: { id: true, number: true } }
      }
    });
    return mapDayLogEntry(entry);
  }

  return withDatabase((database) => {
    const timestamp = now();
    const author = database.users.find((user) => user.id === input.createdById);
    const entry: DayLogEntry = {
      id: id("daylog"),
      occurredAt: input.occurredAt,
      fromName: input.fromName,
      subject: input.subject,
      description: input.description,
      createdById: input.createdById,
      createdByName: author?.name,
      createdByEmail: author?.email,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    database.dayLogEntries ??= [];
    database.dayLogEntries.push(entry);
    return entry;
  });
}

export async function updateDayLogEntry(input: {
  id: string;
  occurredAt: string;
  fromName: string;
  subject: string;
  description: string;
}): Promise<DayLogEntry | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const existing = await db.dayLogEntry.findUnique({ where: { id: input.id } });

    if (!existing) {
      return undefined;
    }

    const entry = await db.dayLogEntry.update({
      where: { id: input.id },
      data: {
        occurredAt: new Date(input.occurredAt),
        fromName: input.fromName,
        subject: input.subject,
        description: input.description
      },
      include: {
        createdBy: { select: { name: true, email: true } },
        ticket: { select: { id: true, number: true } }
      }
    });

    return mapDayLogEntry(entry);
  }

  return withDatabase((database) => {
    const entry = database.dayLogEntries?.find((item) => item.id === input.id);

    if (!entry) {
      return undefined;
    }

    entry.occurredAt = input.occurredAt;
    entry.fromName = input.fromName;
    entry.subject = input.subject;
    entry.description = input.description;
    entry.updatedAt = nextTimestamp(entry.updatedAt);
    return entry;
  });
}

export async function deleteDayLogEntry(id: string): Promise<boolean> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const existing = await db.dayLogEntry.findUnique({ where: { id }, select: { id: true } });

    if (!existing) {
      return false;
    }

    await db.dayLogEntry.delete({ where: { id } });
    return true;
  }

  return withDatabase((database) => {
    const entries = database.dayLogEntries ?? [];
    const index = entries.findIndex((entry) => entry.id === id);

    if (index === -1) {
      return false;
    }

    entries.splice(index, 1);
    return true;
  });
}

function sortScheduleMembers(members: User[]): User[] {
  const collator = new Intl.Collator("pl", { sensitivity: "base" });
  return [...members].sort((left, right) => {
    const orderDifference = (left.scheduleOrder ?? Number.MAX_SAFE_INTEGER) - (right.scheduleOrder ?? Number.MAX_SAFE_INTEGER);
    return orderDifference || collator.compare(left.name || left.email, right.name || right.email);
  });
}

function scheduleRange(weekStart: string): { weekStart: string; start: Date; end: Date } {
  const normalized = resolveScheduleWeekStart(weekStart);
  return {
    weekStart: normalized,
    start: scheduleDateValue(normalized),
    end: scheduleDateValue(addScheduleDays(normalized, 7))
  };
}

function isEligibleScheduleMember(user: User | undefined): boolean {
  return Boolean(user?.isActive && user.isScheduleMember && (user.role === "AGENT" || user.role === "ADMIN"));
}

export async function getWeeklySchedule(weekStart: string): Promise<WeeklyScheduleData> {
  const range = scheduleRange(weekStart);

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const [activeMembers, tasks, duties] = await Promise.all([
      db.user.findMany({
        where: {
          isActive: true,
          isScheduleMember: true,
          role: { in: ["AGENT", "ADMIN"] }
        }
      }),
      db.scheduleTask.findMany({
        where: { date: { gte: range.start, lt: range.end } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }]
      }),
      db.scheduleDuty.findMany({
        where: { date: { gte: range.start, lt: range.end } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }]
      })
    ]);

    const activeIds = new Set(activeMembers.map((member) => member.id));
    const historicalIds = [...new Set([...tasks.map((task) => task.assigneeId), ...duties.map((duty) => duty.assigneeId)])]
      .filter((id) => !activeIds.has(id));
    const historicalMembers = historicalIds.length > 0
      ? await db.user.findMany({ where: { id: { in: historicalIds } } })
      : [];

    return {
      weekStart: range.weekStart,
      members: sortScheduleMembers([...activeMembers, ...historicalMembers].map((user) => mapUser(user))),
      tasks: tasks.map(mapScheduleTask),
      duties: duties.map(mapScheduleDuty)
    };
  }

  const database = await readDatabase();
  const tasks = (database.scheduleTasks ?? [])
    .filter((task) => task.date >= range.weekStart && task.date < addScheduleDays(range.weekStart, 7))
    .sort((left, right) => left.date.localeCompare(right.date) || left.createdAt.localeCompare(right.createdAt));
  const duties = (database.scheduleDuties ?? [])
    .filter((duty) => duty.date >= range.weekStart && duty.date < addScheduleDays(range.weekStart, 7))
    .sort((left, right) => left.date.localeCompare(right.date) || left.createdAt.localeCompare(right.createdAt));
  const referencedIds = new Set([...tasks.map((task) => task.assigneeId), ...duties.map((duty) => duty.assigneeId)]);
  const members = database.users
    .filter((user) => isEligibleScheduleMember(user) || referencedIds.has(user.id))
    .map((user) => mapStoredUser(user));

  return {
    weekStart: range.weekStart,
    members: sortScheduleMembers(members),
    tasks,
    duties
  };
}

export async function findScheduleTask(id: string): Promise<ScheduleTask | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const task = await db.scheduleTask.findUnique({ where: { id } });
    return task ? mapScheduleTask(task) : undefined;
  }

  const database = await readDatabase();
  return database.scheduleTasks?.find((task) => task.id === id);
}

export async function createScheduleTask(input: {
  date: string;
  title: string;
  description?: string;
  assigneeId: string;
  actorId: string;
}): Promise<ScheduleTask> {
  const date = scheduleDateValue(input.date);

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const assignee = await db.user.findFirst({
      where: {
        id: input.assigneeId,
        isActive: true,
        isScheduleMember: true,
        role: { in: ["AGENT", "ADMIN"] }
      },
      select: { id: true }
    });
    if (!assignee) {
      throw new Error("Wybrany użytkownik nie jest aktywnym członkiem grafiku.");
    }

    const task = await db.scheduleTask.create({
      data: {
        date,
        title: input.title,
        description: input.description,
        assigneeId: input.assigneeId,
        createdById: input.actorId,
        updatedById: input.actorId
      }
    });
    return mapScheduleTask(task);
  }

  return withDatabase((database) => {
    const assignee = database.users.find((user) => user.id === input.assigneeId);
    if (!isEligibleScheduleMember(assignee)) {
      throw new Error("Wybrany użytkownik nie jest aktywnym członkiem grafiku.");
    }

    const timestamp = now();
    const task: ScheduleTask = {
      id: id("schedule-task"),
      date: input.date,
      title: input.title,
      description: input.description,
      isCompleted: false,
      assigneeId: input.assigneeId,
      createdById: input.actorId,
      updatedById: input.actorId,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    database.scheduleTasks ??= [];
    database.scheduleTasks.push(task);
    return task;
  });
}

export async function updateScheduleTask(input: {
  id: string;
  title: string;
  description?: string;
  actorId: string;
}): Promise<ScheduleTask | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const existing = await db.scheduleTask.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!existing) return undefined;
    return mapScheduleTask(await db.scheduleTask.update({
      where: { id: input.id },
      data: { title: input.title, description: input.description, updatedById: input.actorId }
    }));
  }

  return withDatabase((database) => {
    const task = database.scheduleTasks?.find((item) => item.id === input.id);
    if (!task) return undefined;
    task.title = input.title;
    task.description = input.description;
    task.updatedById = input.actorId;
    task.updatedAt = now();
    return task;
  });
}

export async function toggleScheduleTask(input: { id: string; actorId: string }): Promise<ScheduleTask | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const existing = await db.scheduleTask.findUnique({ where: { id: input.id } });
    if (!existing) return undefined;
    return mapScheduleTask(await db.scheduleTask.update({
      where: { id: input.id },
      data: { isCompleted: !existing.isCompleted, updatedById: input.actorId }
    }));
  }

  return withDatabase((database) => {
    const task = database.scheduleTasks?.find((item) => item.id === input.id);
    if (!task) return undefined;
    task.isCompleted = !task.isCompleted;
    task.updatedById = input.actorId;
    task.updatedAt = now();
    return task;
  });
}

export async function deleteScheduleTask(id: string): Promise<boolean> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const deleted = await db.scheduleTask.deleteMany({ where: { id } });
    return deleted.count > 0;
  }

  return withDatabase((database) => {
    const tasks = database.scheduleTasks ?? [];
    const index = tasks.findIndex((task) => task.id === id);
    if (index === -1) return false;
    tasks.splice(index, 1);
    return true;
  });
}

export async function setScheduleDuty(input: {
  date: string;
  assigneeId: string;
  isOnCall: boolean;
  actorId: string;
}): Promise<ScheduleDuty | undefined> {
  const date = scheduleDateValue(input.date);

  if (input.isOnCall && !isScheduleWeekend(input.date)) {
    throw new Error("Dyżur można ustawić tylko w sobotę lub niedzielę.");
  }

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    if (!input.isOnCall) {
      await db.scheduleDuty.deleteMany({ where: { date, assigneeId: input.assigneeId } });
      return undefined;
    }

    const assignee = await db.user.findFirst({
      where: { id: input.assigneeId, isActive: true, isScheduleMember: true, role: { in: ["AGENT", "ADMIN"] } },
      select: { id: true }
    });
    if (!assignee) {
      throw new Error("Wybrany użytkownik nie jest aktywnym członkiem grafiku.");
    }

    return mapScheduleDuty(await db.scheduleDuty.upsert({
      where: { date_assigneeId: { date, assigneeId: input.assigneeId } },
      create: { date, assigneeId: input.assigneeId, createdById: input.actorId },
      update: {}
    }));
  }

  return withDatabase((database) => {
    database.scheduleDuties ??= [];
    const existingIndex = database.scheduleDuties.findIndex(
      (duty) => duty.date === input.date && duty.assigneeId === input.assigneeId
    );
    if (!input.isOnCall) {
      if (existingIndex >= 0) database.scheduleDuties.splice(existingIndex, 1);
      return undefined;
    }

    const assignee = database.users.find((user) => user.id === input.assigneeId);
    if (!isEligibleScheduleMember(assignee)) {
      throw new Error("Wybrany użytkownik nie jest aktywnym członkiem grafiku.");
    }
    if (existingIndex >= 0) return database.scheduleDuties[existingIndex];

    const duty: ScheduleDuty = {
      id: id("schedule-duty"),
      date: input.date,
      assigneeId: input.assigneeId,
      createdById: input.actorId,
      createdAt: now()
    };
    database.scheduleDuties.push(duty);
    return duty;
  });
}

export async function copyPreviousScheduleWeek(input: {
  targetWeekStart: string;
  actorId: string;
}): Promise<{ taskCount: number; dutyCount: number }> {
  const target = scheduleRange(input.targetWeekStart);
  const sourceWeekStart = addScheduleDays(target.weekStart, -7);
  const source = scheduleRange(sourceWeekStart);

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    try {
      return await db.$transaction(async (tx) => {
        const [targetTasks, targetDuties] = await Promise.all([
          tx.scheduleTask.count({ where: { date: { gte: target.start, lt: target.end } } }),
          tx.scheduleDuty.count({ where: { date: { gte: target.start, lt: target.end } } })
        ]);
        if (targetTasks > 0 || targetDuties > 0) {
          throw new Error("Docelowy tydzień nie jest pusty.");
        }

        const activeMembers = await tx.user.findMany({
          where: { isActive: true, isScheduleMember: true, role: { in: ["AGENT", "ADMIN"] } },
          select: { id: true }
        });
        const memberIds = activeMembers.map((member) => member.id);
        const [tasks, sourceDuties] = await Promise.all([
          tx.scheduleTask.findMany({ where: { date: { gte: source.start, lt: source.end }, assigneeId: { in: memberIds } } }),
          tx.scheduleDuty.findMany({ where: { date: { gte: source.start, lt: source.end }, assigneeId: { in: memberIds } } })
        ]);
        const duties = sourceDuties.filter((duty) => isScheduleWeekend(duty.date.toISOString().slice(0, 10)));
        if (tasks.length === 0 && duties.length === 0) {
          throw new Error("Poprzedni tydzień nie zawiera danych do skopiowania.");
        }

        if (tasks.length > 0) {
          await tx.scheduleTask.createMany({
            data: tasks.map((task) => ({
              date: scheduleDateValue(addScheduleDays(task.date.toISOString().slice(0, 10), 7)),
              title: task.title,
              description: task.description,
              isCompleted: false,
              assigneeId: task.assigneeId,
              createdById: input.actorId,
              updatedById: input.actorId
            }))
          });
        }
        if (duties.length > 0) {
          await tx.scheduleDuty.createMany({
            data: duties.map((duty) => ({
              date: scheduleDateValue(addScheduleDays(duty.date.toISOString().slice(0, 10), 7)),
              assigneeId: duty.assigneeId,
              createdById: input.actorId
            }))
          });
        }

        return { taskCount: tasks.length, dutyCount: duties.length };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
        throw new Error("Grafik został równocześnie zmieniony. Odśwież stronę i spróbuj ponownie.");
      }
      throw error;
    }
  }

  return withDatabase((database) => {
    database.scheduleTasks ??= [];
    database.scheduleDuties ??= [];
    const targetEnd = addScheduleDays(target.weekStart, 7);
    if (
      database.scheduleTasks.some((task) => task.date >= target.weekStart && task.date < targetEnd) ||
      database.scheduleDuties.some((duty) => duty.date >= target.weekStart && duty.date < targetEnd)
    ) {
      throw new Error("Docelowy tydzień nie jest pusty.");
    }

    const activeMemberIds = new Set(database.users.filter(isEligibleScheduleMember).map((user) => user.id));
    const sourceEnd = addScheduleDays(source.weekStart, 7);
    const tasks = database.scheduleTasks.filter(
      (task) => task.date >= source.weekStart && task.date < sourceEnd && activeMemberIds.has(task.assigneeId)
    );
    const duties = database.scheduleDuties.filter(
      (duty) => duty.date >= source.weekStart && duty.date < sourceEnd && activeMemberIds.has(duty.assigneeId) && isScheduleWeekend(duty.date)
    );
    if (tasks.length === 0 && duties.length === 0) {
      throw new Error("Poprzedni tydzień nie zawiera danych do skopiowania.");
    }

    const timestamp = now();
    database.scheduleTasks.push(...tasks.map((task) => ({
      ...task,
      id: id("schedule-task"),
      date: addScheduleDays(task.date, 7),
      isCompleted: false,
      createdById: input.actorId,
      updatedById: input.actorId,
      createdAt: timestamp,
      updatedAt: timestamp
    })));
    database.scheduleDuties.push(...duties.map((duty) => ({
      ...duty,
      id: id("schedule-duty"),
      date: addScheduleDays(duty.date, 7),
      createdById: input.actorId,
      createdAt: timestamp
    })));
    return { taskCount: tasks.length, dutyCount: duties.length };
  });
}

export async function writeDatabase(database: Database): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(database, null, 2)}\n`, "utf8");
}

export async function withDatabase<T>(mutator: (database: Database) => T | Promise<T>): Promise<T> {
  let result!: T;
  const operation = databaseWriteQueue.then(async () => {
    const database = await ensureDatabase();
    result = await mutator(database);
    await writeDatabase(database);
  });

  databaseWriteQueue = operation.then(
    () => undefined,
    () => undefined
  );

  await operation;
  return result;
}

function appendAdminAuditLog(
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

async function ensureActiveAdminRemains(userId: string, nextRole: UserRole, nextIsActive: boolean): Promise<void> {
  if (nextRole === "ADMIN" && nextIsActive) {
    return;
  }

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const activeAdminCount = await db.user.count({
      where: {
        role: "ADMIN",
        isActive: true,
        NOT: { id: userId }
      }
    });

    if (activeAdminCount === 0) {
      throw new Error("Nie można odebrać ostatniego aktywnego administratora.");
    }

    return;
  }

  const database = await readDatabase();
  const activeAdminCount = database.users.filter((user) => user.role === "ADMIN" && user.isActive && user.id !== userId).length;

  if (activeAdminCount === 0) {
    throw new Error("Nie można odebrać ostatniego aktywnego administratora.");
  }
}

export async function getCategories(): Promise<Category[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const categories = await db.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" }
    });
    return categories.map(mapCategory);
  }

  const database = await readDatabase();
  return database.categories.filter((category) => category.isActive);
}

export async function listUsersAdmin(options?: { includeInactive?: boolean; query?: string }): Promise<User[]> {
  const query = options?.query?.trim().toLowerCase();

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const users = await db.user.findMany({
      where: {
        ...(options?.includeInactive ? {} : { isActive: true }),
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { department: { contains: query, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }, { email: "asc" }]
    });
    return users.map((user) => mapUser(user));
  }

  const database = await readDatabase();
  return database.users
    .filter((user) => options?.includeInactive || user.isActive)
    .filter((user) => {
      if (!query) {
        return true;
      }

      return [user.name, user.email, user.department]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query));
    })
    .sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }

      return `${a.role}-${a.name}-${a.email}`.localeCompare(`${b.role}-${b.name}-${b.email}`);
    })
    .map((user) => mapStoredUser(user));
}

export async function listStoresAdmin(options?: { includeInactive?: boolean }): Promise<Store[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const stores = await db.store.findMany({
      where: options?.includeInactive ? undefined : { isActive: true },
      orderBy: [{ isActive: "desc" }, { code: "asc" }]
    });
    return stores.map(mapStore);
  }

  const database = await readDatabase();
  return database.stores
    .filter((store) => options?.includeInactive || store.isActive)
    .sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }

      return a.code.localeCompare(b.code);
    });
}

export async function getKnowledgePageData(options?: {
  includeUnpublished?: boolean;
  categoryId?: string;
  query?: string;
}): Promise<{ articles: KnowledgeArticle[]; categories: Category[] }> {
  const query = options?.query?.trim();

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const [articles, categories] = await Promise.all([
      db.knowledgeArticle.findMany({
        where: {
          ...(options?.includeUnpublished ? {} : { isPublished: true }),
          ...(options?.categoryId ? { categoryId: options.categoryId } : {}),
          ...(query
            ? {
                OR: [
                  { title: { contains: query, mode: "insensitive" } },
                  { body: { contains: query, mode: "insensitive" } }
                ]
              }
            : {})
        },
        orderBy: { title: "asc" }
      }),
      db.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })
    ]);
    return { articles: articles.map(mapKnowledgeArticle), categories: categories.map(mapCategory) };
  }

  const database = await readDatabase();
  return {
    articles: database.knowledgeArticles
      .filter((article) => options?.includeUnpublished || article.isPublished)
      .filter((article) => !options?.categoryId || article.categoryId === options.categoryId)
      .filter((article) => !query || article.title.toLowerCase().includes(query.toLowerCase()) || article.body.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.title.localeCompare(b.title)),
    categories: database.categories.filter((category) => category.isActive).sort((a, b) => a.name.localeCompare(b.name))
  };
}

export async function getNewTicketFormData(): Promise<{
  stores: Store[];
  categories: Category[];
  articles: KnowledgeArticle[];
}> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const [stores, categories, articles] = await Promise.all([
      db.store.findMany({ where: { isActive: true }, orderBy: [{ code: "asc" }] }),
      db.category.findMany({ where: { isActive: true }, orderBy: [{ name: "asc" }] }),
      db.knowledgeArticle.findMany({ where: { isPublished: true }, orderBy: [{ title: "asc" }] })
    ]);
    return { stores: stores.map(mapStore), categories: categories.map(mapCategory), articles: articles.map(mapKnowledgeArticle) };
  }

  const database = await readDatabase();
  return {
    stores: database.stores.filter((store) => store.isActive),
    categories: database.categories.filter((category) => category.isActive),
    articles: database.knowledgeArticles.filter((article) => article.isPublished)
  };
}

export async function findCategoryById(categoryId: string): Promise<Category | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const category = await db.category.findUnique({ where: { id: categoryId } });
    return category ? mapCategory(category) : undefined;
  }

  const database = await readDatabase();
  return database.categories.find((category) => category.id === categoryId);
}

export async function getCategoryAdminPageData(): Promise<{
  categories: Category[];
  usage: Record<string, { ticketCount: number; articleCount: number }>;
}> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const [categories, tickets, articles] = await Promise.all([
      db.category.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
      db.ticket.groupBy({ by: ["categoryId"], _count: { _all: true } }),
      db.knowledgeArticle.groupBy({ by: ["categoryId"], _count: { _all: true } })
    ]);
    const usage: Record<string, { ticketCount: number; articleCount: number }> = {};
    for (const row of tickets) {
      if (row.categoryId) usage[row.categoryId] = { ticketCount: row._count._all, articleCount: usage[row.categoryId]?.articleCount ?? 0 };
    }
    for (const row of articles) {
      if (row.categoryId) usage[row.categoryId] = { ticketCount: usage[row.categoryId]?.ticketCount ?? 0, articleCount: row._count._all };
    }
    return { categories: categories.map(mapCategory), usage };
  }

  const database = await readDatabase();
  const usage: Record<string, { ticketCount: number; articleCount: number }> = {};
  for (const ticket of database.tickets) {
    usage[ticket.categoryId] = usage[ticket.categoryId] ?? { ticketCount: 0, articleCount: 0 };
    usage[ticket.categoryId].ticketCount += 1;
  }
  for (const article of database.knowledgeArticles) {
    if (!article.categoryId) continue;
    usage[article.categoryId] = usage[article.categoryId] ?? { ticketCount: 0, articleCount: 0 };
    usage[article.categoryId].articleCount += 1;
  }
  return {
    categories: [...database.categories].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)),
    usage
  };
}

export async function getStoreAdminPageData(): Promise<{
  stores: Store[];
  usage: Record<string, { userCount: number; ticketCount: number }>;
}> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const [stores, users, tickets] = await Promise.all([
      db.store.findMany({ orderBy: [{ isActive: "desc" }, { code: "asc" }] }),
      db.user.groupBy({ by: ["storeId"], _count: { _all: true } }),
      db.ticket.groupBy({ by: ["storeId"], _count: { _all: true } })
    ]);
    const usage: Record<string, { userCount: number; ticketCount: number }> = {};
    for (const row of users) {
      if (row.storeId) usage[row.storeId] = { userCount: row._count._all, ticketCount: usage[row.storeId]?.ticketCount ?? 0 };
    }
    for (const row of tickets) {
      if (row.storeId) usage[row.storeId] = { userCount: usage[row.storeId]?.userCount ?? 0, ticketCount: row._count._all };
    }
    return { stores: stores.map(mapStore), usage };
  }

  const database = await readDatabase();
  const usage: Record<string, { userCount: number; ticketCount: number }> = {};
  for (const user of database.users) {
    if (!user.storeId) continue;
    usage[user.storeId] = usage[user.storeId] ?? { userCount: 0, ticketCount: 0 };
    usage[user.storeId].userCount += 1;
  }
  for (const ticket of database.tickets) {
    if (!ticket.storeId) continue;
    usage[ticket.storeId] = usage[ticket.storeId] ?? { userCount: 0, ticketCount: 0 };
    usage[ticket.storeId].ticketCount += 1;
  }
  return {
    stores: [...database.stores].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.code.localeCompare(b.code)),
    usage
  };
}

export async function getTicketBoardData(user: User): Promise<{ tickets: Ticket[]; users: User[] }> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const [tickets, users] = await Promise.all([
      db.ticket.findMany({ where: { status: { notIn: [...archivedStatuses] } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }] }),
      db.user.findMany({ where: { isActive: true }, orderBy: [{ role: "asc" }, { name: "asc" }, { email: "asc" }] })
    ]);
    return { tickets: tickets.map(mapTicket), users: users.map((user) => mapUser(user)) };
  }

  const database = await readDatabase();
  return {
    tickets: filterVisibleTickets(database.tickets, user, {}),
    users: database.users.filter((item) => item.isActive).map((item) => mapStoredUser(item))
  };
}

export async function listAdminAuditLogs(limit = 20): Promise<AdminAuditLog[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const logs = await db.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit
    });
    return logs.map(mapAdminAuditLog);
  }

  const database = await readDatabase();
  return [...database.adminAuditLogs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function findUserByEmail(
  email: string,
  options?: { includeInactive?: boolean; includePasswordHash?: boolean }
): Promise<User | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const user = await db.user.findUnique({ where: { email } });

    if (!user || (!options?.includeInactive && !user.isActive)) {
      return undefined;
    }

    return mapUser(user, options);
  }

  const database = await readDatabase();
  const user = database.users.find((item) => item.email === email && (options?.includeInactive || item.isActive));
  return user ? mapStoredUser(user, options) : undefined;
}

export async function findUserById(
  userId: string,
  options?: { includeInactive?: boolean; includePasswordHash?: boolean }
): Promise<User | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const user = await db.user.findFirst({
      where: { id: userId, ...(options?.includeInactive ? {} : { isActive: true }) }
    });
    return user ? mapUser(user, options) : undefined;
  }

  const database = await readDatabase();
  const user = database.users.find((item) => item.id === userId && (options?.includeInactive || item.isActive));
  return user ? mapStoredUser(user, options) : undefined;
}

export async function findUsersByIds(userIds: string[], options?: { includeInactive?: boolean }): Promise<User[]> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return [];

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const users = await db.user.findMany({
      where: {
        id: { in: ids },
        ...(options?.includeInactive ? {} : { isActive: true })
      }
    });
    return users.map((user) => mapUser(user));
  }

  const database = await readDatabase();
  return database.users
    .filter((user) => ids.includes(user.id) && (options?.includeInactive || user.isActive))
    .map((user) => mapStoredUser(user));
}

export async function getTicketDetailReferences(input: {
  ticket: Ticket;
  userIds?: string[];
  includeAssignees?: boolean;
}): Promise<{ users: User[]; categories: Category[]; stores: Store[] }> {
  const userIds = [...new Set([input.ticket.reporterId, input.ticket.assigneeId, ...(input.userIds ?? [])].filter(Boolean) as string[])];
  const includeAssignees = input.includeAssignees ?? false;

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const [users, categories, stores] = await Promise.all([
      db.user.findMany({
        where: {
          OR: [
            { id: { in: userIds } },
            ...(includeAssignees ? [{ isActive: true, role: "AGENT" as const }, { isActive: true, role: "ADMIN" as const }] : [])
          ]
        },
        orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }, { email: "asc" }]
      }),
      input.ticket.categoryId ? db.category.findMany({ where: { id: input.ticket.categoryId } }) : Promise.resolve([]),
      input.ticket.storeId ? db.store.findMany({ where: { id: input.ticket.storeId } }) : Promise.resolve([])
    ]);
    return {
      users: users.map((user) => mapUser(user)),
      categories: categories.map(mapCategory),
      stores: stores.map(mapStore)
    };
  }

  const database = await readDatabase();
  const userIdSet = new Set(userIds);
  return {
    users: database.users.filter(
      (user) => userIdSet.has(user.id) || (includeAssignees && user.isActive && (user.role === "AGENT" || user.role === "ADMIN"))
    ).map((user) => mapStoredUser(user)),
    categories: input.ticket.categoryId
      ? database.categories.filter((category) => category.id === input.ticket.categoryId)
      : [],
    stores: input.ticket.storeId ? database.stores.filter((store) => store.id === input.ticket.storeId) : []
  };
}

export async function updateUserAdmin(input: {
  userId: string;
  role: UserRole;
  storeId?: string;
  department?: string;
  isActive: boolean;
  isScheduleMember: boolean;
  scheduleOrder?: number;
  actorId: string;
}): Promise<User | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const existing = await db.user.findUnique({ where: { id: input.userId } });

    if (!existing) {
      return undefined;
    }

    if (existing.role === "ADMIN" && (!input.isActive || input.role !== "ADMIN")) {
      await ensureActiveAdminRemains(existing.id, input.role, input.isActive);
    }

    const scheduleEligible = input.isActive && (input.role === "AGENT" || input.role === "ADMIN");
    const isScheduleMember = scheduleEligible && input.isScheduleMember;
    const scheduleOrder = isScheduleMember ? input.scheduleOrder : undefined;

    const updated = await db.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: input.userId },
        data: {
          role: input.role,
          storeId: input.storeId,
          department: input.department,
          isActive: input.isActive,
          isScheduleMember,
          scheduleOrder: scheduleOrder ?? null
        }
      });

      const changes = getUserAuditChanges(mapUser(existing), {
        role: nextUser.role,
        storeId: definedString(nextUser.storeId),
        department: definedString(nextUser.department),
        isActive: nextUser.isActive,
        isScheduleMember: nextUser.isScheduleMember,
        scheduleOrder: nextUser.scheduleOrder ?? undefined
      });

      if (changes.length > 0) {
        await tx.adminAuditLog.create({
          data: {
            actorId: input.actorId,
            action: "USER_UPDATED",
            entityType: "USER",
            entityId: nextUser.id,
            summary: describeAuditChanges("Użytkownik", nextUser.email, changes),
            payload: buildAuditPayload(changes)
          }
        });
      }

      return nextUser;
    });

    return mapUser(updated);
  }

  return withDatabase((database) => {
    const user = database.users.find((item) => item.id === input.userId);

    if (!user) {
      return undefined;
    }

    if (user.role === "ADMIN" && (!input.isActive || input.role !== "ADMIN")) {
      const activeAdminCount = database.users.filter((item) => item.role === "ADMIN" && item.isActive && item.id !== user.id).length;

      if (activeAdminCount === 0) {
        throw new Error("Nie można odebrać ostatniego aktywnego administratora.");
      }
    }

    const scheduleEligible = input.isActive && (input.role === "AGENT" || input.role === "ADMIN");
    const isScheduleMember = scheduleEligible && input.isScheduleMember;
    const scheduleOrder = isScheduleMember ? input.scheduleOrder : undefined;

    const changes = getUserAuditChanges(user, { ...input, isScheduleMember, scheduleOrder });
    user.role = input.role;
    user.storeId = input.storeId;
    user.department = input.department;
    user.isActive = input.isActive;
    user.isScheduleMember = isScheduleMember;
    user.scheduleOrder = scheduleOrder;

    if (changes.length > 0) {
      appendAdminAuditLog(database, {
        actorId: input.actorId,
        action: "USER_UPDATED",
        entityType: "USER",
        entityId: user.id,
        summary: describeAuditChanges("Użytkownik", user.email, changes),
        payload: buildAuditPayload(changes)
      });
    }

    return user;
  });
}

function formatUserDeleteBlockers(blockers: string[]): string {
  return `Nie można usunąć użytkownika z powiązaną historią (${blockers.join(", ")}). Dezaktywuj konto zamiast usuwać.`;
}

function getJsonUserDeleteBlockers(database: Database, userId: string): string[] {
  const blockers: string[] = [];

  if (database.tickets.some((ticket) => ticket.reporterId === userId)) blockers.push("zgłoszenia jako zgłaszający");
  if (database.comments.some((comment) => comment.authorId === userId)) blockers.push("komentarze");
  if (database.knowledgeArticles.some((article) => article.createdById === userId)) blockers.push("artykuły bazy wiedzy");
  if (database.responseTemplates.some((template) => template.createdById === userId)) blockers.push("szablony odpowiedzi");
  if (database.responseMacros.some((macro) => macro.createdById === userId)) blockers.push("makra odpowiedzi");
  if ((database.dayLogEntries ?? []).some((entry) => entry.createdById === userId)) blockers.push("wpisy DayLog");
  if ((database.scheduleTasks ?? []).some((task) => task.assigneeId === userId || task.createdById === userId || task.updatedById === userId)) blockers.push("zadania grafiku");
  if ((database.scheduleDuties ?? []).some((duty) => duty.assigneeId === userId || duty.createdById === userId)) blockers.push("dyżury grafiku");

  return blockers;
}

export async function deleteUserAdmin(input: { userId: string; actorId: string }): Promise<boolean> {
  if (input.userId === input.actorId) {
    throw new Error("Nie możesz usunąć własnego konta.");
  }

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const existing = await db.user.findUnique({ where: { id: input.userId } });

    if (!existing) {
      return false;
    }

    if (existing.role === "ADMIN" && existing.isActive) {
      await ensureActiveAdminRemains(existing.id, "REPORTER", false);
    }

    const [reportedTickets, comments, articlesCreated, responseTemplates, responseMacros, dayLogEntries, scheduleTasks, scheduleDuties] = await Promise.all([
      db.ticket.count({ where: { reporterId: input.userId } }),
      db.ticketComment.count({ where: { authorId: input.userId } }),
      db.knowledgeArticle.count({ where: { createdById: input.userId } }),
      db.responseTemplate.count({ where: { createdById: input.userId } }),
      db.responseMacro.count({ where: { createdById: input.userId } }),
      db.dayLogEntry.count({ where: { createdById: input.userId } }),
      db.scheduleTask.count({
        where: { OR: [{ assigneeId: input.userId }, { createdById: input.userId }, { updatedById: input.userId }] }
      }),
      db.scheduleDuty.count({
        where: { OR: [{ assigneeId: input.userId }, { createdById: input.userId }] }
      })
    ]);
    const blockers = [
      reportedTickets > 0 ? "zgłoszenia jako zgłaszający" : undefined,
      comments > 0 ? "komentarze" : undefined,
      articlesCreated > 0 ? "artykuły bazy wiedzy" : undefined,
      responseTemplates > 0 ? "szablony odpowiedzi" : undefined,
      responseMacros > 0 ? "makra odpowiedzi" : undefined,
      dayLogEntries > 0 ? "wpisy DayLog" : undefined,
      scheduleTasks > 0 ? "zadania grafiku" : undefined,
      scheduleDuties > 0 ? "dyżury grafiku" : undefined
    ].filter((blocker): blocker is string => Boolean(blocker));

    if (blockers.length > 0) {
      throw new Error(formatUserDeleteBlockers(blockers));
    }

    await db.$transaction(async (tx) => {
      await tx.ticket.updateMany({
        where: { assigneeId: input.userId },
        data: { assigneeId: null }
      });
      await tx.ticketEvent.updateMany({
        where: { actorId: input.userId },
        data: { actorId: null }
      });
      await tx.category.updateMany({
        where: { defaultAssigneeId: input.userId },
        data: { defaultAssigneeId: null }
      });

      await tx.adminAuditLog.create({
        data: {
          actorId: input.actorId,
          action: "USER_DELETED",
          entityType: "USER",
          entityId: existing.id,
          summary: `Użytkownik ${existing.email}: usunięto konto`,
          payload: {
            email: existing.email,
            rola: existing.role,
            aktywny: existing.isActive ? "tak" : "nie"
          }
        }
      });

      await tx.user.delete({ where: { id: input.userId } });
    });

    return true;
  }

  return withDatabase((database) => {
    const user = database.users.find((item) => item.id === input.userId);

    if (!user) {
      return false;
    }

    if (user.role === "ADMIN" && user.isActive) {
      const activeAdminCount = database.users.filter((item) => item.role === "ADMIN" && item.isActive && item.id !== user.id).length;

      if (activeAdminCount === 0) {
        throw new Error("Nie można odebrać ostatniego aktywnego administratora.");
      }
    }

    const blockers = getJsonUserDeleteBlockers(database, input.userId);
    if (blockers.length > 0) {
      throw new Error(formatUserDeleteBlockers(blockers));
    }

    database.tickets.forEach((ticket) => {
      if (ticket.assigneeId === input.userId) {
        ticket.assigneeId = undefined;
      }
    });
    database.events.forEach((event) => {
      if (event.actorId === input.userId) {
        event.actorId = undefined;
      }
    });
    database.attachments.forEach((attachment) => {
      if (attachment.uploadedById === input.userId) {
        attachment.uploadedById = undefined;
      }
    });
    database.sessions = database.sessions.filter((session) => session.userId !== input.userId);
    database.setupTokens = database.setupTokens.filter((token) => token.email !== user.email);
    database.adminAuditLogs.forEach((log) => {
      if (log.actorId === input.userId) {
        log.actorId = undefined;
      }
    });

    appendAdminAuditLog(database, {
      actorId: input.actorId,
      action: "USER_DELETED",
      entityType: "USER",
      entityId: user.id,
      summary: `Użytkownik ${user.email}: usunięto konto`,
      payload: {
        email: user.email,
        rola: user.role,
        aktywny: user.isActive ? "tak" : "nie"
      }
    });

    database.users = database.users.filter((item) => item.id !== input.userId);
    return true;
  });
}

export async function createUser(input: {
  name: string;
  email: string;
  role: UserRole;
  storeId?: string;
  department?: string;
  isActive: boolean;
  passwordHash: string;
  mustChangePassword: boolean;
  actorId?: string;
}): Promise<User> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const existing = await db.user.findUnique({ where: { email: input.email } });

    if (existing) {
      throw new Error("Użytkownik z tym adresem e-mail już istnieje.");
    }

    const created = await db.$transaction(async (tx) => {
      const nextUser = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          role: input.role,
          storeId: input.storeId,
          department: input.department,
          isActive: input.isActive,
          passwordHash: input.passwordHash,
          mustChangePassword: input.mustChangePassword
        }
      });

      if (input.actorId) {
        await tx.adminAuditLog.create({
          data: {
            actorId: input.actorId,
            action: "USER_CREATED",
            entityType: "USER",
            entityId: nextUser.id,
            summary: `Użytkownik ${nextUser.email}: utworzono konto ${nextUser.role}`,
            payload: {
              rolaTo: nextUser.role,
              sklepTo: definedString(nextUser.storeId) ?? "-",
              dzialTo: definedString(nextUser.department) ?? "-",
              aktywnyTo: nextUser.isActive ? "tak" : "nie"
            }
          }
        });
      }

      return nextUser;
    });

    return mapUser(created);
  }

  return withDatabase((database) => {
    const existing = database.users.find((user) => user.email === input.email);

    if (existing) {
      throw new Error("Użytkownik z tym adresem e-mail już istnieje.");
    }

    const user: User = {
      id: id("usr"),
      name: input.name,
      email: input.email,
      role: input.role,
      storeId: input.storeId,
      department: input.department,
      isActive: input.isActive,
      passwordHash: input.passwordHash,
      mustChangePassword: input.mustChangePassword
    };

    database.users.push(user);

    if (input.actorId) {
      appendAdminAuditLog(database, {
        actorId: input.actorId,
        action: "USER_CREATED",
        entityType: "USER",
        entityId: user.id,
        summary: `Użytkownik ${user.email}: utworzono konto ${user.role}`,
        payload: {
          rolaTo: user.role,
          sklepTo: user.storeId ?? "-",
          dzialTo: user.department ?? "-",
          aktywnyTo: user.isActive ? "tak" : "nie"
        }
      });
    }

    return user;
  });
}

export async function createStoreAdmin(input: {
  code: string;
  name: string;
  city: string;
  address: string;
  region: string;
  isActive: boolean;
  actorId: string;
}): Promise<Store> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const duplicate = await db.store.findUnique({ where: { code: input.code } });

    if (duplicate) {
      throw new Error("Sklep o takim kodzie juz istnieje.");
    }

    const created = await db.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          code: input.code,
          name: input.name,
          city: input.city,
          address: input.address,
          region: input.region,
          isActive: input.isActive
        }
      });

      await tx.adminAuditLog.create({
        data: {
          actorId: input.actorId,
          action: "STORE_CREATED",
          entityType: "STORE",
          entityId: store.id,
          summary: `Sklep ${store.code}: utworzono ${store.name}`,
          payload: { code: store.code, name: store.name }
        }
      });

      return store;
    });

    return mapStore(created);
  }

  return withDatabase((database) => {
    if (database.stores.some((store) => store.code === input.code)) {
      throw new Error("Sklep o takim kodzie juz istnieje.");
    }

    const store: Store = {
      id: id("store"),
      code: input.code,
      name: input.name,
      city: input.city,
      address: input.address,
      region: input.region,
      isActive: input.isActive
    };

    database.stores.push(store);
    appendAdminAuditLog(database, {
      actorId: input.actorId,
      action: "STORE_CREATED",
      entityType: "STORE",
      entityId: store.id,
      summary: `Sklep ${store.code}: utworzono ${store.name}`,
      payload: { code: store.code, name: store.name }
    });
    return store;
  });
}

export async function updateStoreAdmin(input: {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string;
  region: string;
  isActive: boolean;
  actorId: string;
}): Promise<Store | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const existing = await db.store.findUnique({ where: { id: input.id } });

    if (!existing) {
      return undefined;
    }

    const duplicate = await db.store.findFirst({
      where: {
        code: input.code,
        NOT: { id: input.id }
      }
    });

    if (duplicate) {
      throw new Error("Sklep o takim kodzie juz istnieje.");
    }

    const updated = await db.$transaction(async (tx) => {
      const store = await tx.store.update({
        where: { id: input.id },
        data: {
          code: input.code,
          name: input.name,
          city: input.city,
          address: input.address,
          region: input.region,
          isActive: input.isActive
        }
      });

      const changes = getStoreAuditChanges(mapStore(existing), mapStore(store));
      if (changes.length > 0) {
        await tx.adminAuditLog.create({
          data: {
            actorId: input.actorId,
            action: "STORE_UPDATED",
            entityType: "STORE",
            entityId: store.id,
            summary: describeAuditChanges("Sklep", store.code, changes),
            payload: buildAuditPayload(changes)
          }
        });
      }

      return store;
    });

    return mapStore(updated);
  }

  return withDatabase((database) => {
    const store = database.stores.find((item) => item.id === input.id);

    if (!store) {
      return undefined;
    }

    if (database.stores.some((item) => item.code === input.code && item.id !== input.id)) {
      throw new Error("Sklep o takim kodzie juz istnieje.");
    }

    const changes = getStoreAuditChanges(store, input);
    store.code = input.code;
    store.name = input.name;
    store.city = input.city;
    store.address = input.address;
    store.region = input.region;
    store.isActive = input.isActive;

    if (changes.length > 0) {
      appendAdminAuditLog(database, {
        actorId: input.actorId,
        action: "STORE_UPDATED",
        entityType: "STORE",
        entityId: store.id,
        summary: describeAuditChanges("Sklep", store.code, changes),
        payload: buildAuditPayload(changes)
      });
    }

    return store;
  });
}

export async function deleteStoreAdmin(id: string, actorId: string): Promise<boolean> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const store = await db.store.findUnique({ where: { id } });

    if (!store) {
      return false;
    }

    const [userCount, ticketCount] = await Promise.all([
      db.user.count({ where: { storeId: id } }),
      db.ticket.count({ where: { storeId: id } })
    ]);

    if (userCount > 0 || ticketCount > 0) {
      throw new Error("Nie można usunąć sklepu, bo jest powiązany z użytkownikami lub ticketami.");
    }

    await db.$transaction(async (tx) => {
      await tx.store.delete({ where: { id } });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: "STORE_DELETED",
          entityType: "STORE",
          entityId: id,
          summary: `Sklep ${store.code}: usunięto ${store.name}`,
          payload: { code: store.code, name: store.name }
        }
      });
    });

    return true;
  }

  return withDatabase((database) => {
    const storeIndex = database.stores.findIndex((item) => item.id === id);

    if (storeIndex === -1) {
      return false;
    }

    const usage = getStoreUsageSummary(database, id);
    if (usage.userCount > 0 || usage.ticketCount > 0) {
      throw new Error("Nie można usunąć sklepu, bo jest powiązany z użytkownikami lub ticketami.");
    }

    const [store] = database.stores.splice(storeIndex, 1);
    appendAdminAuditLog(database, {
      actorId,
      action: "STORE_DELETED",
      entityType: "STORE",
      entityId: id,
      summary: `Sklep ${store.code}: usunięto ${store.name}`,
      payload: { code: store.code, name: store.name }
    });
    return true;
  });
}

export async function createCategoryAdmin(input: {
  name: string;
  defaultPriority: TicketPriority;
  isActive: boolean;
  actorId: string;
}): Promise<Category> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const duplicate = await db.category.findFirst({
      where: { name: { equals: input.name, mode: "insensitive" } }
    });

    if (duplicate) {
      throw new Error("Kategoria o takiej nazwie juz istnieje.");
    }

    const created = await db.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          name: input.name,
          defaultPriority: input.defaultPriority,
          isActive: input.isActive
        }
      });

      await tx.adminAuditLog.create({
        data: {
          actorId: input.actorId,
          action: "CATEGORY_CREATED",
          entityType: "CATEGORY",
          entityId: category.id,
          summary: `Kategoria ${category.name}: utworzono`,
          payload: { name: category.name, defaultPriority: category.defaultPriority }
        }
      });

      return category;
    });

    return mapCategory(created);
  }

  return withDatabase((database) => {
    if (database.categories.some((category) => category.name.toLowerCase() === input.name.toLowerCase())) {
      throw new Error("Kategoria o takiej nazwie juz istnieje.");
    }

    const category: Category = {
      id: id("cat"),
      name: input.name,
      defaultPriority: input.defaultPriority,
      isActive: input.isActive
    };

    database.categories.push(category);
    appendAdminAuditLog(database, {
      actorId: input.actorId,
      action: "CATEGORY_CREATED",
      entityType: "CATEGORY",
      entityId: category.id,
      summary: `Kategoria ${category.name}: utworzono`,
      payload: { name: category.name, defaultPriority: category.defaultPriority }
    });
    return category;
  });
}

export async function updateCategoryAdmin(input: {
  id: string;
  name: string;
  defaultPriority: TicketPriority;
  isActive: boolean;
  actorId: string;
}): Promise<Category | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const existing = await db.category.findUnique({ where: { id: input.id } });

    if (!existing) {
      return undefined;
    }

    const duplicate = await db.category.findFirst({
      where: {
        name: { equals: input.name, mode: "insensitive" },
        NOT: { id: input.id }
      }
    });

    if (duplicate) {
      throw new Error("Kategoria o takiej nazwie juz istnieje.");
    }

    const updated = await db.$transaction(async (tx) => {
      const category = await tx.category.update({
        where: { id: input.id },
        data: {
          name: input.name,
          defaultPriority: input.defaultPriority,
          isActive: input.isActive
        }
      });

      const changes = getCategoryAuditChanges(mapCategory(existing), mapCategory(category));
      if (changes.length > 0) {
        await tx.adminAuditLog.create({
          data: {
            actorId: input.actorId,
            action: "CATEGORY_UPDATED",
            entityType: "CATEGORY",
            entityId: category.id,
            summary: describeAuditChanges("Kategoria", category.name, changes),
            payload: buildAuditPayload(changes)
          }
        });
      }

      return category;
    });

    return mapCategory(updated);
  }

  return withDatabase((database) => {
    const category = database.categories.find((item) => item.id === input.id);

    if (!category) {
      return undefined;
    }

    if (database.categories.some((item) => item.id !== input.id && item.name.toLowerCase() === input.name.toLowerCase())) {
      throw new Error("Kategoria o takiej nazwie juz istnieje.");
    }

    const changes = getCategoryAuditChanges(category, input);
    category.name = input.name;
    category.defaultPriority = input.defaultPriority;
    category.isActive = input.isActive;

    if (changes.length > 0) {
      appendAdminAuditLog(database, {
        actorId: input.actorId,
        action: "CATEGORY_UPDATED",
        entityType: "CATEGORY",
        entityId: category.id,
        summary: describeAuditChanges("Kategoria", category.name, changes),
        payload: buildAuditPayload(changes)
      });
    }

    return category;
  });
}

export async function deleteCategoryAdmin(id: string, actorId: string): Promise<boolean> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const category = await db.category.findUnique({ where: { id } });

    if (!category) {
      return false;
    }

    const [ticketCount, articleCount] = await Promise.all([
      db.ticket.count({ where: { categoryId: id } }),
      db.knowledgeArticle.count({ where: { categoryId: id } })
    ]);

    if (ticketCount > 0 || articleCount > 0) {
      throw new Error("Nie można usunąć kategorii, bo jest powiązana z ticketami lub bazą wiedzy.");
    }

    await db.$transaction(async (tx) => {
      await tx.category.delete({ where: { id } });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: "CATEGORY_DELETED",
          entityType: "CATEGORY",
          entityId: id,
          summary: `Kategoria ${category.name}: usunięto`,
          payload: { name: category.name }
        }
      });
    });

    return true;
  }

  return withDatabase((database) => {
    const categoryIndex = database.categories.findIndex((item) => item.id === id);

    if (categoryIndex === -1) {
      return false;
    }

    const usage = getCategoryUsageSummary(database, id);
    if (usage.ticketCount > 0 || usage.articleCount > 0) {
      throw new Error("Nie można usunąć kategorii, bo jest powiązana z ticketami lub bazą wiedzy.");
    }

    const [category] = database.categories.splice(categoryIndex, 1);
    appendAdminAuditLog(database, {
      actorId,
      action: "CATEGORY_DELETED",
      entityType: "CATEGORY",
      entityId: id,
      summary: `Kategoria ${category.name}: usunięto`,
      payload: { name: category.name }
    });
    return true;
  });
}

export async function listVisibleTickets(user: User, filters: TicketListFilters = {}): Promise<Ticket[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const { where } = buildVisibleTicketQuery(user, filters);
    const tickets = await db.ticket.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }]
    });
    return tickets.map(mapTicket);
  }

  const database = await readDatabase();
  return filterVisibleTickets(database.tickets, user, filters);
}

const DEFAULT_TICKET_PAGE_SIZE = 30;
const MAX_TICKET_PAGE_SIZE = 100;

export type TicketListPage = {
  tickets: Ticket[];
  hasMore: boolean;
  nextCursor?: string;
};

export type TicketListPageData = TicketListPage & {
  users: User[];
  stores: Store[];
  categories: Category[];
  openTickets: number;
  criticalTickets: number;
};

function buildVisibleTicketQuery(user: User, filters: TicketListFilters, cursor?: string): { where: Prisma.TicketWhereInput } {
  const visibilityWhere: Prisma.TicketWhereInput =
    user.role === "AGENT" || user.role === "ADMIN"
      ? {}
      : {
          OR: [
            { reporterId: user.id },
            ...(user.role === "STORE_MANAGER" && user.storeId ? [{ storeId: user.storeId }] : [])
          ]
        };

  const query = filters.query?.trim();
  const now = new Date();
  const filterWhere: Prisma.TicketWhereInput[] = [visibilityWhere];

  if (query) {
    filterWhere.push({
      OR: [
        { number: { contains: query, mode: "insensitive" } },
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } }
      ]
    });
  }

  if (filters.status) filterWhere.push({ status: filters.status });
  if (filters.priority) filterWhere.push({ priority: filters.priority });
  if (filters.assigneeId) filterWhere.push({ assigneeId: filters.assigneeId });
  if (filters.storeId) filterWhere.push({ storeId: filters.storeId });
  if (filters.categoryId) filterWhere.push({ categoryId: filters.categoryId });
  if (filters.mine) filterWhere.push({ assigneeId: user.id });
  if (filters.unassigned) filterWhere.push({ assigneeId: null });
  filterWhere.push(filters.archived ? { status: { in: [...archivedStatuses] } } : { status: { notIn: [...archivedStatuses] } });

  if (filters.overdue) {
    filterWhere.push({
      status: { notIn: [...closedStatuses] },
      OR: [
        { dueAt: { lt: now } },
        {
          dueAt: null,
          OR: [
            { priority: "CRITICAL", createdAt: { lt: new Date(now.getTime() - 4 * 60 * 60 * 1000) } },
            { priority: "HIGH", createdAt: { lt: new Date(now.getTime() - 8 * 60 * 60 * 1000) } },
            { priority: "NORMAL", createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
            { priority: "LOW", createdAt: { lt: new Date(now.getTime() - 48 * 60 * 60 * 1000) } }
          ]
        }
      ]
    });
  }

  const decodedCursor = decodeTicketCursor(cursor);
  if (decodedCursor) {
    filterWhere.push({
      OR: [
        { updatedAt: { lt: decodedCursor.updatedAt } },
        { updatedAt: decodedCursor.updatedAt, id: { lt: decodedCursor.id } }
      ]
    });
  }

  return { where: { AND: filterWhere } };
}

function filterVisibleTickets(tickets: Ticket[], user: User, filters: TicketListFilters): Ticket[] {
  return tickets
    .filter((ticket) => {
      if (user.role === "AGENT" || user.role === "ADMIN") {
        return matchesTicketFilters(ticket, filters, user.id);
      }

      const visibleToUser = ticket.reporterId === user.id || (user.role === "STORE_MANAGER" && Boolean(user.storeId) && user.storeId === ticket.storeId);
      return visibleToUser && matchesTicketFilters(ticket, filters, user.id);
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
}

function encodeTicketCursor(ticket: Pick<Ticket, "updatedAt" | "id">): string {
  return Buffer.from(JSON.stringify({ updatedAt: ticket.updatedAt, id: ticket.id }), "utf8").toString("base64url");
}

function decodeTicketCursor(value: string | undefined): { updatedAt: Date; id: string } | undefined {
  if (!value) return undefined;

  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { updatedAt?: string; id?: string };
    if (!decoded.updatedAt || !decoded.id) return undefined;
    const updatedAt = new Date(decoded.updatedAt);
    return Number.isNaN(updatedAt.getTime()) ? undefined : { updatedAt, id: decoded.id };
  } catch {
    return undefined;
  }
}

export async function listVisibleTicketsPage(
  user: User,
  filters: TicketListFilters = {},
  options?: { cursor?: string; limit?: number }
): Promise<TicketListPage> {
  const limit = Math.min(Math.max(options?.limit ?? DEFAULT_TICKET_PAGE_SIZE, 1), MAX_TICKET_PAGE_SIZE);

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const { where } = buildVisibleTicketQuery(user, filters, options?.cursor);
    const rows = await db.ticket.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1
    });
    const hasMore = rows.length > limit;
    const tickets = rows.slice(0, limit).map(mapTicket);
    return {
      tickets,
      hasMore,
      ...(hasMore && tickets.length > 0 ? { nextCursor: encodeTicketCursor(tickets[tickets.length - 1]) } : {})
    };
  }

  const database = await readDatabase();
  const allTickets = filterVisibleTickets(database.tickets, user, filters);
  const decodedCursor = decodeTicketCursor(options?.cursor);
  const startIndex = decodedCursor
    ? allTickets.findIndex((ticket) => ticket.id === decodedCursor.id && ticket.updatedAt === decodedCursor.updatedAt.toISOString()) + 1
    : 0;
  const safeStart = startIndex > 0 ? startIndex : 0;
  const tickets = allTickets.slice(safeStart, safeStart + limit);
  const hasMore = safeStart + limit < allTickets.length;
  return {
    tickets,
    hasMore,
    ...(hasMore && tickets.length > 0 ? { nextCursor: encodeTicketCursor(tickets[tickets.length - 1]) } : {})
  };
}

export async function getTicketListPageData(
  user: User,
  filters: TicketListFilters = {},
  options?: { cursor?: string; limit?: number; includeFilterOptions?: boolean; includeQueueSummary?: boolean }
): Promise<TicketListPageData> {
  const includeFilterOptions = options?.includeFilterOptions ?? false;
  const includeQueueSummary = options?.includeQueueSummary ?? false;

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const { where } = buildVisibleTicketQuery(user, filters, options?.cursor);
    const limit = Math.min(Math.max(options?.limit ?? DEFAULT_TICKET_PAGE_SIZE, 1), MAX_TICKET_PAGE_SIZE);
    const [rows, openTickets, criticalTickets] = await Promise.all([
      db.ticket.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: limit + 1 }),
      includeQueueSummary
        ? db.ticket.count({ where: { status: { notIn: [...closedStatuses] } } })
        : Promise.resolve(0),
      includeQueueSummary ? db.ticket.count({ where: { priority: "CRITICAL" } }) : Promise.resolve(0)
    ]);
    const hasMore = rows.length > limit;
    const tickets = rows.slice(0, limit).map(mapTicket);
    const userIds = [...new Set(tickets.flatMap((ticket) => [ticket.reporterId, ticket.assigneeId].filter(Boolean) as string[]))];
    const storeIds = [...new Set(tickets.map((ticket) => ticket.storeId).filter(Boolean) as string[])];
    const categoryIds = [...new Set(tickets.map((ticket) => ticket.categoryId).filter(Boolean))];
    const [users, stores, categories] = await Promise.all([
      db.user.findMany({
        where: includeFilterOptions ? { OR: [{ isActive: true }, { id: { in: userIds } }] } : { id: { in: userIds } },
        orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }, { email: "asc" }]
      }),
      db.store.findMany({
        where: includeFilterOptions ? { OR: [{ isActive: true }, { id: { in: storeIds } }] } : { id: { in: storeIds } },
        orderBy: [{ isActive: "desc" }, { code: "asc" }]
      }),
      db.category.findMany({
        where: includeFilterOptions ? { OR: [{ isActive: true }, { id: { in: categoryIds } }] } : { id: { in: categoryIds } },
        orderBy: [{ isActive: "desc" }, { name: "asc" }]
      })
    ]);
    return {
      tickets,
      hasMore,
      ...(hasMore && tickets.length > 0 ? { nextCursor: encodeTicketCursor(tickets[tickets.length - 1]) } : {}),
      users: users.map((user) => mapUser(user)),
      stores: stores.map(mapStore),
      categories: categories.map(mapCategory),
      openTickets,
      criticalTickets
    };
  }

  const database = await readDatabase();
  const allTickets = filterVisibleTickets(database.tickets, user, filters);
  const decodedCursor = decodeTicketCursor(options?.cursor);
  const startIndex = decodedCursor
    ? allTickets.findIndex((ticket) => ticket.id === decodedCursor.id && ticket.updatedAt === decodedCursor.updatedAt.toISOString()) + 1
    : 0;
  const safeStart = startIndex > 0 ? startIndex : 0;
  const limit = Math.min(Math.max(options?.limit ?? DEFAULT_TICKET_PAGE_SIZE, 1), MAX_TICKET_PAGE_SIZE);
  const tickets = allTickets.slice(safeStart, safeStart + limit);
  const hasMore = safeStart + limit < allTickets.length;
  const ticketUserIds = new Set(tickets.flatMap((ticket) => [ticket.reporterId, ticket.assigneeId].filter(Boolean) as string[]));
  const ticketStoreIds = new Set(tickets.map((ticket) => ticket.storeId).filter(Boolean));
  const ticketCategoryIds = new Set(tickets.map((ticket) => ticket.categoryId).filter(Boolean));
  return {
    tickets,
    hasMore,
    ...(hasMore && tickets.length > 0 ? { nextCursor: encodeTicketCursor(tickets[tickets.length - 1]) } : {}),
    users: database.users
      .filter((item) => includeFilterOptions || ticketUserIds.has(item.id))
      .map((item) => mapStoredUser(item)),
    stores: database.stores.filter((item) => includeFilterOptions || ticketStoreIds.has(item.id)),
    categories: database.categories.filter((item) => includeFilterOptions || ticketCategoryIds.has(item.id)),
    openTickets: includeQueueSummary ? database.tickets.filter((ticket) => !closedStatuses.has(ticket.status)).length : 0,
    criticalTickets: includeQueueSummary ? database.tickets.filter((ticket) => ticket.priority === "CRITICAL").length : 0
  };
}

export async function findTicket(ticketId: string): Promise<Ticket | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const ticket = await db.ticket.findFirst({
      where: { OR: [{ id: ticketId }, { number: ticketId }] }
    });
    return ticket ? mapTicket(ticket) : undefined;
  }

  const database = await readDatabase();
  return database.tickets.find((ticket) => ticket.id === ticketId || ticket.number === ticketId);
}

export async function listComments(ticketId: string, includeInternal: boolean): Promise<TicketComment[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const comments = await db.ticketComment.findMany({
      where: {
        ticketId,
        ...(includeInternal ? {} : { visibility: "PUBLIC" })
      },
      orderBy: { createdAt: "asc" }
    });
    return comments.map(mapComment);
  }

  const database = await readDatabase();
  return database.comments
    .filter((comment) => comment.ticketId === ticketId)
    .filter((comment) => includeInternal || comment.visibility === "PUBLIC")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function listEvents(ticketId: string): Promise<TicketEvent[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const events = await db.ticketEvent.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" }
    });
    return events.map(mapEvent);
  }

  const database = await readDatabase();
  return database.events
    .filter((event) => event.ticketId === ticketId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createTicketWithResult(input: {
  title: string;
  description: string;
  blocksWork: boolean;
  contact: string;
  categoryId: string;
  storeId?: string;
  department?: string;
  reporterId: string;
  priority: TicketPriority;
  submissionId?: string;
  dayLogEntryId?: string;
}): Promise<{ ticket: Ticket; created: boolean }> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const year = new Date().getFullYear();

    if (input.submissionId) {
      const existing = await db.ticket.findFirst({
        where: { reporterId: input.reporterId, submissionId: input.submissionId }
      });
      if (existing) {
        return { ticket: mapTicket(existing), created: false };
      }
    }

    if (input.dayLogEntryId) {
      const sourceEntry = await db.dayLogEntry.findUnique({
        where: { id: input.dayLogEntryId },
        include: { ticket: true }
      });
      if (!sourceEntry) {
        throw new Error("Wpis DayLog nie istnieje.");
      }
      if (sourceEntry.ticket) {
        return { ticket: mapTicket(sourceEntry.ticket), created: false };
      }
    }

    try {
      const ticket = await db.$transaction(async (tx) => {
        await tx.ticketCounter.upsert({
          where: { year },
          create: { year, sequence: 0 },
          update: {}
        });

        const counter = await tx.ticketCounter.update({
          where: { year },
          data: { sequence: { increment: 1 } }
        });

        const created = await tx.ticket.create({
          data: {
            number: generateTicketNumber(year, counter.sequence),
            submissionId: input.submissionId,
            title: input.title,
            description: input.description,
            status: "NEW",
            priority: input.blocksWork ? "CRITICAL" : input.priority,
            blocksWork: input.blocksWork,
            contact: input.contact,
            categoryId: input.categoryId,
            storeId: input.storeId,
            department: input.department,
            reporterId: input.reporterId
          }
        });

        if (input.dayLogEntryId) {
          const linked = await tx.dayLogEntry.updateMany({
            where: { id: input.dayLogEntryId, ticketId: null },
            data: { ticketId: created.id }
          });
          if (linked.count !== 1) {
            throw new DayLogEntryLinkError("Wpis DayLog został już powiązany ze zgłoszeniem.");
          }
        }

        await tx.ticketEvent.create({
          data: {
            ticketId: created.id,
            actorId: input.reporterId,
            type: "TICKET_CREATED",
            payload: input.dayLogEntryId ? { dayLogEntryId: input.dayLogEntryId } : undefined
          }
        });

        const reporter = await tx.user.findUnique({
          where: { id: input.reporterId },
          select: { email: true }
        });

        if (reporter?.email) {
          await tx.notificationLog.create({
            data: {
              ticketId: created.id,
              recipientEmail: reporter.email,
              type: "TICKET_CREATED",
              status: "QUEUED"
            }
          });
        }

        return created;
      });

      return { ticket: mapTicket(ticket), created: true };
    } catch (error) {
      if (error instanceof DayLogEntryLinkError && input.dayLogEntryId) {
        const sourceEntry = await db.dayLogEntry.findUnique({
          where: { id: input.dayLogEntryId },
          include: { ticket: true }
        });
        if (sourceEntry?.ticket) {
          return { ticket: mapTicket(sourceEntry.ticket), created: false };
        }
        if (!sourceEntry) {
          throw new Error("Wpis DayLog nie istnieje.");
        }
      }

      if (!input.submissionId || !isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await db.ticket.findFirst({
        where: { reporterId: input.reporterId, submissionId: input.submissionId }
      });
      if (!existing) {
        throw error;
      }

      return { ticket: mapTicket(existing), created: false };
    }
  }

  return withDatabase((database) => {
    const existing = input.submissionId
      ? database.tickets.find((ticket) => ticket.reporterId === input.reporterId && ticket.submissionId === input.submissionId)
      : undefined;
    if (existing) {
      return { ticket: existing, created: false };
    }

    const sourceEntry = input.dayLogEntryId
      ? database.dayLogEntries?.find((entry) => entry.id === input.dayLogEntryId)
      : undefined;
    if (input.dayLogEntryId && !sourceEntry) {
      throw new Error("Wpis DayLog nie istnieje.");
    }
    if (sourceEntry?.ticketId) {
      const linkedTicket = database.tickets.find((ticket) => ticket.id === sourceEntry.ticketId);
      if (!linkedTicket) {
        throw new Error("Powiązane zgłoszenie nie istnieje.");
      }
      return { ticket: linkedTicket, created: false };
    }

    const year = String(new Date().getFullYear());
    const nextSequence = (database.meta.ticketSequences[year] ?? 0) + 1;
    database.meta.ticketSequences[year] = nextSequence;

    const timestamp = now();
    const ticket: Ticket = {
      id: id("t"),
      number: generateTicketNumber(Number(year), nextSequence),
      submissionId: input.submissionId,
      title: input.title,
      description: input.description,
      status: "NEW",
      priority: input.blocksWork ? "CRITICAL" : input.priority,
      blocksWork: input.blocksWork,
      contact: input.contact,
      categoryId: input.categoryId,
      storeId: input.storeId,
      department: input.department,
      reporterId: input.reporterId,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    database.tickets.push(ticket);
    if (sourceEntry) {
      sourceEntry.ticketId = ticket.id;
      sourceEntry.updatedAt = timestamp;
    }
    database.events.push({
      id: id("e"),
      ticketId: ticket.id,
      actorId: input.reporterId,
      type: "TICKET_CREATED",
      payload: input.dayLogEntryId ? { dayLogEntryId: input.dayLogEntryId } : undefined,
      createdAt: timestamp
    });
    database.notificationLogs.push({
      id: id("n"),
      ticketId: ticket.id,
      recipientEmail: database.users.find((user) => user.id === input.reporterId)?.email ?? "",
      type: "TICKET_CREATED",
      status: "QUEUED",
      createdAt: timestamp
    });

    return { ticket, created: true };
  });
}

export async function createTicket(input: Parameters<typeof createTicketWithResult>[0]): Promise<Ticket> {
  return (await createTicketWithResult(input)).ticket;
}

export async function updateTicket(input: {
  ticketId: string;
  actorId: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId?: string;
}): Promise<Ticket | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const updated = await db.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id: input.ticketId } });

      if (!ticket) {
        return undefined;
      }

      const statusChanged = ticket.status !== input.status;
      const priorityChanged = ticket.priority !== input.priority;
      const assigneeChanged = (ticket.assigneeId ?? "") !== (input.assigneeId ?? "");
      const timestamp = new Date();
      const events: Prisma.TicketEventCreateManyInput[] = [];

      if (statusChanged) {
        events.push({
          ticketId: ticket.id,
          actorId: input.actorId,
          type: "STATUS_CHANGED",
          payload: { from: ticket.status, to: input.status }
        });
      }

      if (priorityChanged) {
        events.push({
          ticketId: ticket.id,
          actorId: input.actorId,
          type: "PRIORITY_CHANGED",
          payload: { from: ticket.priority, to: input.priority }
        });
      }

      if (assigneeChanged) {
        events.push({
          ticketId: ticket.id,
          actorId: input.actorId,
          type: "ASSIGNEE_CHANGED",
          payload: { assigneeId: input.assigneeId ?? "" }
        });
      }

      const nextTicket = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: input.status,
          priority: input.priority,
          assigneeId: input.assigneeId,
          resolvedAt:
            statusChanged && input.status === "RESOLVED"
              ? timestamp
              : statusChanged && ticket.status === "RESOLVED"
                ? null
                : undefined,
          closedAt:
            statusChanged && input.status === "CLOSED"
              ? timestamp
              : statusChanged && ticket.status === "CLOSED"
                ? null
                : undefined
        }
      });

      if (events.length > 0) {
        await tx.ticketEvent.createMany({ data: events });
      }

      if (statusChanged && input.status === "RESOLVED") {
        const reporter = await tx.user.findUnique({
          where: { id: ticket.reporterId },
          select: { email: true }
        });

        if (reporter?.email) {
          await tx.notificationLog.create({
            data: {
              ticketId: ticket.id,
              recipientEmail: reporter.email,
              type: "TICKET_RESOLVED",
              status: "QUEUED"
            }
          });
        }
      }

      if (assigneeChanged && input.assigneeId) {
        const assignee = await tx.user.findUnique({
          where: { id: input.assigneeId },
          select: { email: true }
        });

        if (assignee?.email) {
          await tx.notificationLog.create({
            data: {
              ticketId: ticket.id,
              recipientEmail: assignee.email,
              type: "TICKET_ASSIGNED",
              status: "QUEUED"
            }
          });
        }
      }

      return nextTicket;
    });

    return updated ? mapTicket(updated) : undefined;
  }

  return withDatabase((database) => {
    const ticket = database.tickets.find((item) => item.id === input.ticketId);

    if (!ticket) {
      return undefined;
    }

    const timestamp = now();
    const events: TicketEvent[] = [];
    const previousStatus = ticket.status;
    const statusChanged = ticket.status !== input.status;
    const priorityChanged = ticket.priority !== input.priority;
    const assigneeChanged = (ticket.assigneeId ?? "") !== (input.assigneeId ?? "");

    if (statusChanged) {
      events.push({
        id: id("e"),
        ticketId: ticket.id,
        actorId: input.actorId,
        type: "STATUS_CHANGED",
        payload: { from: ticket.status, to: input.status },
        createdAt: timestamp
      });
      ticket.status = input.status;
      ticket.resolvedAt = input.status === "RESOLVED" ? timestamp : previousStatus === "RESOLVED" ? null : ticket.resolvedAt;
      ticket.closedAt = input.status === "CLOSED" ? timestamp : previousStatus === "CLOSED" ? null : ticket.closedAt;
    }

    if (priorityChanged) {
      events.push({
        id: id("e"),
        ticketId: ticket.id,
        actorId: input.actorId,
        type: "PRIORITY_CHANGED",
        payload: { from: ticket.priority, to: input.priority },
        createdAt: timestamp
      });
      ticket.priority = input.priority;
    }

    if (assigneeChanged) {
      events.push({
        id: id("e"),
        ticketId: ticket.id,
        actorId: input.actorId,
        type: "ASSIGNEE_CHANGED",
        payload: { assigneeId: input.assigneeId ?? "" },
        createdAt: timestamp
      });
      ticket.assigneeId = input.assigneeId;
    }

    if (events.length > 0) {
      ticket.updatedAt = timestamp;
      database.events.push(...events);
    }

    if (statusChanged && input.status === "RESOLVED") {
      const recipientEmail = database.users.find((user) => user.id === ticket.reporterId)?.email;
      if (recipientEmail) {
        database.notificationLogs.push({
          id: id("n"),
          ticketId: ticket.id,
          recipientEmail,
          type: "TICKET_RESOLVED",
          status: "QUEUED",
          createdAt: timestamp
        });
      }
    }

    if (assigneeChanged && input.assigneeId) {
      const recipientEmail = database.users.find((user) => user.id === input.assigneeId)?.email;
      if (recipientEmail) {
        database.notificationLogs.push({
          id: id("n"),
          ticketId: ticket.id,
          recipientEmail,
          type: "TICKET_ASSIGNED",
          status: "QUEUED",
          createdAt: timestamp
        });
      }
    }

    return ticket;
  });
}

export async function addComment(input: {
  ticketId: string;
  authorId: string;
  body: string;
  visibility: CommentVisibility;
}): Promise<TicketComment | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const comment = await db.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id: input.ticketId } });

      if (!ticket) {
        return undefined;
      }

      const created = await tx.ticketComment.create({
        data: {
          ticketId: ticket.id,
          authorId: input.authorId,
          body: input.body,
          visibility: input.visibility
        }
      });

      await tx.ticket.update({
        where: { id: ticket.id },
        data: { updatedAt: new Date() }
      });

      await tx.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: input.authorId,
          type: input.visibility === "INTERNAL" ? "INTERNAL_NOTE_CREATED" : "COMMENT_CREATED"
        }
      });

      if (input.visibility === "PUBLIC") {
        const recipient = ticket.reporterId === input.authorId ? ticket.assigneeId : ticket.reporterId;

        if (recipient) {
          const user = await tx.user.findUnique({
            where: { id: recipient },
            select: { email: true }
          });

          if (user?.email) {
            await tx.notificationLog.create({
              data: {
                ticketId: ticket.id,
                recipientEmail: user.email,
                type: "COMMENT_CREATED",
                status: "QUEUED"
              }
            });
          }
        }
      }

      return created;
    });

    return comment ? mapComment(comment) : undefined;
  }

  return withDatabase((database) => {
    const ticket = database.tickets.find((item) => item.id === input.ticketId);

    if (!ticket) {
      return undefined;
    }

    const timestamp = now();
    const comment: TicketComment = {
      id: id("c"),
      ticketId: ticket.id,
      authorId: input.authorId,
      body: input.body,
      visibility: input.visibility,
      createdAt: timestamp
    };

    ticket.updatedAt = timestamp;
    database.comments.push(comment);
    database.events.push({
      id: id("e"),
      ticketId: ticket.id,
      actorId: input.authorId,
      type: input.visibility === "INTERNAL" ? "INTERNAL_NOTE_CREATED" : "COMMENT_CREATED",
      createdAt: timestamp
    });

    if (input.visibility === "PUBLIC") {
      const recipient = ticket.reporterId === input.authorId ? ticket.assigneeId : ticket.reporterId;
      const recipientEmail = database.users.find((user) => user.id === recipient)?.email;

      if (recipientEmail) {
        const notification: NotificationLog = {
          id: id("n"),
          ticketId: ticket.id,
          recipientEmail,
          type: "COMMENT_CREATED",
          status: "QUEUED",
          createdAt: timestamp
        };
        database.notificationLogs.push(notification);
      }
    }

    return comment;
  });
}

export async function updateNotificationLog(
  notificationId: string,
  status: "SENT" | "FAILED",
  error?: string
): Promise<void> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    await db.notificationLog.update({
      where: { id: notificationId },
      data: {
        status,
        ...(status === "SENT" ? { sentAt: new Date() } : { sentAt: null }),
        error: status === "FAILED" ? error : null
      }
    });
    return;
  }

  return withDatabase((database) => {
    const notification = database.notificationLogs.find((item) => item.id === notificationId);
    if (notification) {
      notification.status = status;
      if (status === "SENT") {
        notification.sentAt = new Date().toISOString();
      }
      notification.error = status === "FAILED" ? error : undefined;
    }
  });
}

export async function findLatestQueuedNotification(input: {
  ticketId: string;
  type: string;
  recipientEmail: string;
}): Promise<NotificationLog | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const notification = await db.notificationLog.findFirst({
      where: {
        ticketId: input.ticketId,
        type: input.type,
        recipientEmail: input.recipientEmail,
        status: "QUEUED"
      },
      orderBy: { createdAt: "desc" }
    });
    return notification ? mapNotificationLog(notification) : undefined;
  }

  const database = await readDatabase();
  return database.notificationLogs
    .filter((log) => log.ticketId === input.ticketId)
    .filter((log) => log.type === input.type)
    .filter((log) => log.recipientEmail === input.recipientEmail)
    .filter((log) => log.status === "QUEUED")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export async function findKnowledgeArticleBySlug(slug: string): Promise<KnowledgeArticle | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const article = await db.knowledgeArticle.findUnique({ where: { slug } });
    return article ? mapKnowledgeArticle(article) : undefined;
  }

  const database = await readDatabase();
  return database.knowledgeArticles.find((a) => a.slug === slug);
}

export async function findKnowledgeArticleById(id: string): Promise<KnowledgeArticle | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const article = await db.knowledgeArticle.findUnique({ where: { id } });
    return article ? mapKnowledgeArticle(article) : undefined;
  }

  const database = await readDatabase();
  return database.knowledgeArticles.find((a) => a.id === id);
}

export async function createKnowledgeArticle(input: {
  title: string;
  slug: string;
  body: string;
  categoryId?: string;
  isPublished: boolean;
  createdById: string;
  actorId?: string;
}): Promise<KnowledgeArticle> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const article = await db.$transaction(async (tx) => {
      const created = await tx.knowledgeArticle.create({
        data: {
          title: input.title,
          slug: input.slug,
          body: input.body,
          categoryId: input.categoryId,
          isPublished: input.isPublished,
          createdById: input.createdById
        }
      });

      if (input.actorId) {
        await tx.adminAuditLog.create({
          data: {
            actorId: input.actorId,
            action: "KNOWLEDGE_ARTICLE_CREATED",
            entityType: "KNOWLEDGE_ARTICLE",
            entityId: created.id,
            summary: `Artykuł ${created.title}: utworzono${created.isPublished ? " (opublikowany)" : " (szkic)"}`,
            payload: {
              tytulTo: created.title,
              slugTo: created.slug,
              opublikowanyTo: created.isPublished ? "tak" : "nie"
            }
          }
        });
      }

      return created;
    });

    return mapKnowledgeArticle(article);
  }

  return withDatabase((database) => {
    const article: KnowledgeArticle = {
      id: id("ka"),
      title: input.title,
      slug: input.slug,
      body: input.body,
      categoryId: input.categoryId,
      isPublished: input.isPublished
    };
    database.knowledgeArticles.push(article);

    if (input.actorId) {
      appendAdminAuditLog(database, {
        actorId: input.actorId,
        action: "KNOWLEDGE_ARTICLE_CREATED",
        entityType: "KNOWLEDGE_ARTICLE",
        entityId: article.id,
        summary: `Artykuł ${article.title}: utworzono${article.isPublished ? " (opublikowany)" : " (szkic)"}`,
        payload: {
          tytulTo: article.title,
          slugTo: article.slug,
          opublikowanyTo: article.isPublished ? "tak" : "nie"
        }
      });
    }

    return article;
  });
}

export async function updateKnowledgeArticle(input: {
  id: string;
  title: string;
  slug: string;
  body: string;
  categoryId?: string;
  isPublished: boolean;
  updatedById: string;
  actorId?: string;
}): Promise<KnowledgeArticle | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const article = await db.$transaction(async (tx) => {
      const existing = await tx.knowledgeArticle.findUnique({ where: { id: input.id } });

      if (!existing) {
        return undefined;
      }

      const updated = await tx.knowledgeArticle.update({
        where: { id: input.id },
        data: {
          title: input.title,
          slug: input.slug,
          body: input.body,
          categoryId: input.categoryId,
          isPublished: input.isPublished,
          updatedById: input.updatedById
        }
      });

      if (input.actorId) {
        const changes = getKnowledgeArticleAuditChanges(mapKnowledgeArticle(existing), mapKnowledgeArticle(updated));
        if (changes.length > 0) {
          await tx.adminAuditLog.create({
            data: {
              actorId: input.actorId,
              action: "KNOWLEDGE_ARTICLE_UPDATED",
              entityType: "KNOWLEDGE_ARTICLE",
              entityId: updated.id,
              summary: describeAuditChanges("Artykuł", updated.title, changes),
              payload: buildAuditPayload(changes)
            }
          });
        }
      }

      return updated;
    });

    return article ? mapKnowledgeArticle(article) : undefined;
  }

  return withDatabase((database) => {
    const article = database.knowledgeArticles.find((a) => a.id === input.id);
    if (!article) return undefined;

    const before: KnowledgeArticle = { ...article };

    article.title = input.title;
    article.slug = input.slug;
    article.body = input.body;
    article.categoryId = input.categoryId;
    article.isPublished = input.isPublished;

    if (input.actorId) {
      const changes = getKnowledgeArticleAuditChanges(before, article);
      if (changes.length > 0) {
        appendAdminAuditLog(database, {
          actorId: input.actorId,
          action: "KNOWLEDGE_ARTICLE_UPDATED",
          entityType: "KNOWLEDGE_ARTICLE",
          entityId: article.id,
          summary: describeAuditChanges("Artykuł", article.title, changes),
          payload: buildAuditPayload(changes)
        });
      }
    }

    return article;
  });
}

export async function deleteKnowledgeArticle(id: string, actorId?: string): Promise<boolean> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const article = await db.knowledgeArticle.findUnique({ where: { id } });

    if (!article) {
      return false;
    }

    await db.$transaction(async (tx) => {
      await tx.knowledgeArticle.delete({ where: { id } });

      if (actorId) {
        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: "KNOWLEDGE_ARTICLE_DELETED",
            entityType: "KNOWLEDGE_ARTICLE",
            entityId: id,
            summary: `Artykuł ${article.title}: usunięto${article.isPublished ? " (opublikowany)" : " (szkic)"}`,
            payload: {
              tytul: article.title,
              slug: article.slug,
              opublikowany: article.isPublished ? "tak" : "nie"
            }
          }
        });
      }
    });

    return true;
  }

  return withDatabase((database) => {
    const idx = database.knowledgeArticles.findIndex((a) => a.id === id);
    if (idx === -1) return false;

    const [article] = database.knowledgeArticles.splice(idx, 1);

    if (actorId) {
      appendAdminAuditLog(database, {
        actorId,
        action: "KNOWLEDGE_ARTICLE_DELETED",
        entityType: "KNOWLEDGE_ARTICLE",
        entityId: id,
        summary: `Artykuł ${article.title}: usunięto${article.isPublished ? " (opublikowany)" : " (szkic)"}`,
        payload: {
          tytul: article.title,
          slug: article.slug,
          opublikowany: article.isPublished ? "tak" : "nie"
        }
      });
    }

    return true;
  });
}

export async function listAttachments(ticketId: string): Promise<TicketAttachment[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const attachments = await db.ticketAttachment.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" }
    });
    return attachments.map(mapAttachment);
  }

  const database = await readDatabase();
  return database.attachments
    .filter((a) => a.ticketId === ticketId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function findAttachment(id: string): Promise<TicketAttachment | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const attachment = await db.ticketAttachment.findUnique({ where: { id } });
    return attachment ? mapAttachment(attachment) : undefined;
  }

  const database = await readDatabase();
  return database.attachments.find((a) => a.id === id);
}

export async function createAttachment(input: {
  ticketId: string;
  commentId?: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  uploadedById: string;
}): Promise<TicketAttachment> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const attachment = await db.ticketAttachment.create({
      data: {
        ticketId: input.ticketId,
        commentId: input.commentId,
        filename: input.filename,
        mimeType: input.mimeType,
        size: input.size,
        storageKey: input.storageKey,
        uploadedById: input.uploadedById
      }
    });
    return mapAttachment(attachment);
  }

  return withDatabase((database) => {
    const attachment: TicketAttachment = {
      id: id("att"),
      ticketId: input.ticketId,
      commentId: input.commentId,
      filename: input.filename,
      mimeType: input.mimeType,
      size: input.size,
      storageKey: input.storageKey,
      uploadedById: input.uploadedById,
      createdAt: now()
    };
    database.attachments.push(attachment);
    return attachment;
  });
}

// --- SLA Rules (hours) ---

export const slaRules: Record<TicketPriority, number> = {
  CRITICAL: 4,
  HIGH: 8,
  NORMAL: 24,
  LOW: 48
};

const resolvedOrClosedStatuses = new Set(["RESOLVED", "CLOSED", "CANCELLED"] as TicketStatus[]);

function hoursBetween(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
}

function isTicketOpen(status: TicketStatus): boolean {
  return !resolvedOrClosedStatuses.has(status);
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const [allTickets, categories] = await Promise.all([
      db.ticket.findMany(),
      db.category.findMany()
    ]);

    const totalTickets = allTickets.length;
    const openTickets = allTickets.filter((t) => isTicketOpen(t.status)).length;
    const criticalTickets = allTickets.filter((t) => t.priority === "CRITICAL").length;

    const resolvedTickets = allTickets.filter((t) => t.resolvedAt);
    const avgResolutionHours =
      resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum, t) => {
            const start = t.createdAt;
            const end = t.resolvedAt!;
            return sum + hoursBetween(start.toISOString(), end.toISOString());
          }, 0) / resolvedTickets.length
        : null;

    // Top categories
    const categoryCounts = new Map<string, number>();
    for (const t of allTickets) {
      if (t.categoryId) {
        categoryCounts.set(t.categoryId, (categoryCounts.get(t.categoryId) ?? 0) + 1);
      }
    }
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const topCategories = [...categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([categoryId, count]) => ({
        categoryId,
        categoryName: categoryMap.get(categoryId) ?? "Nieznana",
        count
      }));

    // SLA breaches
    const now = new Date();
    const slaBreached: DashboardMetrics["slaBreached"] = [];
    for (const t of allTickets) {
      if (!isTicketOpen(t.status)) continue;
      const slaHours = slaRules[t.priority];
      if (!slaHours) continue;
      const deadline = new Date(t.createdAt.getTime() + slaHours * 60 * 60 * 1000);
      if (now > deadline) {
        slaBreached.push({
          ticket: mapTicket(t),
          slaDeadline: deadline.toISOString(),
          hoursOverdue: Math.round(hoursBetween(deadline.toISOString(), now.toISOString()) * 10) / 10
        });
      }
    }
    slaBreached.sort((a, b) => b.hoursOverdue - a.hoursOverdue);

    const assigneeIds = [...new Set(slaBreached.map((item) => item.ticket.assigneeId).filter(Boolean) as string[])];
    const storeIds = [...new Set(slaBreached.map((item) => item.ticket.storeId).filter(Boolean) as string[])];
    const [assignees, stores] = await Promise.all([
      assigneeIds.length > 0 ? db.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true, email: true } }) : Promise.resolve([]),
      storeIds.length > 0 ? db.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, code: true } }) : Promise.resolve([])
    ]);
    const assigneeMap = new Map(assignees.map((user) => [user.id, user.name ?? user.email]));
    const storeMap = new Map(stores.map((store) => [store.id, store.code]));

    return {
      totalTickets,
      openTickets,
      criticalTickets,
      avgResolutionHours: avgResolutionHours !== null ? Math.round(avgResolutionHours * 10) / 10 : null,
      topCategories,
      slaBreached: slaBreached.map((item) => ({
        ...item,
        assigneeName: item.ticket.assigneeId ? assigneeMap.get(item.ticket.assigneeId) : undefined,
        storeCode: item.ticket.storeId ? storeMap.get(item.ticket.storeId) : undefined
      }))
    };
  }

  const database = await readDatabase();
  const allTickets = database.tickets;
  const currentTime = new Date().toISOString();

  const totalTickets = allTickets.length;
  const openTickets = allTickets.filter((t) => isTicketOpen(t.status)).length;
  const criticalTickets = allTickets.filter((t) => t.priority === "CRITICAL").length;

  const resolvedTickets = allTickets.filter((t) => t.resolvedAt);
  const avgResolutionHours =
    resolvedTickets.length > 0
      ? resolvedTickets.reduce((sum, t) => sum + hoursBetween(t.createdAt, t.resolvedAt!), 0) / resolvedTickets.length
      : null;

  // Top categories
  const categoryCounts = new Map<string, number>();
  for (const t of allTickets) {
    if (t.categoryId) {
      categoryCounts.set(t.categoryId, (categoryCounts.get(t.categoryId) ?? 0) + 1);
    }
  }
  const topCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([categoryId, count]) => ({
      categoryId,
      categoryName: database.categories.find((c) => c.id === categoryId)?.name ?? "Nieznana",
      count
    }));

  // SLA breaches
  const slaBreached: DashboardMetrics["slaBreached"] = [];
  for (const t of allTickets) {
    if (!isTicketOpen(t.status)) continue;
    const slaHours = slaRules[t.priority];
    if (!slaHours) continue;
    const createdAt = t.createdAt;
    const deadline = new Date(new Date(createdAt).getTime() + slaHours * 60 * 60 * 1000);
    if (new Date(currentTime) > deadline) {
      slaBreached.push({
        ticket: t,
        slaDeadline: deadline.toISOString(),
        hoursOverdue: Math.round(hoursBetween(deadline.toISOString(), currentTime) * 10) / 10
      });
    }
  }
  slaBreached.sort((a, b) => b.hoursOverdue - a.hoursOverdue);

  const userMap = new Map(database.users.map((user) => [user.id, user.name]));
  const storeMap = new Map(database.stores.map((store) => [store.id, store.code]));

  return {
    totalTickets,
    openTickets,
    criticalTickets,
    avgResolutionHours: avgResolutionHours !== null ? Math.round(avgResolutionHours * 10) / 10 : null,
    topCategories,
    slaBreached: slaBreached.map((item) => ({
      ...item,
      assigneeName: item.ticket.assigneeId ? userMap.get(item.ticket.assigneeId) : undefined,
      storeCode: item.ticket.storeId ? storeMap.get(item.ticket.storeId) : undefined
    }))
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  noStore();

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const [allTickets, categories, users, events] = await Promise.all([
      db.ticket.findMany(),
      db.category.findMany(),
      db.user.findMany({ where: { isActive: true } }),
      db.ticketEvent.findMany({ orderBy: { createdAt: "desc" }, take: 20 })
    ]);

    // KPI
    const openTickets = allTickets.filter((t) => !resolvedOrClosedStatuses.has(t.status)).length;
    const criticalTickets = allTickets.filter((t) => t.priority === "CRITICAL" && !resolvedOrClosedStatuses.has(t.status)).length;

    const resolvedTickets = allTickets.filter((t) => t.resolvedAt);
    const avgResolutionHours =
      resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum, t) => {
            return sum + (t.resolvedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
          }, 0) / resolvedTickets.length
        : null;

    const now = new Date();
    let slaBreachedCount = 0;
    for (const t of allTickets) {
      if (resolvedOrClosedStatuses.has(t.status)) continue;
      const slaHours = slaRules[t.priority];
      if (!slaHours) continue;
      const deadline = new Date(t.createdAt.getTime() + slaHours * 60 * 60 * 1000);
      if (now > deadline) slaBreachedCount++;
    }

    // Daily ticket counts (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dailyCounts: Record<string, { created: number; resolved: number }> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyCounts[key] = { created: 0, resolved: 0 };
    }
    for (const t of allTickets) {
      const createdKey = t.createdAt.toISOString().slice(0, 10);
      if (dailyCounts[createdKey]) dailyCounts[createdKey].created++;
      if (t.resolvedAt) {
        const resolvedKey = t.resolvedAt.toISOString().slice(0, 10);
        if (dailyCounts[resolvedKey]) dailyCounts[resolvedKey].resolved++;
      }
    }
    const dailyTicketCounts = Object.entries(dailyCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    // Top categories (open tickets)
    const categoryCounts = new Map<string, number>();
    for (const t of allTickets) {
      if (!resolvedOrClosedStatuses.has(t.status) && t.categoryId) {
        categoryCounts.set(t.categoryId, (categoryCounts.get(t.categoryId) ?? 0) + 1);
      }
    }
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const topCategories = [...categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([categoryId, count]) => ({
        categoryId,
        categoryName: categoryMap.get(categoryId) ?? "Nieznana",
        count
      }));

    // Agent workload (open tickets per agent)
    const workloadMap = new Map<string, number>();
    for (const t of allTickets) {
      if (!resolvedOrClosedStatuses.has(t.status) && t.assigneeId) {
        workloadMap.set(t.assigneeId, (workloadMap.get(t.assigneeId) ?? 0) + 1);
      }
    }
    // Add unassigned
    const unassignedCount = allTickets.filter(
      (t) => !resolvedOrClosedStatuses.has(t.status) && !t.assigneeId
    ).length;
    const userMap = new Map(users.map((u) => [u.id, u]));
    const agentWorkload = [...workloadMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([agentId, openCount]) => ({
        agentId,
        agentName: userMap.get(agentId)?.name ?? "Nieznany",
        openCount
      }));
    if (unassignedCount > 0) {
      agentWorkload.unshift({ agentId: "_unassigned", agentName: "Nieprzypisane", openCount: unassignedCount });
    }

    // Recent events
    const recentEvents = events.map((e) => ({
      ...mapEvent(e),
      actorName: userMap.get(e.actorId ?? "")?.name ?? undefined,
      ticketNumber: allTickets.find((t) => t.id === e.ticketId)?.number
    }));

    return {
      kpi: { openTickets, criticalTickets, avgResolutionHours, slaBreachedCount },
      dailyTicketCounts,
      topCategories,
      agentWorkload,
      recentEvents
    };
  }

  // JSON runtime
  const database = await readDatabase();
  const allTickets = database.tickets;
  const currentTime = new Date().toISOString();

  const openTickets = allTickets.filter((t) => !resolvedOrClosedStatuses.has(t.status)).length;
  const criticalTickets = allTickets.filter((t) => t.priority === "CRITICAL" && !resolvedOrClosedStatuses.has(t.status)).length;

  const resolvedTickets = allTickets.filter((t) => t.resolvedAt);
  const avgResolutionHours =
    resolvedTickets.length > 0
      ? resolvedTickets.reduce((sum, t) => sum + hoursBetween(t.createdAt, t.resolvedAt!), 0) / resolvedTickets.length
      : null;

  let slaBreachedCount = 0;
  for (const t of allTickets) {
    if (resolvedOrClosedStatuses.has(t.status)) continue;
    const slaHours = slaRules[t.priority];
    if (!slaHours) continue;
    const deadline = new Date(new Date(t.createdAt).getTime() + slaHours * 60 * 60 * 1000);
    if (new Date(currentTime) > deadline) slaBreachedCount++;
  }

  // Daily ticket counts (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dailyCounts: Record<string, { created: number; resolved: number }> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyCounts[key] = { created: 0, resolved: 0 };
  }
  for (const t of allTickets) {
    const createdKey = t.createdAt.slice(0, 10);
    if (dailyCounts[createdKey]) dailyCounts[createdKey].created++;
    if (t.resolvedAt) {
      const resolvedKey = t.resolvedAt.slice(0, 10);
      if (dailyCounts[resolvedKey]) dailyCounts[resolvedKey].resolved++;
    }
  }
  const dailyTicketCounts = Object.entries(dailyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));

  // Top categories (open tickets)
  const categoryCounts = new Map<string, number>();
  for (const t of allTickets) {
    if (!resolvedOrClosedStatuses.has(t.status) && t.categoryId) {
      categoryCounts.set(t.categoryId, (categoryCounts.get(t.categoryId) ?? 0) + 1);
    }
  }
  const topCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([categoryId, count]) => ({
      categoryId,
      categoryName: database.categories.find((c) => c.id === categoryId)?.name ?? "Nieznana",
      count
    }));

  // Agent workload
  const workloadMap = new Map<string, number>();
  for (const t of allTickets) {
    if (!resolvedOrClosedStatuses.has(t.status) && t.assigneeId) {
      workloadMap.set(t.assigneeId, (workloadMap.get(t.assigneeId) ?? 0) + 1);
    }
  }
  const unassignedCount = allTickets.filter(
    (t) => !resolvedOrClosedStatuses.has(t.status) && !t.assigneeId
  ).length;
  const agentWorkload = [...workloadMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([agentId, openCount]) => ({
      agentId,
      agentName: database.users.find((u) => u.id === agentId)?.name ?? "Nieznany",
      openCount
    }));
  if (unassignedCount > 0) {
    agentWorkload.unshift({ agentId: "_unassigned", agentName: "Nieprzypisane", openCount: unassignedCount });
  }

  // Recent events
  const recentEvents = [...database.events]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20)
    .map((e) => ({
      ...e,
      actorName: database.users.find((u) => u.id === e.actorId)?.name,
      ticketNumber: database.tickets.find((t) => t.id === e.ticketId)?.number
    }));

  return {
    kpi: { openTickets, criticalTickets, avgResolutionHours, slaBreachedCount },
    dailyTicketCounts,
    topCategories,
    agentWorkload,
    recentEvents
  };
}

export async function exportTicketsCSV(): Promise<string> {
  const headers = [
    "Numer",
    "Tytul",
    "Status",
    "Priorytet",
    "Blokuje prace",
    "Kategoria",
    "Sklep",
    "Zgłaszający",
    "Wykonawca",
    "Utworzono",
    "Zaktualizowano",
    "Rozwiązano",
    "Zamknięto"
  ];

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const tickets = await db.ticket.findMany({
      orderBy: { createdAt: "desc" }
    });
    const users = await db.user.findMany();
    const stores = await db.store.findMany();
    const categories = await db.category.findMany();

    const userMap = new Map(users.map((u) => [u.id, u]));
    const storeMap = new Map(stores.map((s) => [s.id, s]));
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const rows = tickets.map((t) => [
      escapeCSV(t.number),
      escapeCSV(t.title),
      t.status,
      t.priority,
      t.blocksWork ? "Tak" : "Nie",
      escapeCSV(categoryMap.get(t.categoryId ?? "")?.name ?? ""),
      escapeCSV(storeMap.get(t.storeId ?? "")?.name ?? ""),
      escapeCSV(userMap.get(t.reporterId)?.email ?? ""),
      escapeCSV(userMap.get(t.assigneeId ?? "")?.email ?? ""),
      t.createdAt.toISOString(),
      t.updatedAt.toISOString(),
      t.resolvedAt?.toISOString() ?? "",
      t.closedAt?.toISOString() ?? ""
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  const database = await readDatabase();
  const userMap = new Map(database.users.map((u) => [u.id, u]));
  const storeMap = new Map(database.stores.map((s) => [s.id, s]));
  const categoryMap = new Map(database.categories.map((c) => [c.id, c]));

  const rows = database.tickets
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((t) => [
      escapeCSV(t.number),
      escapeCSV(t.title),
      t.status,
      t.priority,
      t.blocksWork ? "Tak" : "Nie",
      escapeCSV(categoryMap.get(t.categoryId)?.name ?? ""),
      escapeCSV(storeMap.get(t.storeId ?? "")?.name ?? ""),
      escapeCSV(userMap.get(t.reporterId)?.email ?? ""),
      escapeCSV(userMap.get(t.assigneeId ?? "")?.email ?? ""),
      t.createdAt,
      t.updatedAt,
      t.resolvedAt ?? "",
      t.closedAt ?? ""
    ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function escapeCSV(value: string): string {
  // Spreadsheet formula injection prevention: neutralize leading = + - @
  // by prepending a single quote (works in Excel, Google Sheets, LibreOffice)
  const sanitized = /^[=+\-@]/.test(value) ? `'${value}` : value;

  if (sanitized.includes(",") || sanitized.includes('"') || sanitized.includes("\n")) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

export async function getStoreDashboard(storeId: string): Promise<{
  openTickets: number;
  criticalTickets: number;
  blockingTickets: number;
  resolvedToday: number;
  recentEvents: (TicketEvent & { ticketNumber?: string; actorName?: string })[];
}> {
  const today = new Date().toISOString().slice(0, 10);

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const storeTickets = await db.ticket.findMany({ where: { storeId } });
    const storeTicketIds = storeTickets.map((t) => t.id);

    const openTickets = storeTickets.filter((t) => isTicketOpen(t.status)).length;
    const criticalTickets = storeTickets.filter((t) => t.priority === "CRITICAL").length;
    const blockingTickets = storeTickets.filter((t) => t.blocksWork).length;
    const resolvedToday = storeTickets.filter(
      (t) => t.resolvedAt && t.resolvedAt.toISOString().slice(0, 10) === today
    ).length;

    const recentEventsRaw = await db.ticketEvent.findMany({
      where: { ticketId: { in: storeTicketIds } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { actor: { select: { name: true, email: true } } }
    });
    const ticketMap = new Map(storeTickets.map((t) => [t.id, t.number]));
    const recentEvents = recentEventsRaw.map((e) => ({
      ...mapEvent(e),
      ticketNumber: ticketMap.get(e.ticketId) ?? undefined,
      actorName: e.actor?.name ?? e.actor?.email ?? undefined
    }));

    return { openTickets, criticalTickets, blockingTickets, resolvedToday, recentEvents };
  }

  const database = await readDatabase();
  const storeTickets = database.tickets.filter((t) => t.storeId === storeId);
  const storeTicketIds = new Set(storeTickets.map((t) => t.id));

  const openTickets = storeTickets.filter((t) => isTicketOpen(t.status)).length;
  const criticalTickets = storeTickets.filter((t) => t.priority === "CRITICAL").length;
  const blockingTickets = storeTickets.filter((t) => t.blocksWork).length;
  const resolvedToday = storeTickets.filter(
    (t) => t.resolvedAt && t.resolvedAt.slice(0, 10) === today
  ).length;

  const recentEvents = database.events
    .filter((e) => storeTicketIds.has(e.ticketId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
    .map((e) => ({
      ...e,
      ticketNumber: storeTickets.find((t) => t.id === e.ticketId)?.number,
      actorName: database.users.find((user) => user.id === e.actorId)?.name
    }));

  return { openTickets, criticalTickets, blockingTickets, resolvedToday, recentEvents };
}

async function getPrismaClient() {
  return (await import("@/lib/prisma")).prisma;
}

function mapTemplate(
  t: Prisma.ResponseTemplateGetPayload<object>
): ResponseTemplate {
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

function mapMacro(m: Prisma.ResponseMacroGetPayload<object>): ResponseMacro {
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

export async function listTemplates(): Promise<ResponseTemplate[]> {
  if (shouldUsePrisma()) {
    const db = await getPrismaClient();
    const templates = await db.responseTemplate.findMany({
      orderBy: { name: "asc" }
    });
    return templates.map(mapTemplate);
  }

  const database = await readDatabase();
  return [...database.responseTemplates].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export async function createTemplate(input: {
  name: string;
  body: string;
  category?: string;
  createdById: string;
}): Promise<ResponseTemplate> {
  const now = new Date().toISOString();

  if (shouldUsePrisma()) {
    const db = await getPrismaClient();
    const template = await db.responseTemplate.create({
      data: {
        name: input.name,
        body: input.body,
        category: input.category,
        isActive: true,
        createdById: input.createdById
      }
    });
    return mapTemplate(template);
  }

  return withDatabase((database) => {
    const template: ResponseTemplate = {
      id: id("tpl"),
      name: input.name,
      body: input.body,
      category: input.category ?? undefined,
      isActive: true,
      createdById: input.createdById,
      createdAt: now,
      updatedAt: now
    };
    database.responseTemplates.push(template);
    return template;
  });
}

export async function updateTemplate(input: {
  id: string;
  name: string;
  body: string;
  category?: string;
  isActive: boolean;
}): Promise<ResponseTemplate | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrismaClient();
    const existing = await db.responseTemplate.findUnique({ where: { id: input.id } });
    if (!existing) return undefined;

    const template = await db.responseTemplate.update({
      where: { id: input.id },
      data: {
        name: input.name,
        body: input.body,
        category: input.category,
        isActive: input.isActive
      }
    });
    return mapTemplate(template);
  }

  return withDatabase((database) => {
    const template = database.responseTemplates.find((t) => t.id === input.id);
    if (!template) return undefined;

    template.name = input.name;
    template.body = input.body;
    template.category = input.category ?? undefined;
    template.isActive = input.isActive;
    template.updatedAt = new Date().toISOString();
    return template;
  });
}

export async function deleteTemplate(id: string): Promise<boolean> {
  if (shouldUsePrisma()) {
    const db = await getPrismaClient();
    const template = await db.responseTemplate.findUnique({ where: { id } });
    if (!template) return false;
    await db.responseTemplate.delete({ where: { id } });
    return true;
  }

  return withDatabase((database) => {
    const idx = database.responseTemplates.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    database.responseTemplates.splice(idx, 1);
    return true;
  });
}

export async function listMacros(): Promise<ResponseMacro[]> {
  if (shouldUsePrisma()) {
    const db = await getPrismaClient();
    const macros = await db.responseMacro.findMany({
      orderBy: { name: "asc" }
    });
    return macros.map(mapMacro);
  }

  const database = await readDatabase();
  return [...database.responseMacros].sort((a, b) => a.name.localeCompare(b.name));
}

export async function createMacro(input: {
  name: string;
  templateId?: string;
  body?: string;
  newStatus?: TicketStatus;
  newPriority?: TicketPriority;
  createdById: string;
}): Promise<ResponseMacro> {
  const now = new Date().toISOString();

  if (shouldUsePrisma()) {
    const db = await getPrismaClient();
    const macro = await db.responseMacro.create({
      data: {
        name: input.name,
        templateId: input.templateId,
        body: input.body,
        newStatus: input.newStatus,
        newPriority: input.newPriority,
        isActive: true,
        createdById: input.createdById
      }
    });
    return mapMacro(macro);
  }

  return withDatabase((database) => {
    const macro: ResponseMacro = {
      id: id("macro"),
      name: input.name,
      templateId: input.templateId ?? undefined,
      body: input.body ?? undefined,
      newStatus: input.newStatus ?? undefined,
      newPriority: input.newPriority ?? undefined,
      isActive: true,
      createdById: input.createdById,
      createdAt: now,
      updatedAt: now
    };
    database.responseMacros.push(macro);
    return macro;
  });
}

export async function updateMacro(input: {
  id: string;
  name: string;
  templateId?: string;
  body?: string;
  newStatus?: TicketStatus;
  newPriority?: TicketPriority;
  isActive: boolean;
}): Promise<ResponseMacro | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrismaClient();
    const existing = await db.responseMacro.findUnique({ where: { id: input.id } });
    if (!existing) return undefined;

    const macro = await db.responseMacro.update({
      where: { id: input.id },
      data: {
        name: input.name,
        templateId: input.templateId,
        body: input.body,
        newStatus: input.newStatus,
        newPriority: input.newPriority,
        isActive: input.isActive
      }
    });
    return mapMacro(macro);
  }

  return withDatabase((database) => {
    const macro = database.responseMacros.find((m) => m.id === input.id);
    if (!macro) return undefined;

    macro.name = input.name;
    macro.templateId = input.templateId ?? undefined;
    macro.body = input.body ?? undefined;
    macro.newStatus = input.newStatus ?? undefined;
    macro.newPriority = input.newPriority ?? undefined;
    macro.isActive = input.isActive;
    macro.updatedAt = new Date().toISOString();
    return macro;
  });
}

export async function deleteMacro(id: string): Promise<boolean> {
  if (shouldUsePrisma()) {
    const db = await getPrismaClient();
    const macro = await db.responseMacro.findUnique({ where: { id } });
    if (!macro) return false;
    await db.responseMacro.delete({ where: { id } });
    return true;
  }

  return withDatabase((database) => {
    const idx = database.responseMacros.findIndex((m) => m.id === id);
    if (idx === -1) return false;
    database.responseMacros.splice(idx, 1);
    return true;
  });
}
