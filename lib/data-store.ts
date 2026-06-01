import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { unstable_noStore as noStore } from "next/cache";
import { createSeedDatabase } from "@/lib/seed";
import { generateTicketNumber } from "@/lib/ticket-number";
import type {
  Category,
  CommentVisibility,
  Database,
  NotificationLog,
  Ticket,
  TicketComment,
  TicketEvent,
  TicketPriority,
  TicketStatus,
  User
} from "@/lib/types";

const dataDir = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "fixit-db.json");

function now(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
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
  return ensureDatabase();
}

export async function writeDatabase(database: Database): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(database, null, 2)}\n`, "utf8");
}

export async function withDatabase<T>(mutator: (database: Database) => T | Promise<T>): Promise<T> {
  const database = await ensureDatabase();
  const result = await mutator(database);
  await writeDatabase(database);
  return result;
}

export async function getUsers(): Promise<User[]> {
  const database = await readDatabase();
  return database.users.filter((user) => user.isActive);
}

export async function getCategories(): Promise<Category[]> {
  const database = await readDatabase();
  return database.categories.filter((category) => category.isActive);
}

export async function createOrFindUser(email: string): Promise<User> {
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
  const database = await readDatabase();
  return database.users.find((user) => user.id === userId && user.isActive);
}

export async function listVisibleTickets(user: User): Promise<Ticket[]> {
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
  const database = await readDatabase();
  return database.tickets.find((ticket) => ticket.id === ticketId || ticket.number === ticketId);
}

export async function listComments(ticketId: string, includeInternal: boolean): Promise<TicketComment[]> {
  const database = await readDatabase();
  return database.comments
    .filter((comment) => comment.ticketId === ticketId)
    .filter((comment) => includeInternal || comment.visibility === "PUBLIC")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function listEvents(ticketId: string): Promise<TicketEvent[]> {
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
  return withDatabase((database) => {
    const ticket = database.tickets.find((item) => item.id === input.ticketId);

    if (!ticket) {
      return undefined;
    }

    const timestamp = now();
    const events: TicketEvent[] = [];

    if (ticket.status !== input.status) {
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

    if (ticket.priority !== input.priority) {
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

    if ((ticket.assigneeId ?? "") !== (input.assigneeId ?? "")) {
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
      database.notificationLogs.push({
        id: id("n"),
        ticketId: ticket.id,
        recipientEmail: database.users.find((user) => user.id === ticket.reporterId)?.email ?? "",
        type: "TICKET_UPDATED",
        status: "QUEUED",
        createdAt: timestamp
      });
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

export async function updateNotificationLog(notificationId: string, status: "SENT" | "FAILED"): Promise<void> {
  return withDatabase((database) => {
    const notification = database.notificationLogs.find((item) => item.id === notificationId);
    if (notification) {
      notification.status = status;
      notification.sentAt = new Date().toISOString();
    }
  });
}

export async function getNotificationLog(notificationId: string): Promise<NotificationLog | undefined> {
  const database = await readDatabase();
  return database.notificationLogs.find((item) => item.id === notificationId);
}
