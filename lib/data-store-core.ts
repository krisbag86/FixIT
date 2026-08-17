import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { unstable_noStore as noStore } from "next/cache";
import { createSeedDatabase } from "@/lib/seed";
import {
  mapAdminAuditLog,
  mapAttachment,
  mapCategory,
  mapComment,
  mapDayLogEntry,
  mapEvent,
  mapKnowledgeArticle,
  mapMacro,
  mapNotificationLog,
  mapScheduleDuty,
  mapScheduleTask,
  mapSession,
  mapSetupToken,
  mapStore,
  mapTemplate,
  mapTicket,
  mapUser
} from "@/lib/data-store-mappers";
import type { Database } from "@/lib/types";

const dataDir = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "fixit-db.json");
let databaseWriteQueue: Promise<void> = Promise.resolve();

export function shouldUsePrisma(): boolean {
  if (process.env.FIXIT_DATA_PROVIDER === "json") {
    return false;
  }

  if (process.env.FIXIT_DATA_PROVIDER === "prisma") {
    return true;
  }

  return process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL);
}

export function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export class DayLogEntryLinkError extends Error {}

export async function getPrisma() {
  return (await import("@/lib/prisma")).prisma;
}

export function now(): string {
  return new Date().toISOString();
}

export function nextTimestamp(previous?: string): string {
  const current = Date.now();
  const previousTime = previous ? Date.parse(previous) : Number.NaN;
  return new Date(Math.max(current, Number.isFinite(previousTime) ? previousTime + 1 : current)).toISOString();
}

export function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

async function ensureDatabase(): Promise<Database> {
  try {
    const raw = await readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<Database>;
    if (!Array.isArray(parsed.attachments)) parsed.attachments = [];
    if (!Array.isArray(parsed.adminAuditLogs)) parsed.adminAuditLogs = [];
    if (!Array.isArray(parsed.responseTemplates)) parsed.responseTemplates = [];
    if (!Array.isArray(parsed.responseMacros)) parsed.responseMacros = [];
    if (!Array.isArray(parsed.dayLogEntries)) parsed.dayLogEntries = [];
    if (!Array.isArray(parsed.scheduleTasks)) parsed.scheduleTasks = [];
    if (!Array.isArray(parsed.scheduleDuties)) parsed.scheduleDuties = [];
    if (!Array.isArray(parsed.setupTokens)) parsed.setupTokens = [];
    if (Array.isArray(parsed.stores)) {
      parsed.stores = parsed.stores.map((store) => ({ ...store, address: store.address ?? "" }));
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
