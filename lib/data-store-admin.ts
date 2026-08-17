import "server-only";

import {
  buildAuditPayload,
  describeAuditChanges,
  getCategoryAuditChanges,
  getCategoryUsageSummary,
  getStoreAuditChanges,
  getStoreUsageSummary,
  getUserAuditChanges
} from "@/lib/admin-utils";
import { archivedStatuses } from "@/lib/ticket-filters";
import { appendAdminAuditLog } from "@/lib/data-store-audit";
import {
  definedString,
  mapAdminAuditLog,
  mapCategory,
  mapKnowledgeArticle,
  mapStore,
  mapStoredUser,
  mapTicket,
  mapUser
} from "@/lib/data-store-mappers";
import { getPrisma, id, readDatabase, shouldUsePrisma, withDatabase } from "@/lib/data-store-core";
import { listVisibleTickets } from "@/lib/data-store-tickets";
import type {
  AdminAuditLog,
  Category,
  Database,
  KnowledgeArticle,
  Store,
  Ticket,
  TicketPriority,
  User,
  UserRole
} from "@/lib/types";

export async function recordSecurityAudit(input: {
  actorId?: string;
  action: string;
  entityId: string;
  summary: string;
  payload?: Record<string, string>;
}): Promise<void> {
  try {
    if (shouldUsePrisma()) {
      const db = await getPrisma();
      await db.adminAuditLog.create({
        data: {
          actorId: input.actorId,
          action: input.action,
          entityType: "AUTH",
          entityId: input.entityId,
          summary: input.summary,
          payload: input.payload
        }
      });
      return;
    }

    await withDatabase((database) => {
      appendAdminAuditLog(database, {
        actorId: input.actorId,
        action: input.action,
        entityType: "AUTH",
        entityId: input.entityId,
        summary: input.summary,
        payload: input.payload
      });
    });
  } catch (error) {
    // Authentication must remain available if the audit sink is temporarily
    // unavailable; the failure is still visible to server-side monitoring.
    console.error("Security audit write failed:", error);
  }
}

export async function updateUserMfa(input: {
  userId: string;
  enabled: boolean;
  secret?: string | null;
  actorId: string;
  auditAction?: string;
}): Promise<User | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const updated = await db.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: input.userId },
        data: {
          mfaEnabled: input.enabled,
          mfaSecret: input.secret === undefined ? null : input.secret
        }
      });

      await tx.adminAuditLog.create({
        data: {
          actorId: input.actorId,
          action: input.auditAction ?? (input.enabled ? "MFA_ENABLED" : "MFA_DISABLED"),
          entityType: "AUTH",
          entityId: user.id,
          summary: `${user.email}: MFA ${input.enabled ? "włączone" : "wyłączone"}`
        }
      });

      return user;
    });

    return mapUser(updated);
  }

  return withDatabase((database) => {
    const user = database.users.find((item) => item.id === input.userId);
    if (!user) {
      return undefined;
    }

    user.mfaEnabled = input.enabled;
    user.mfaSecret = input.secret === undefined || input.secret === null ? undefined : input.secret;
    appendAdminAuditLog(database, {
      actorId: input.actorId,
      action: input.auditAction ?? (input.enabled ? "MFA_ENABLED" : "MFA_DISABLED"),
      entityType: "AUTH",
      entityId: user.id,
      summary: `${user.email}: MFA ${input.enabled ? "włączone" : "wyłączone"}`
    });

    return mapStoredUser(user);
  });
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
    tickets: await listVisibleTickets(user),
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
  options?: { includeInactive?: boolean; includePasswordHash?: boolean; includeMfaSecret?: boolean }
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
  options?: { includeInactive?: boolean; includePasswordHash?: boolean; includeMfaSecret?: boolean }
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
