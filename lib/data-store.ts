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
import { generateTicketNumber } from "@/lib/ticket-number";
import type {
  AdminAuditLog,
  Category,
  CommentVisibility,
  DashboardData,
  DashboardMetrics,
  Database,
  KnowledgeArticle,
  NotificationLog,
  Session,
  Store,
  Ticket,
  TicketAttachment,
  TicketComment,
  TicketEvent,
  TicketPriority,
  TicketStatus,
  User,
  UserRole
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

function mapUser(user: Prisma.UserGetPayload<object> & { passwordHash?: string | null; mustChangePassword?: boolean }): User {
  return {
    id: user.id,
    name: user.name ?? user.email,
    email: user.email,
    role: user.role,
    storeId: definedString(user.storeId),
    department: definedString(user.department),
    isActive: user.isActive,
    passwordHash: definedString((user as { passwordHash?: string | null }).passwordHash),
    mustChangePassword: (user as { mustChangePassword?: boolean }).mustChangePassword
  };
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
    const [users, stores, categories, tickets, comments, attachments, events, knowledgeArticles, notificationLogs, adminAuditLogs, counters, sessions] =
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
        db.session.findMany()
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
      attachments: attachments.map(mapAttachment),
      events: events.map(mapEvent),
      knowledgeArticles: knowledgeArticles.map(mapKnowledgeArticle),
      notificationLogs: notificationLogs.map(mapNotificationLog),
      adminAuditLogs: adminAuditLogs.map(mapAdminAuditLog),
      sessions: sessions.map(mapSession)
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
    return users.map(mapUser);
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
    });
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

export async function listCategoriesAdmin(options?: { includeInactive?: boolean }): Promise<Category[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const categories = await db.category.findMany({
      where: options?.includeInactive ? undefined : { isActive: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    });
    return categories.map(mapCategory);
  }

  const database = await readDatabase();
  return database.categories
    .filter((category) => options?.includeInactive || category.isActive)
    .sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });
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

export async function findUserByEmail(email: string, options?: { includeInactive?: boolean }): Promise<User | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const user = await db.user.findUnique({ where: { email } });

    if (!user || (!options?.includeInactive && !user.isActive)) {
      return undefined;
    }

    return mapUser(user);
  }

  const database = await readDatabase();
  return database.users.find((user) => user.email === email && (options?.includeInactive || user.isActive));
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

export async function updateUserAdmin(input: {
  userId: string;
  role: UserRole;
  storeId?: string;
  department?: string;
  isActive: boolean;
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

    const updated = await db.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: input.userId },
        data: {
          role: input.role,
          storeId: input.storeId,
          department: input.department,
          isActive: input.isActive
        }
      });

      const changes = getUserAuditChanges(mapUser(existing), {
        role: nextUser.role,
        storeId: definedString(nextUser.storeId),
        department: definedString(nextUser.department),
        isActive: nextUser.isActive
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

    const changes = getUserAuditChanges(user, input);
    user.role = input.role;
    user.storeId = input.storeId;
    user.department = input.department;
    user.isActive = input.isActive;

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

    return {
      totalTickets,
      openTickets,
      criticalTickets,
      avgResolutionHours: avgResolutionHours !== null ? Math.round(avgResolutionHours * 10) / 10 : null,
      topCategories,
      slaBreached
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

  return {
    totalTickets,
    openTickets,
    criticalTickets,
    avgResolutionHours: avgResolutionHours !== null ? Math.round(avgResolutionHours * 10) / 10 : null,
    topCategories,
    slaBreached
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
  recentEvents: (TicketEvent & { ticketNumber?: string })[];
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
      take: 5
    });
    const ticketMap = new Map(storeTickets.map((t) => [t.id, t.number]));
    const recentEvents = recentEventsRaw.map((e) => ({
      ...mapEvent(e),
      ticketNumber: ticketMap.get(e.ticketId) ?? undefined
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
      ticketNumber: storeTickets.find((t) => t.id === e.ticketId)?.number
    }));

  return { openTickets, criticalTickets, blockingTickets, resolvedToday, recentEvents };
}

export async function deleteAttachment(id: string): Promise<TicketAttachment | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const attachment = await db.ticketAttachment.findUnique({ where: { id } });
    if (!attachment) return undefined;
    await db.ticketAttachment.delete({ where: { id } });
    return mapAttachment(attachment);
  }

  return withDatabase((database) => {
    const idx = database.attachments.findIndex((a) => a.id === id);
    if (idx === -1) return undefined;
    const [removed] = database.attachments.splice(idx, 1);
    return removed;
  });
}
