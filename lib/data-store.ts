import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { unstable_noStore as noStore } from "next/cache";
import type { Prisma } from "@prisma/client";
import { createSeedDatabase } from "@/lib/seed";
import { generateTicketNumber } from "@/lib/ticket-number";
import type {
  Category,
  CommentVisibility,
  Database,
  KnowledgeArticle,
  NotificationLog,
  Store,
  Ticket,
  TicketComment,
  TicketEvent,
  TicketPriority,
  TicketStatus,
  User
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

async function getPrisma() {
  return (await import("@/lib/prisma")).prisma;
}

function now(): string {
  return new Date().toISOString();
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

function mapUser(user: Prisma.UserGetPayload<object>): User {
  return {
    id: user.id,
    name: user.name ?? user.email,
    email: user.email,
    role: user.role,
    storeId: definedString(user.storeId),
    department: definedString(user.department),
    isActive: user.isActive
  };
}

function mapStore(store: Prisma.StoreGetPayload<object>): Store {
  return {
    id: store.id,
    code: store.code,
    name: store.name,
    city: definedString(store.city) ?? "",
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

async function ensureDatabase(): Promise<Database> {
  try {
    const raw = await readFile(dataFile, "utf8");
    return JSON.parse(raw) as Database;
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
    const [users, stores, categories, tickets, comments, events, knowledgeArticles, notificationLogs, counters] =
      await Promise.all([
        db.user.findMany(),
        db.store.findMany(),
        db.category.findMany(),
        db.ticket.findMany(),
        db.ticketComment.findMany(),
        db.ticketEvent.findMany(),
        db.knowledgeArticle.findMany(),
        db.notificationLog.findMany(),
        db.ticketCounter.findMany()
      ]);

    return {
      meta: {
        ticketSequences: Object.fromEntries(counters.map((counter) => [String(counter.year), counter.sequence]))
      },
      users: users.map(mapUser),
      stores: stores.map(mapStore),
      categories: categories.map(mapCategory),
      tickets: tickets.map(mapTicket),
      comments: comments.map(mapComment),
      events: events.map(mapEvent),
      knowledgeArticles: knowledgeArticles.map(mapKnowledgeArticle),
      notificationLogs: notificationLogs.map(mapNotificationLog)
    };
  }

  return ensureDatabase();
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

export async function getUsers(): Promise<User[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const users = await db.user.findMany({
      where: { isActive: true },
      orderBy: [{ role: "asc" }, { name: "asc" }]
    });
    return users.map(mapUser);
  }

  const database = await readDatabase();
  return database.users.filter((user) => user.isActive);
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

export async function createOrFindUser(email: string): Promise<User> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const existing = await db.user.findUnique({ where: { email } });

    if (existing) {
      return mapUser(existing);
    }

    const created = await db.user.create({
      data: {
        name: email.split("@")[0].replace(/[._-]/g, " "),
        email,
        role: "REPORTER",
        department: "Biuro",
        isActive: true
      }
    });

    return mapUser(created);
  }

  return withDatabase((database) => {
    const existing = database.users.find((user) => user.email === email);

    if (existing) {
      return existing;
    }

    const user: User = {
      id: id("usr"),
      name: email.split("@")[0].replace(/[._-]/g, " "),
      email,
      role: "REPORTER",
      department: "Biuro",
      isActive: true
    };

    database.users.push(user);
    return user;
  });
}

export async function findUserById(userId: string): Promise<User | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const user = await db.user.findFirst({ where: { id: userId, isActive: true } });
    return user ? mapUser(user) : undefined;
  }

  const database = await readDatabase();
  return database.users.find((user) => user.id === userId && user.isActive);
}

export async function listVisibleTickets(user: User): Promise<Ticket[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const where: Prisma.TicketWhereInput =
      user.role === "AGENT" || user.role === "ADMIN"
        ? {}
        : {
            OR: [
              { reporterId: user.id },
              ...(user.role === "STORE_MANAGER" && user.storeId ? [{ storeId: user.storeId }] : [])
            ]
          };

    const tickets = await db.ticket.findMany({
      where,
      orderBy: { updatedAt: "desc" }
    });

    return tickets.map(mapTicket);
  }

  const database = await readDatabase();
  const tickets = database.tickets.filter((ticket) => {
    if (user.role === "AGENT" || user.role === "ADMIN") {
      return true;
    }

    if (ticket.reporterId === user.id) {
      return true;
    }

    return user.role === "STORE_MANAGER" && Boolean(user.storeId) && user.storeId === ticket.storeId;
  });

  return tickets.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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

export async function createTicket(input: {
  title: string;
  description: string;
  blocksWork: boolean;
  contact: string;
  categoryId: string;
  storeId?: string;
  department?: string;
  reporterId: string;
  priority: TicketPriority;
}): Promise<Ticket> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const year = new Date().getFullYear();

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

      await tx.ticketEvent.create({
        data: {
          ticketId: created.id,
          actorId: input.reporterId,
          type: "TICKET_CREATED"
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

    return mapTicket(ticket);
  }

  return withDatabase((database) => {
    const year = String(new Date().getFullYear());
    const nextSequence = (database.meta.ticketSequences[year] ?? 0) + 1;
    database.meta.ticketSequences[year] = nextSequence;

    const timestamp = now();
    const ticket: Ticket = {
      id: id("t"),
      number: generateTicketNumber(Number(year), nextSequence),
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
    database.events.push({
      id: id("e"),
      ticketId: ticket.id,
      actorId: input.reporterId,
      type: "TICKET_CREATED",
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

    return ticket;
  });
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
          ...(statusChanged && input.status === "RESOLVED" ? { resolvedAt: timestamp } : {}),
          ...(statusChanged && input.status === "CLOSED" ? { closedAt: timestamp } : {})
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
      ticket.resolvedAt = input.status === "RESOLVED" ? timestamp : ticket.resolvedAt;
      ticket.closedAt = input.status === "CLOSED" ? timestamp : ticket.closedAt;
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
        sentAt: new Date(),
        error: status === "FAILED" ? error : null
      }
    });
    return;
  }

  return withDatabase((database) => {
    const notification = database.notificationLogs.find((item) => item.id === notificationId);
    if (notification) {
      notification.status = status;
      notification.sentAt = new Date().toISOString();
      notification.error = status === "FAILED" ? error : undefined;
    }
  });
}

export async function getNotificationLog(notificationId: string): Promise<NotificationLog | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const notification = await db.notificationLog.findUnique({ where: { id: notificationId } });
    return notification ? mapNotificationLog(notification) : undefined;
  }

  const database = await readDatabase();
  return database.notificationLogs.find((item) => item.id === notificationId);
}

export async function listPublishedKnowledgeArticles(options?: { categoryId?: string; query?: string }): Promise<KnowledgeArticle[]> {
  const categoryId = options?.categoryId;
  const query = options?.query?.toLowerCase().trim();

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const where: Record<string, unknown> = { isPublished: true };
    if (categoryId) where.categoryId = categoryId;
    if (query) {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { body: { contains: query, mode: "insensitive" } }
      ];
    }
    const articles = await db.knowledgeArticle.findMany({
      where,
      orderBy: { title: "asc" }
    });
    return articles.map(mapKnowledgeArticle);
  }

  const database = await readDatabase();
  return database.knowledgeArticles
    .filter((a) => a.isPublished)
    .filter((a) => !categoryId || a.categoryId === categoryId)
    .filter((a) => !query || a.title.toLowerCase().includes(query) || a.body.toLowerCase().includes(query))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function listKnowledgeArticles(): Promise<KnowledgeArticle[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const articles = await db.knowledgeArticle.findMany({ orderBy: { title: "asc" } });
    return articles.map(mapKnowledgeArticle);
  }

  const database = await readDatabase();
  return [...database.knowledgeArticles].sort((a, b) => a.title.localeCompare(b.title));
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
}): Promise<KnowledgeArticle> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const article = await db.knowledgeArticle.create({
      data: {
        title: input.title,
        slug: input.slug,
        body: input.body,
        categoryId: input.categoryId,
        isPublished: input.isPublished,
        createdById: input.createdById
      }
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
}): Promise<KnowledgeArticle | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const article = await db.knowledgeArticle.update({
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
    return mapKnowledgeArticle(article);
  }

  return withDatabase((database) => {
    const article = database.knowledgeArticles.find((a) => a.id === input.id);
    if (!article) return undefined;
    article.title = input.title;
    article.slug = input.slug;
    article.body = input.body;
    article.categoryId = input.categoryId;
    article.isPublished = input.isPublished;
    return article;
  });
}

export async function deleteKnowledgeArticle(id: string): Promise<boolean> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    await db.knowledgeArticle.delete({ where: { id } });
    return true;
  }

  return withDatabase((database) => {
    const idx = database.knowledgeArticles.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    database.knowledgeArticles.splice(idx, 1);
    return true;
  });
}
