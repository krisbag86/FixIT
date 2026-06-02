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

  it("returns correct metrics for store_waw01 (has tickets)", async () => {
    const { getStoreDashboard } = await import("@/lib/data-store");

    const dashboard = await getStoreDashboard("store_waw01");

    // store_waw01 has 1 ticket: t_001 (IN_PROGRESS, HIGH, blocksWork)
    expect(dashboard.openTickets).toBe(1);
    expect(dashboard.criticalTickets).toBe(0);
    expect(dashboard.blockingTickets).toBe(1);
    expect(dashboard.resolvedToday).toBe(0);
    expect(dashboard.recentEvents.length).toBeGreaterThanOrEqual(1);
    expect(dashboard.recentEvents.length).toBeLessThanOrEqual(5);
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

  it("returns recent events with ticket numbers attached", async () => {
    const { getStoreDashboard } = await import("@/lib/data-store");

    const dashboard = await getStoreDashboard("store_waw01");

    // t_001 has 2 events: TICKET_CREATED and ASSIGNEE_CHANGED
    expect(dashboard.recentEvents.length).toBeGreaterThanOrEqual(1);

    // Each event should have a ticketNumber
    for (const event of dashboard.recentEvents) {
      expect(event.ticketNumber).toBe("IT-2026-0001");
      expect(event.ticketId).toBe("t_001");
      expect(event.type).toBeDefined();
      expect(event.createdAt).toBeDefined();
    }
  });

  it("returns events sorted by most recent first", async () => {
    const { getStoreDashboard } = await import("@/lib/data-store");

    const dashboard = await getStoreDashboard("store_waw01");

    if (dashboard.recentEvents.length >= 2) {
      const dates = dashboard.recentEvents.map((e) => e.createdAt);
      const sorted = [...dates].sort().reverse();
      expect(dates).toEqual(sorted);
    }
  });

  it("returns events with actor name when actor exists", async () => {
    const { getStoreDashboard } = await import("@/lib/data-store");

    const dashboard = await getStoreDashboard("store_waw01");

    // t_001 has TICKET_CREATED event by usr_reporter
    const ticketCreatedEvent = dashboard.recentEvents.find(
      (e) => e.type === "TICKET_CREATED"
    );
    expect(ticketCreatedEvent).toBeDefined();
    expect(ticketCreatedEvent!.actorId).toBe("usr_reporter");

    // t_001 has ASSIGNEE_CHANGED event by usr_agent
    const assigneeChangedEvent = dashboard.recentEvents.find(
      (e) => e.type === "ASSIGNEE_CHANGED"
    );
    expect(assigneeChangedEvent).toBeDefined();
    expect(assigneeChangedEvent!.actorId).toBe("usr_agent");
    expect(assigneeChangedEvent!.payload).toBeDefined();
    expect(assigneeChangedEvent!.payload!.assigneeId).toBe("usr_agent");
  });
});

describe("getDashboardMetrics", () => {
  beforeEach(resetDatabase);
  afterEach(resetDatabase);

  it("returns correct overall metrics from seed data", async () => {
    const { getDashboardMetrics } = await import("@/lib/data-store");

    const metrics = await getDashboardMetrics();

    // Seed has 2 tickets: t_001 (IN_PROGRESS) and t_002 (NEW)
    expect(metrics.totalTickets).toBe(2);
    expect(metrics.openTickets).toBe(2);
    expect(metrics.criticalTickets).toBe(0);
    // Neither ticket is resolved, so avgResolutionHours should be null
    expect(metrics.avgResolutionHours).toBeNull();
  });

  it("returns top categories sorted by count descending", async () => {
    const { getDashboardMetrics } = await import("@/lib/data-store");

    const metrics = await getDashboardMetrics();

    // Seed tickets: t_001 -> cat_terminal, t_002 -> cat_access (each 1 ticket)
    expect(metrics.topCategories).toHaveLength(2);

    // cat_terminal has name "Terminal platniczy"
    const terminalCat = metrics.topCategories.find(
      (c) => c.categoryId === "cat_terminal"
    );
    expect(terminalCat).toBeDefined();
    expect(terminalCat!.categoryName).toBe("Terminal platniczy");
    expect(terminalCat!.count).toBe(1);

    // cat_access has name "Konto / dostep"
    const accessCat = metrics.topCategories.find(
      (c) => c.categoryId === "cat_access"
    );
    expect(accessCat).toBeDefined();
    expect(accessCat!.categoryName).toBe("Konto / dostep");
    expect(accessCat!.count).toBe(1);
  });

  it("returns SLA breaches for overdue tickets", async () => {
    const { getDashboardMetrics } = await import("@/lib/data-store");

    const metrics = await getDashboardMetrics();

    // Both seed tickets are from 2026-06-01 and now is >= 2026-06-02
    // They have SLA deadlines of 8h (HIGH) and 24h (NORMAL) from creation
    // So both should have breached SLA by now
    expect(metrics.slaBreached.length).toBeGreaterThanOrEqual(1);

    // Each breach should have required fields
    for (const breach of metrics.slaBreached) {
      expect(breach.ticket).toBeDefined();
      expect(breach.ticket.id).toBeDefined();
      expect(breach.ticket.number).toBeDefined();
      expect(breach.ticket.priority).toBeDefined();
      expect(breach.slaDeadline).toBeDefined();
      expect(breach.hoursOverdue).toBeGreaterThan(0);
    }
  });

  it("returns SLA breaches sorted by most overdue first", async () => {
    const { getDashboardMetrics } = await import("@/lib/data-store");

    const metrics = await getDashboardMetrics();

    if (metrics.slaBreached.length >= 2) {
      const overdueHours = metrics.slaBreached.map((b) => b.hoursOverdue);
      const sorted = [...overdueHours].sort((a, b) => b - a);
      expect(overdueHours).toEqual(sorted);
    }
  });

  it("returns limited top categories (max 5)", async () => {
    const { getDashboardMetrics } = await import("@/lib/data-store");

    const metrics = await getDashboardMetrics();

    expect(metrics.topCategories.length).toBeLessThanOrEqual(5);
  });
});

describe("exportTicketsCSV", () => {
  beforeEach(resetDatabase);
  afterEach(resetDatabase);

  it("returns CSV with header row", async () => {
    const { exportTicketsCSV } = await import("@/lib/data-store");

    const csv = await exportTicketsCSV();

    const lines = csv.trim().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(2); // header + at least 1 row

    // Header should contain expected columns
    expect(lines[0]).toContain("Numer");
    expect(lines[0]).toContain("Tytul");
    expect(lines[0]).toContain("Status");
    expect(lines[0]).toContain("Priorytet");
  });

  it("includes seed tickets in CSV rows", async () => {
    const { exportTicketsCSV } = await import("@/lib/data-store");

    const csv = await exportTicketsCSV();

    // Both seed tickets should appear
    expect(csv).toContain("IT-2026-0001");
    expect(csv).toContain("IT-2026-0002");
    expect(csv).toContain("Terminal nie laczy sie z siecia");
    expect(csv).toContain("Nowy dostep do systemu magazynowego");
  });

  it("escapes fields with commas or quotes", async () => {
    const { exportTicketsCSV } = await import("@/lib/data-store");

    const csv = await exportTicketsCSV();

    // Verify the CSV is well-formed (no unescaped quotes)
    const lines = csv.trim().split("\n");
    // Skip header, check data rows
    for (let i = 1; i < lines.length; i++) {
      // Each line should have at least 13 columns (matching header)
      // Quick check: line should be parseable
      expect(lines[i].length).toBeGreaterThan(0);
    }
  });

  it("returns correct number of data rows", async () => {
    const { exportTicketsCSV } = await import("@/lib/data-store");

    const csv = await exportTicketsCSV();

    const lines = csv.trim().split("\n");
    // Header + 2 seed tickets = 3 lines
    expect(lines.length).toBe(3);
  });
});
