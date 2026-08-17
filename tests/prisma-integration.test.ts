import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient, User, Category } from "@prisma/client";

// Mock server-only and next/cache for the vitest environment
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_noStore: () => {}
}));

// Integration tests require a real PostgreSQL database. They are skipped
// unless DATABASE_URL is provided (CI Postgres service or local Docker
// compose: postgresql://fixit:fixit@localhost:5433/fixit after migrations).
const hasDatabase = Boolean(process.env.DATABASE_URL);

if (hasDatabase) {
  // Route the data-store runtime to Prisma/PostgreSQL for this file only.
  process.env.FIXIT_DATA_PROVIDER = "prisma";
}

// Table names are double-quoted because some (e.g. "User") are SQL reserved words.
const ALL_TABLES = [
  "ResponseMacro",
  "ResponseTemplate",
  "AdminAuditLog",
  "RateLimit",
  "SetupToken",
  "Session",
  "ScheduleDuty",
  "ScheduleTask",
  "DayLogEntry",
  "NotificationLog",
  "KnowledgeArticle",
  "TicketEvent",
  "TicketAttachment",
  "TicketComment",
  "Ticket",
  "TicketCounter",
  "Category",
  "Store",
  "User"
]
  .map((name) => `"${name}"`)
  .join(", ");

describe.skipIf(!hasDatabase)("PostgreSQL integration (Prisma runtime)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const { prisma: client } = await import("@/lib/prisma");
    prisma = client;
    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    expect(result[0]?.ok).toBe(1);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  afterEach(async () => {
    // Start every test from an empty, migrated schema.
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${ALL_TABLES} RESTART IDENTITY CASCADE`);
  });

  async function createUserFixture(overrides: Partial<User> = {}): Promise<User> {
    return prisma.user.create({
      data: {
        name: "Test User",
        email: `test-${Math.random().toString(36).slice(2, 10)}@bagietka.pl`,
        role: "REPORTER",
        isActive: true,
        passwordHash: "salt:hash",
        mustChangePassword: false,
        ...overrides
      }
    });
  }

  async function createCategoryFixture(): Promise<Category> {
    return prisma.category.create({
      data: {
        name: "Integration category",
        defaultPriority: "NORMAL",
        isActive: true
      }
    });
  }

  it("generates sequential IT ticket numbers and manages lifecycle timestamps", async () => {
    const { createTicket, updateTicket } = await import("@/lib/data-store");
    const reporter = await createUserFixture();
    const category = await createCategoryFixture();
    const base = {
      title: "Drukarka nie działa",
      description: "Stanowisko 2 nie drukuje paragonów.",
      blocksWork: false,
      contact: "sklep@bagietka.pl",
      categoryId: category.id,
      reporterId: reporter.id,
      priority: "NORMAL" as const
    };

    const first = await createTicket(base);
    const second = await createTicket({ ...base, title: "Internet wolno działa" });

    expect(first.number).toMatch(/^IT-\d{4}-\d{4}$/);
    expect(second.number).not.toBe(first.number);

    const resolved = await updateTicket({
      ticketId: first.id,
      actorId: reporter.id,
      status: "RESOLVED",
      priority: first.priority
    });
    expect(resolved?.resolvedAt).toBeDefined();

    const reopened = await updateTicket({
      ticketId: first.id,
      actorId: reporter.id,
      status: "IN_PROGRESS",
      priority: first.priority
    });
    expect(reopened?.resolvedAt).toBeNull();

    const closed = await updateTicket({
      ticketId: first.id,
      actorId: reporter.id,
      status: "CLOSED",
      priority: first.priority
    });
    expect(closed?.closedAt).toBeDefined();

    const reopenedAgain = await updateTicket({
      ticketId: first.id,
      actorId: reporter.id,
      status: "IN_PROGRESS",
      priority: first.priority
    });
    expect(reopenedAgain?.closedAt).toBeNull();
  });

  it("hides password hashes from display lookups and records admin audit logs", async () => {
    const { createUser, findUserByEmail, listAdminAuditLogs } = await import("@/lib/data-store");
    const actor = await createUserFixture({ role: "ADMIN" });

    const user = await createUser({
      name: "Jan Kowalski",
      email: "jan.kowalski@bagietka.pl",
      role: "REPORTER",
      isActive: true,
      passwordHash: "salt:hash",
      mustChangePassword: false,
      actorId: actor.id
    });

    expect((await findUserByEmail(user.email))?.passwordHash).toBeUndefined();
    expect((await findUserByEmail(user.email, { includePasswordHash: true }))?.passwordHash).toBe("salt:hash");

    const logs = await listAdminAuditLogs(5);
    expect(logs[0]).toMatchObject({ action: "USER_CREATED", entityId: user.id, actorId: actor.id });
  });

  it("filters internal notes from public comment lists", async () => {
    const { addComment, createTicket, listComments } = await import("@/lib/data-store");
    const reporter = await createUserFixture();
    const agent = await createUserFixture({ role: "AGENT" });
    const category = await createCategoryFixture();
    const ticket = await createTicket({
      title: "Test komentarzy",
      description: "Sprawdzenie widoczności notatek.",
      blocksWork: false,
      contact: reporter.email!,
      categoryId: category.id,
      reporterId: reporter.id,
      priority: "NORMAL"
    });

    await addComment({
      ticketId: ticket.id,
      authorId: agent.id,
      body: "Komentarz publiczny",
      visibility: "PUBLIC"
    });
    await addComment({
      ticketId: ticket.id,
      authorId: agent.id,
      body: "Notatka wewnętrzna",
      visibility: "INTERNAL"
    });

    const publicOnly = await listComments(ticket.id, false);
    const all = await listComments(ticket.id, true);

    expect(publicOnly).toHaveLength(1);
    expect(publicOnly[0]?.body).toBe("Komentarz publiczny");
    expect(all).toHaveLength(2);
  });

  it("links a DayLog entry to exactly one ticket and stays idempotent", async () => {
    const { createDayLogEntry, createTicketWithResult, findDayLogEntry } = await import("@/lib/data-store");
    const admin = await createUserFixture({ role: "ADMIN" });
    const category = await createCategoryFixture();

    const entry = await createDayLogEntry({
      occurredAt: "2026-08-10T08:30:00.000Z",
      fromName: "Sklep Warszawa",
      subject: "Awaria drukarki",
      description: "Drukarka nie drukuje etykiet od rana.",
      createdById: admin.id
    });

    const input = {
      title: entry.subject,
      description: entry.description,
      blocksWork: false,
      contact: entry.fromName,
      categoryId: category.id,
      reporterId: admin.id,
      priority: "NORMAL" as const
    };

    const first = await createTicketWithResult({ ...input, dayLogEntryId: entry.id, submissionId: "sub-a" });
    const second = await createTicketWithResult({ ...input, dayLogEntryId: entry.id, submissionId: "sub-b" });
    const linked = await findDayLogEntry(entry.id);

    expect(first.created).toBe(true);
    expect(second).toEqual({ ticket: first.ticket, created: false });
    expect(linked).toMatchObject({ ticketId: first.ticket.id, ticketNumber: first.ticket.number });
    expect((await prisma.ticket.count({ where: { id: first.ticket.id } }))).toBe(1);
  });

  it("stores weekly schedule tasks and restricts duties to weekends", async () => {
    const { createScheduleTask, getWeeklySchedule, setScheduleDuty, updateUserAdmin } = await import("@/lib/data-store");
    const admin = await createUserFixture({ role: "ADMIN" });

    await updateUserAdmin({
      userId: admin.id,
      role: "ADMIN",
      department: "IT",
      isActive: true,
      isScheduleMember: true,
      scheduleOrder: 1,
      actorId: admin.id
    });

    const task = await createScheduleTask({
      date: "2026-08-15",
      title: "Sprawdzenie kopii zapasowych",
      description: "Dyżur sobotni",
      assigneeId: admin.id,
      actorId: admin.id
    });
    const duty = await setScheduleDuty({
      date: "2026-08-16",
      assigneeId: admin.id,
      isOnCall: true,
      actorId: admin.id
    });

    await expect(
      setScheduleDuty({
        date: "2026-08-10",
        assigneeId: admin.id,
        isOnCall: true,
        actorId: admin.id
      })
    ).rejects.toThrow("Dyżur można ustawić tylko w sobotę lub niedzielę.");

    const schedule = await getWeeklySchedule("2026-08-10");
    expect(schedule.members).toHaveLength(1);
    expect(schedule.members[0]).toMatchObject({ id: admin.id, isScheduleMember: true, scheduleOrder: 1 });
    expect(schedule.tasks).toEqual([task]);
    expect(schedule.duties).toEqual([duty]);
  });
});
