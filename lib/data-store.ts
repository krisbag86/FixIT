import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import type { TicketListFilters } from "@/lib/ticket-filters";
import { buildOpenTicketWhere, buildSlaBreachedWhere } from "@/lib/ticket-query";
import {
  COMPLETED_TICKET_STATUSES,
  getTicketSlaDeadline,
  isTicketOverdue
} from "@/lib/ticket-sla";
import {
  mapEvent,
  mapNotificationLog,
  mapTicket,
} from "@/lib/data-store-mappers";
import {
  getPrisma,
  readDatabase,
  shouldUsePrisma,
  withDatabase
} from "@/lib/data-store-core";
import type {
  DashboardData,
  DashboardMetrics,
  NotificationLog,
  TicketEvent,
  TicketStatus,
  User
} from "@/lib/types";
import { getTicketListPageData } from "@/lib/data-store-tickets";
import type { TicketListPageData, TicketListPageOptions } from "@/lib/data-store-tickets";

export { readDatabase, withDatabase, writeDatabase } from "@/lib/data-store-core";
export {
  createDayLogEntry,
  deleteDayLogEntry,
  findDayLogEntry,
  listDayLogEntries,
  updateDayLogEntry
} from "@/lib/data-store-daylog";
export {
  copyPreviousScheduleWeek,
  createScheduleTask,
  deleteScheduleTask,
  findScheduleTask,
  getWeeklySchedule,
  setScheduleDuty,
  toggleScheduleTask,
  updateScheduleTask
} from "@/lib/data-store-schedule";
export { createAttachment, findAttachment, listAttachments } from "@/lib/data-store-attachments";
export {
  createKnowledgeArticle,
  deleteKnowledgeArticle,
  findKnowledgeArticleById,
  findKnowledgeArticleBySlug,
  updateKnowledgeArticle
} from "@/lib/data-store-knowledge";

export {
  createCategoryAdmin,
  createStoreAdmin,
  createUser,
  deleteCategoryAdmin,
  deleteStoreAdmin,
  deleteUserAdmin,
  findCategoryById,
  getTicketDetailReferences,
  findUserByEmail,
  findUserById,
  findUsersByIds,
  getCategories,
  getCategoryAdminPageData,
  getKnowledgePageData,
  getNewTicketFormData,
  getStoreAdminPageData,
  getTicketBoardData,
  listAdminAuditLogs,
  listStoresAdmin,
  listUsersAdmin,
  recordSecurityAudit,
  updateCategoryAdmin,
  updateStoreAdmin,
  updateUserAdmin,
  updateUserMfa
} from "@/lib/data-store-admin";
export {
  addComment,
  createTicket,
  createTicketWithResult,
  findTicket,
  getTicketListPageData,
  listComments,
  listEvents,
  listVisibleTickets,
  listVisibleTicketsPage,
  updateTicket
} from "@/lib/data-store-tickets";
export type { TicketListPage, TicketListPageData, TicketListPageOptions } from "@/lib/data-store-tickets";
export { SLA_HOURS as slaRules } from "@/lib/ticket-sla";

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

  await withDatabase((database) => {
    const notification = database.notificationLogs.find((item) => item.id === notificationId);
    if (!notification) return;
    notification.status = status;
    notification.sentAt = status === "SENT" ? new Date().toISOString() : undefined;
    notification.error = status === "FAILED" ? error : undefined;
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

function hoursBetween(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
}

function isTicketOpen(status: TicketStatus): boolean {
  return !COMPLETED_TICKET_STATUSES.has(status);
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const now = new Date();
    const openTicketWhere = buildOpenTicketWhere();
    const [totalTickets, openTickets, criticalTickets, resolvedTickets, categoryCounts, breachedTickets] = await Promise.all([
      db.ticket.count(),
      db.ticket.count({ where: openTicketWhere }),
      db.ticket.count({ where: { priority: "CRITICAL" } }),
      db.ticket.findMany({
        where: { resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true }
      }),
      db.ticket.groupBy({
        by: ["categoryId"],
        where: { categoryId: { not: null } },
        _count: { _all: true }
      }),
      db.ticket.findMany({
        where: buildSlaBreachedWhere(now),
        select: {
          id: true,
          number: true,
          submissionId: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          impact: true,
          blocksWork: true,
          contact: true,
          categoryId: true,
          storeId: true,
          department: true,
          reporterId: true,
          assigneeId: true,
          dueAt: true,
          resolvedAt: true,
          closedAt: true,
          createdAt: true,
          updatedAt: true
        }
      })
    ]);

    const avgResolutionHours =
      resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum, t) => {
            const start = t.createdAt;
            const end = t.resolvedAt!;
            return sum + hoursBetween(start.toISOString(), end.toISOString());
          }, 0) / resolvedTickets.length
        : null;

    // Top categories
    const topCategoryCounts = categoryCounts
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 5)
    const categoryIds = topCategoryCounts.map((item) => item.categoryId).filter(Boolean) as string[];
    const categories = categoryIds.length > 0
      ? await db.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
      : [];
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
    const topCategories = topCategoryCounts.map((item) => ({
      categoryId: item.categoryId!,
      categoryName: categoryMap.get(item.categoryId!) ?? "Nieznana",
      count: item._count._all
    }));

    // SLA breaches
    const slaBreached: DashboardMetrics["slaBreached"] = [];
    for (const ticket of breachedTickets) {
      const mappedTicket = mapTicket(ticket);
      const deadline = getTicketSlaDeadline(mappedTicket);
      slaBreached.push({
        ticket: mappedTicket,
        slaDeadline: deadline.toISOString(),
        hoursOverdue: Math.round(hoursBetween(deadline.toISOString(), now.toISOString()) * 10) / 10
      });
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
  const currentTime = new Date();

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
    if (!isTicketOverdue(t, currentTime)) continue;
    const deadline = getTicketSlaDeadline(t);
    slaBreached.push({
      ticket: t,
      slaDeadline: deadline.toISOString(),
      hoursOverdue: Math.round(hoursBetween(deadline.toISOString(), currentTime.toISOString()) * 10) / 10
    });
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
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const openTicketWhere = buildOpenTicketWhere();

    const [
      openTickets,
      criticalTickets,
      resolvedTickets,
      slaBreachedCount,
      recentTicketStats,
      categoryCounts,
      workloadCounts,
      unassignedCount,
      events
    ] = await Promise.all([
      db.ticket.count({ where: openTicketWhere }),
      db.ticket.count({ where: { ...openTicketWhere, priority: "CRITICAL" } }),
      db.ticket.findMany({
        where: { resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true }
      }),
      db.ticket.count({ where: buildSlaBreachedWhere(now) }),
      db.ticket.findMany({
        where: {
          OR: [{ createdAt: { gte: thirtyDaysAgo } }, { resolvedAt: { gte: thirtyDaysAgo } }]
        },
        select: { createdAt: true, resolvedAt: true }
      }),
      db.ticket.groupBy({
        by: ["categoryId"],
        where: { ...openTicketWhere, categoryId: { not: null } },
        _count: { _all: true }
      }),
      db.ticket.groupBy({
        by: ["assigneeId"],
        where: { ...openTicketWhere, assigneeId: { not: null } },
        _count: { _all: true }
      }),
      db.ticket.count({ where: { ...openTicketWhere, assigneeId: null } }),
      db.ticketEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          actor: { select: { name: true, email: true } },
          ticket: { select: { number: true } }
        }
      })
    ]);

    const avgResolutionHours =
      resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum, ticket) => {
            return sum + (ticket.resolvedAt!.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60);
          }, 0) / resolvedTickets.length
        : null;

    // Daily ticket counts (last 30 days)
    const dailyCounts: Record<string, { created: number; resolved: number }> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyCounts[key] = { created: 0, resolved: 0 };
    }
    for (const ticket of recentTicketStats) {
      const createdKey = ticket.createdAt.toISOString().slice(0, 10);
      if (dailyCounts[createdKey]) dailyCounts[createdKey].created++;
      if (ticket.resolvedAt) {
        const resolvedKey = ticket.resolvedAt.toISOString().slice(0, 10);
        if (dailyCounts[resolvedKey]) dailyCounts[resolvedKey].resolved++;
      }
    }
    const dailyTicketCounts = Object.entries(dailyCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    // Top categories (open tickets)
    const topCategoryCounts = categoryCounts
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 8)
    const categoryIds = topCategoryCounts.map((item) => item.categoryId).filter(Boolean) as string[];
    const categories = categoryIds.length > 0
      ? await db.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
      : [];
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
    const topCategories = topCategoryCounts.map((item) => ({
      categoryId: item.categoryId!,
      categoryName: categoryMap.get(item.categoryId!) ?? "Nieznana",
      count: item._count._all
    }));

    // Agent workload (open tickets per agent)
    const agentIds = workloadCounts.map((item) => item.assigneeId).filter(Boolean) as string[];
    const users = agentIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: agentIds }, isActive: true },
          select: { id: true, name: true, email: true }
        })
      : [];
    const userMap = new Map(users.map((user) => [user.id, user]));
    const agentWorkload = workloadCounts
      .sort((a, b) => b._count._all - a._count._all)
      .map((item) => ({
        agentId: item.assigneeId!,
        agentName: userMap.get(item.assigneeId!)?.name ?? "Nieznany",
        openCount: item._count._all
      }));
    if (unassignedCount > 0) {
      agentWorkload.unshift({ agentId: "_unassigned", agentName: "Nieprzypisane", openCount: unassignedCount });
    }

    // Recent events
    const recentEvents = events.map((e) => ({
      ...mapEvent(e),
      actorName: e.actor?.name ?? e.actor?.email ?? undefined,
      ticketNumber: e.ticket.number
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

  const openTickets = allTickets.filter((t) => !COMPLETED_TICKET_STATUSES.has(t.status)).length;
  const criticalTickets = allTickets.filter((t) => t.priority === "CRITICAL" && !COMPLETED_TICKET_STATUSES.has(t.status)).length;

  const resolvedTickets = allTickets.filter((t) => t.resolvedAt);
  const avgResolutionHours =
    resolvedTickets.length > 0
      ? resolvedTickets.reduce((sum, t) => sum + hoursBetween(t.createdAt, t.resolvedAt!), 0) / resolvedTickets.length
      : null;

  let slaBreachedCount = 0;
  for (const t of allTickets) {
    if (isTicketOverdue(t, new Date(currentTime))) slaBreachedCount++;
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
    if (!COMPLETED_TICKET_STATUSES.has(t.status) && t.categoryId) {
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
    if (!COMPLETED_TICKET_STATUSES.has(t.status) && t.assigneeId) {
      workloadMap.set(t.assigneeId, (workloadMap.get(t.assigneeId) ?? 0) + 1);
    }
  }
  const unassignedCount = allTickets.filter(
    (t) => !COMPLETED_TICKET_STATUSES.has(t.status) && !t.assigneeId
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
  // Spreadsheet engines may ignore leading whitespace before formula markers.
  // Prefix the entire value so tabs/newlines cannot bypass neutralization.
  const sanitized = /^\s*[=+\-@]/.test(value) ? `'${value}` : value;

  if (sanitized.includes(",") || sanitized.includes('"') || sanitized.includes("\n") || sanitized.includes("\r")) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

export type StoreDashboardData = {
  openTickets: number;
  criticalTickets: number;
  blockingTickets: number;
  resolvedToday: number;
  recentEvents: (TicketEvent & { ticketNumber?: string; actorName?: string })[];
};

export async function getStoreDashboard(storeId: string): Promise<StoreDashboardData> {
  const today = new Date().toISOString().slice(0, 10);

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const [openTickets, criticalTickets, blockingTickets, resolvedToday, recentEventsRaw] = await Promise.all([
      db.ticket.count({ where: { storeId, status: { notIn: [...COMPLETED_TICKET_STATUSES] } } }),
      db.ticket.count({ where: { storeId, priority: "CRITICAL" } }),
      db.ticket.count({ where: { storeId, blocksWork: true } }),
      db.ticket.count({ where: { storeId, resolvedAt: { gte: new Date(`${today}T00:00:00.000Z`), lt: new Date(`${today}T23:59:59.999Z`) } } }),
      db.ticketEvent.findMany({
        where: { ticket: { storeId } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          actor: { select: { name: true, email: true } },
          ticket: { select: { number: true } }
        }
      })
    ]);
    const recentEvents = recentEventsRaw.map((e) => ({
      ...mapEvent(e),
      ticketNumber: e.ticket.number,
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

export async function getStorePageData(
  user: User,
  storeId: string,
  filters: TicketListFilters = {},
  options?: TicketListPageOptions
): Promise<{ dashboard: StoreDashboardData; page: TicketListPageData }> {
  const [dashboard, page] = await Promise.all([
    getStoreDashboard(storeId),
    getTicketListPageData(user, { ...filters, storeId }, options)
  ]);

  return { dashboard, page };
}

export {
  createMacro,
  createTemplate,
  deleteMacro,
  deleteTemplate,
  listMacros,
  listTemplates,
  updateMacro,
  updateTemplate
} from "@/lib/data-store-templates";
