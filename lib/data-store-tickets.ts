import "server-only";

import type { Prisma } from "@prisma/client";
import { generateTicketNumber } from "@/lib/ticket-number";
import { archivedStatuses, closedStatuses, matchesTicketFilters, type TicketListFilters } from "@/lib/ticket-filters";
import {
  buildAttentionWhere,
  buildSlaBreachedWhere,
  buildStageWhere
} from "@/lib/ticket-query";
import { isRequesterPortalUser } from "@/lib/requester-portal";
import {
  DayLogEntryLinkError,
  getPrisma,
  id,
  isUniqueConstraintError,
  now,
  readDatabase,
  shouldUsePrisma,
  withDatabase
} from "@/lib/data-store-core";
import {
  mapCategory,
  mapComment,
  mapEvent,
  mapStore,
  mapStoredUser,
  mapTicket,
  mapUser
} from "@/lib/data-store-mappers";
import type {
  Category,
  CommentVisibility,
  NotificationLog,
  Store,
  Ticket,
  TicketComment,
  TicketEvent,
  TicketPriority,
  TicketStatus,
  User
} from "@/lib/types";

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

export type TicketListPageOptions = {
  cursor?: string;
  limit?: number;
  includeFilterOptions?: boolean;
  includeQueueSummary?: boolean;
};

function buildVisibleTicketQuery(user: User, filters: TicketListFilters, cursor?: string): { where: Prisma.TicketWhereInput } {
  const visibilityWhere: Prisma.TicketWhereInput = isRequesterPortalUser(user)
    ? { reporterId: user.id }
    : user.role === "AGENT" || user.role === "ADMIN"
      ? {}
      : { reporterId: user.id };
  const query = filters.query?.trim();
  const currentTime = new Date();
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
  else if (filters.stage) filterWhere.push(buildStageWhere(filters.stage));
  if (filters.priority) filterWhere.push({ priority: filters.priority });
  if (filters.assigneeId) filterWhere.push({ assigneeId: filters.assigneeId });
  if (filters.storeId) filterWhere.push({ storeId: filters.storeId });
  if (filters.categoryId) filterWhere.push({ categoryId: filters.categoryId });
  if (filters.mine) filterWhere.push({ assigneeId: user.id });
  if (filters.unassigned) filterWhere.push({ assigneeId: null });
  filterWhere.push(filters.archived ? { status: { in: [...archivedStatuses] } } : { status: { notIn: [...archivedStatuses] } });

  if (filters.attention) filterWhere.push(buildAttentionWhere(filters.attention, currentTime));
  else if (filters.overdue) filterWhere.push(buildSlaBreachedWhere(currentTime));

  const decodedCursor = decodeTicketCursor(cursor);
  if (decodedCursor) {
    filterWhere.push({ OR: [{ updatedAt: { lt: decodedCursor.updatedAt } }, { updatedAt: decodedCursor.updatedAt, id: { lt: decodedCursor.id } }] });
  }
  return { where: { AND: filterWhere } };
}

function filterVisibleTickets(tickets: Ticket[], user: User, filters: TicketListFilters): Ticket[] {
  return tickets
    .filter((ticket) => {
      if (user.role === "AGENT" || user.role === "ADMIN") return matchesTicketFilters(ticket, filters, user.id);
      const visible = isRequesterPortalUser(user)
        ? ticket.reporterId === user.id
        : ticket.reporterId === user.id || (user.role === "STORE_MANAGER" && Boolean(user.storeId) && user.storeId === ticket.storeId);
      return visible && matchesTicketFilters(ticket, filters, user.id);
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

export async function listVisibleTickets(user: User, filters: TicketListFilters = {}): Promise<Ticket[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const { where } = buildVisibleTicketQuery(user, filters);
    const tickets = await db.ticket.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }] });
    return tickets.map(mapTicket);
  }
  const database = await readDatabase();
  return filterVisibleTickets(database.tickets, user, filters);
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
    const rows = await db.ticket.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: limit + 1 });
    const hasMore = rows.length > limit;
    const tickets = rows.slice(0, limit).map(mapTicket);
    return { tickets, hasMore, ...(hasMore && tickets.length ? { nextCursor: encodeTicketCursor(tickets[tickets.length - 1]) } : {}) };
  }

  const allTickets = filterVisibleTickets((await readDatabase()).tickets, user, filters);
  const decodedCursor = decodeTicketCursor(options?.cursor);
  const startIndex = decodedCursor
    ? allTickets.findIndex((ticket) => ticket.id === decodedCursor.id && ticket.updatedAt === decodedCursor.updatedAt.toISOString()) + 1
    : 0;
  const safeStart = startIndex > 0 ? startIndex : 0;
  const tickets = allTickets.slice(safeStart, safeStart + limit);
  const hasMore = safeStart + limit < allTickets.length;
  return { tickets, hasMore, ...(hasMore && tickets.length ? { nextCursor: encodeTicketCursor(tickets[tickets.length - 1]) } : {}) };
}

export async function getTicketListPageData(
  user: User,
  filters: TicketListFilters = {},
  options?: TicketListPageOptions
): Promise<TicketListPageData> {
  const includeFilterOptions = options?.includeFilterOptions ?? false;
  const includeQueueSummary = options?.includeQueueSummary ?? false;
  const limit = Math.min(Math.max(options?.limit ?? DEFAULT_TICKET_PAGE_SIZE, 1), MAX_TICKET_PAGE_SIZE);

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const { where } = buildVisibleTicketQuery(user, filters, options?.cursor);
    const [rows, openTickets, criticalTickets] = await Promise.all([
      db.ticket.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: limit + 1 }),
      includeQueueSummary ? db.ticket.count({ where: { status: { notIn: [...closedStatuses] } } }) : Promise.resolve(0),
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
      ...(hasMore && tickets.length ? { nextCursor: encodeTicketCursor(tickets[tickets.length - 1]) } : {}),
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
  const tickets = allTickets.slice(safeStart, safeStart + limit);
  const hasMore = safeStart + limit < allTickets.length;
  const ticketUserIds = new Set(tickets.flatMap((ticket) => [ticket.reporterId, ticket.assigneeId].filter(Boolean) as string[]));
  const ticketStoreIds = new Set(tickets.map((ticket) => ticket.storeId).filter(Boolean));
  const ticketCategoryIds = new Set(tickets.map((ticket) => ticket.categoryId).filter(Boolean));
  return {
    tickets,
    hasMore,
    ...(hasMore && tickets.length ? { nextCursor: encodeTicketCursor(tickets[tickets.length - 1]) } : {}),
    users: database.users.filter((item) => includeFilterOptions || ticketUserIds.has(item.id)).map((item) => mapStoredUser(item)),
    stores: database.stores.filter((item) => includeFilterOptions || ticketStoreIds.has(item.id)),
    categories: database.categories.filter((item) => includeFilterOptions || ticketCategoryIds.has(item.id)),
    openTickets: includeQueueSummary ? database.tickets.filter((ticket) => !closedStatuses.has(ticket.status)).length : 0,
    criticalTickets: includeQueueSummary ? database.tickets.filter((ticket) => ticket.priority === "CRITICAL").length : 0
  };
}

export async function findTicket(ticketId: string): Promise<Ticket | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const ticket = await db.ticket.findFirst({ where: { OR: [{ id: ticketId }, { number: ticketId }] } });
    return ticket ? mapTicket(ticket) : undefined;
  }
  return (await readDatabase()).tickets.find((ticket) => ticket.id === ticketId || ticket.number === ticketId);
}

export async function listComments(ticketId: string, includeInternal: boolean): Promise<TicketComment[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const comments = await db.ticketComment.findMany({
      where: { ticketId, ...(includeInternal ? {} : { visibility: "PUBLIC" }) },
      orderBy: { createdAt: "asc" }
    });
    return comments.map(mapComment);
  }
  const database = await readDatabase();
  return database.comments
    .filter((comment) => comment.ticketId === ticketId && (includeInternal || comment.visibility === "PUBLIC"))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function listEvents(ticketId: string, includeInternal = true): Promise<TicketEvent[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    return (await db.ticketEvent.findMany({
      where: { ticketId, ...(includeInternal ? {} : { type: { not: "INTERNAL_NOTE_CREATED" } }) },
      orderBy: { createdAt: "asc" }
    })).map(mapEvent);
  }
  return (await readDatabase()).events
    .filter((event) => event.ticketId === ticketId && (includeInternal || event.type !== "INTERNAL_NOTE_CREATED"))
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
      const existing = await db.ticket.findFirst({ where: { reporterId: input.reporterId, submissionId: input.submissionId } });
      if (existing) return { ticket: mapTicket(existing), created: false };
    }
    if (input.dayLogEntryId) {
      const sourceEntry = await db.dayLogEntry.findUnique({ where: { id: input.dayLogEntryId }, include: { ticket: true } });
      if (!sourceEntry) throw new Error("Wpis DayLog nie istnieje.");
      if (sourceEntry.ticket) return { ticket: mapTicket(sourceEntry.ticket), created: false };
    }
    try {
      const ticket = await db.$transaction(async (tx) => {
        await tx.ticketCounter.upsert({ where: { year }, create: { year, sequence: 0 }, update: {} });
        const counter = await tx.ticketCounter.update({ where: { year }, data: { sequence: { increment: 1 } } });
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
          const linked = await tx.dayLogEntry.updateMany({ where: { id: input.dayLogEntryId, ticketId: null }, data: { ticketId: created.id } });
          if (linked.count !== 1) throw new DayLogEntryLinkError("Wpis DayLog został już powiązany ze zgłoszeniem.");
        }
        await tx.ticketEvent.create({
          data: { ticketId: created.id, actorId: input.reporterId, type: "TICKET_CREATED", payload: input.dayLogEntryId ? { dayLogEntryId: input.dayLogEntryId } : undefined }
        });
        const reporter = await tx.user.findUnique({ where: { id: input.reporterId }, select: { email: true } });
        if (reporter?.email) await tx.notificationLog.create({ data: { ticketId: created.id, recipientEmail: reporter.email, type: "TICKET_CREATED", status: "QUEUED" } });
        return created;
      });
      return { ticket: mapTicket(ticket), created: true };
    } catch (error) {
      if (error instanceof DayLogEntryLinkError && input.dayLogEntryId) {
        const sourceEntry = await db.dayLogEntry.findUnique({ where: { id: input.dayLogEntryId }, include: { ticket: true } });
        if (sourceEntry?.ticket) return { ticket: mapTicket(sourceEntry.ticket), created: false };
        if (!sourceEntry) throw new Error("Wpis DayLog nie istnieje.");
      }
      if (!input.submissionId || !isUniqueConstraintError(error)) throw error;
      const existing = await db.ticket.findFirst({ where: { reporterId: input.reporterId, submissionId: input.submissionId } });
      if (!existing) throw error;
      return { ticket: mapTicket(existing), created: false };
    }
  }

  return withDatabase((database) => {
    const existing = input.submissionId
      ? database.tickets.find((ticket) => ticket.reporterId === input.reporterId && ticket.submissionId === input.submissionId)
      : undefined;
    if (existing) return { ticket: existing, created: false };
    const sourceEntry = input.dayLogEntryId ? database.dayLogEntries?.find((entry) => entry.id === input.dayLogEntryId) : undefined;
    if (input.dayLogEntryId && !sourceEntry) throw new Error("Wpis DayLog nie istnieje.");
    if (sourceEntry?.ticketId) {
      const linkedTicket = database.tickets.find((ticket) => ticket.id === sourceEntry.ticketId);
      if (!linkedTicket) throw new Error("Powiązane zgłoszenie nie istnieje.");
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
    database.events.push({ id: id("e"), ticketId: ticket.id, actorId: input.reporterId, type: "TICKET_CREATED", payload: input.dayLogEntryId ? { dayLogEntryId: input.dayLogEntryId } : undefined, createdAt: timestamp });
    database.notificationLogs.push({ id: id("n"), ticketId: ticket.id, recipientEmail: database.users.find((user) => user.id === input.reporterId)?.email ?? "", type: "TICKET_CREATED", status: "QUEUED", createdAt: timestamp });
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
      if (!ticket) return undefined;
      const statusChanged = ticket.status !== input.status;
      const priorityChanged = ticket.priority !== input.priority;
      const assigneeChanged = (ticket.assigneeId ?? "") !== (input.assigneeId ?? "");
      const timestamp = new Date();
      const nextResolvedAt =
        !statusChanged
          ? undefined
          : input.status === "RESOLVED"
            ? timestamp
            : input.status === "CLOSED"
              ? undefined
              : null;
      const events: Prisma.TicketEventCreateManyInput[] = [];
      if (statusChanged) events.push({ ticketId: ticket.id, actorId: input.actorId, type: "STATUS_CHANGED", payload: { from: ticket.status, to: input.status } });
      if (priorityChanged) events.push({ ticketId: ticket.id, actorId: input.actorId, type: "PRIORITY_CHANGED", payload: { from: ticket.priority, to: input.priority } });
      if (assigneeChanged) events.push({ ticketId: ticket.id, actorId: input.actorId, type: "ASSIGNEE_CHANGED", payload: { assigneeId: input.assigneeId ?? "" } });
      const nextTicket = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: input.status,
          priority: input.priority,
          assigneeId: input.assigneeId,
          resolvedAt: nextResolvedAt,
          closedAt: statusChanged && input.status === "CLOSED" ? timestamp : statusChanged && ticket.status === "CLOSED" ? null : undefined
        }
      });
      if (events.length) await tx.ticketEvent.createMany({ data: events });
      if (statusChanged && input.status === "RESOLVED") {
        const reporter = await tx.user.findUnique({ where: { id: ticket.reporterId }, select: { email: true } });
        if (reporter?.email) await tx.notificationLog.create({ data: { ticketId: ticket.id, recipientEmail: reporter.email, type: "TICKET_RESOLVED", status: "QUEUED" } });
      }
      if (assigneeChanged && input.assigneeId) {
        const assignee = await tx.user.findUnique({ where: { id: input.assigneeId }, select: { email: true } });
        if (assignee?.email) await tx.notificationLog.create({ data: { ticketId: ticket.id, recipientEmail: assignee.email, type: "TICKET_ASSIGNED", status: "QUEUED" } });
      }
      return nextTicket;
    });
    return updated ? mapTicket(updated) : undefined;
  }

  return withDatabase((database) => {
    const ticket = database.tickets.find((item) => item.id === input.ticketId);
    if (!ticket) return undefined;
    const timestamp = now();
    const previousStatus = ticket.status;
    const statusChanged = ticket.status !== input.status;
    const priorityChanged = ticket.priority !== input.priority;
    const assigneeChanged = (ticket.assigneeId ?? "") !== (input.assigneeId ?? "");
    const events: TicketEvent[] = [];
    if (statusChanged) {
      events.push({ id: id("e"), ticketId: ticket.id, actorId: input.actorId, type: "STATUS_CHANGED", payload: { from: ticket.status, to: input.status }, createdAt: timestamp });
      ticket.status = input.status;
      if (input.status === "RESOLVED") ticket.resolvedAt = timestamp;
      else if (input.status !== "CLOSED") ticket.resolvedAt = null;
      ticket.closedAt = input.status === "CLOSED" ? timestamp : previousStatus === "CLOSED" ? null : ticket.closedAt;
    }
    if (priorityChanged) {
      events.push({ id: id("e"), ticketId: ticket.id, actorId: input.actorId, type: "PRIORITY_CHANGED", payload: { from: ticket.priority, to: input.priority }, createdAt: timestamp });
      ticket.priority = input.priority;
    }
    if (assigneeChanged) {
      events.push({ id: id("e"), ticketId: ticket.id, actorId: input.actorId, type: "ASSIGNEE_CHANGED", payload: { assigneeId: input.assigneeId ?? "" }, createdAt: timestamp });
      ticket.assigneeId = input.assigneeId;
    }
    if (events.length) {
      ticket.updatedAt = timestamp;
      database.events.push(...events);
    }
    if (statusChanged && input.status === "RESOLVED") {
      const recipientEmail = database.users.find((user) => user.id === ticket.reporterId)?.email;
      if (recipientEmail) database.notificationLogs.push({ id: id("n"), ticketId: ticket.id, recipientEmail, type: "TICKET_RESOLVED", status: "QUEUED", createdAt: timestamp });
    }
    if (assigneeChanged && input.assigneeId) {
      const recipientEmail = database.users.find((user) => user.id === input.assigneeId)?.email;
      if (recipientEmail) database.notificationLogs.push({ id: id("n"), ticketId: ticket.id, recipientEmail, type: "TICKET_ASSIGNED", status: "QUEUED", createdAt: timestamp });
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
      if (!ticket) return undefined;
      const created = await tx.ticketComment.create({ data: { ticketId: ticket.id, authorId: input.authorId, body: input.body, visibility: input.visibility } });
      await tx.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } });
      await tx.ticketEvent.create({ data: { ticketId: ticket.id, actorId: input.authorId, type: input.visibility === "INTERNAL" ? "INTERNAL_NOTE_CREATED" : "COMMENT_CREATED" } });
      if (input.visibility === "PUBLIC") {
        const recipient = ticket.reporterId === input.authorId ? ticket.assigneeId : ticket.reporterId;
        if (recipient) {
          const user = await tx.user.findUnique({ where: { id: recipient }, select: { email: true } });
          if (user?.email) await tx.notificationLog.create({ data: { ticketId: ticket.id, recipientEmail: user.email, type: "COMMENT_CREATED", status: "QUEUED" } });
        }
      }
      return created;
    });
    return comment ? mapComment(comment) : undefined;
  }

  return withDatabase((database) => {
    const ticket = database.tickets.find((item) => item.id === input.ticketId);
    if (!ticket) return undefined;
    const timestamp = now();
    const comment: TicketComment = { id: id("c"), ticketId: ticket.id, authorId: input.authorId, body: input.body, visibility: input.visibility, createdAt: timestamp };
    ticket.updatedAt = timestamp;
    database.comments.push(comment);
    database.events.push({ id: id("e"), ticketId: ticket.id, actorId: input.authorId, type: input.visibility === "INTERNAL" ? "INTERNAL_NOTE_CREATED" : "COMMENT_CREATED", createdAt: timestamp });
    if (input.visibility === "PUBLIC") {
      const recipient = ticket.reporterId === input.authorId ? ticket.assigneeId : ticket.reporterId;
      const recipientEmail = database.users.find((user) => user.id === recipient)?.email;
      if (recipientEmail) {
        const notification: NotificationLog = { id: id("n"), ticketId: ticket.id, recipientEmail, type: "COMMENT_CREATED", status: "QUEUED", createdAt: timestamp };
        database.notificationLogs.push(notification);
      }
    }
    return comment;
  });
}
