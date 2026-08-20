import { describe, expect, it } from "vitest";
import {
  buildAgentWorkload,
  buildDashboardAlerts,
  buildDashboardDailyCounts,
  buildDashboardMyQueue,
  buildTopCategories,
  calculateAverageResolutionHours
} from "@/lib/dashboard";
import type { Ticket } from "@/lib/types";

const now = new Date("2026-08-20T12:00:00.000Z");

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "ticket",
    number: "IT-2026-0001",
    title: "Dashboard ticket",
    description: "Fixture used by dashboard domain tests.",
    status: "NEW",
    priority: "NORMAL",
    blocksWork: false,
    contact: "agent@bagietka.pl",
    categoryId: "cat-other",
    reporterId: "reporter",
    createdAt: "2026-08-20T08:00:00.000Z",
    updatedAt: "2026-08-20T08:00:00.000Z",
    ...overrides
  };
}

describe("dashboard domain", () => {
  it("deduplicates and orders critical and overdue alerts", () => {
    const alerts = buildDashboardAlerts([
      makeTicket({ id: "both", priority: "CRITICAL", createdAt: "2026-08-19T00:00:00.000Z" }),
      makeTicket({ id: "critical", priority: "CRITICAL", createdAt: "2026-08-20T11:00:00.000Z" }),
      makeTicket({ id: "overdue", priority: "NORMAL", createdAt: "2026-08-18T00:00:00.000Z" }),
      makeTicket({ id: "done", status: "RESOLVED", priority: "CRITICAL" })
    ], new Map(), now);

    expect(alerts.criticalCount).toBe(2);
    expect(alerts.slaBreachedCount).toBe(2);
    expect(alerts.tickets.map((ticket) => ticket.id)).toEqual(["both", "critical", "overdue"]);
    expect(alerts.tickets[0]).toMatchObject({ isCritical: true, isSlaBreached: true });
  });

  it("limits the shared urgent list without changing total counters", () => {
    const alerts = buildDashboardAlerts(
      Array.from({ length: 7 }, (_, index) => makeTicket({
        id: `critical-${index}`,
        priority: "CRITICAL",
        createdAt: "2026-08-20T11:00:00.000Z"
      })),
      new Map(),
      now
    );

    expect(alerts.criticalCount).toBe(7);
    expect(alerts.slaBreachedCount).toBe(0);
    expect(alerts.tickets).toHaveLength(5);
  });

  it("groups only the current assignee and limits every stage", () => {
    const queue = buildDashboardMyQueue([
      ...Array.from({ length: 7 }, (_, index) => makeTicket({ id: `new-${index}`, assigneeId: "agent", status: "NEW" })),
      makeTicket({ id: "triaged", assigneeId: "agent", status: "TRIAGED" }),
      makeTicket({ id: "waiting-user", assigneeId: "agent", status: "WAITING_FOR_USER" }),
      makeTicket({ id: "waiting-vendor", assigneeId: "agent", status: "WAITING_FOR_VENDOR" }),
      makeTicket({ id: "progress", assigneeId: "agent", status: "IN_PROGRESS" }),
      makeTicket({ id: "other-agent", assigneeId: "other", status: "NEW" })
    ], "agent");

    expect(queue.new.count).toBe(8);
    expect(queue.new.tickets).toHaveLength(5);
    expect(queue.waiting.count).toBe(2);
    expect(queue.in_progress.count).toBe(1);
  });

  it("builds today plus the previous 29 UTC days and scopes resolution time", () => {
    const tickets = [
      makeTicket({ id: "today", createdAt: "2026-08-20T08:00:00.000Z", resolvedAt: "2026-08-20T10:00:00.000Z" }),
      makeTicket({ id: "first-day", createdAt: "2026-07-22T08:00:00.000Z" }),
      makeTicket({ id: "too-old", createdAt: "2026-07-21T08:00:00.000Z", resolvedAt: "2026-07-21T10:00:00.000Z" })
    ];
    const daily = buildDashboardDailyCounts(tickets, now);

    expect(daily).toHaveLength(30);
    expect(daily[0]).toEqual({ date: "2026-07-22", created: 1, resolved: 0 });
    expect(daily[29]).toEqual({ date: "2026-08-20", created: 1, resolved: 1 });
    expect(calculateAverageResolutionHours(tickets, now)).toBe(2);
  });

  it("limits categories and excludes inactive or non-IT users from workload", () => {
    const categoryTickets = Array.from({ length: 9 }, (_, index) =>
      makeTicket({ id: `category-${index}`, categoryId: `cat-${index}` })
    );
    const categories = Array.from({ length: 9 }, (_, index) => ({
      id: `cat-${index}`,
      name: `Kategoria ${index}`
    }));
    expect(buildTopCategories(categoryTickets, categories)).toHaveLength(8);

    const workload = buildAgentWorkload([
      makeTicket({ id: "one", assigneeId: "agent" }),
      makeTicket({ id: "two", assigneeId: "agent" }),
      makeTicket({ id: "three", assigneeId: "admin" }),
      makeTicket({ id: "four", assigneeId: "inactive" }),
      makeTicket({ id: "five", assigneeId: "reporter" })
    ], [
      { id: "agent", name: "Agent", email: "agent@bagietka.pl", role: "AGENT", isActive: true },
      { id: "admin", name: "Admin", email: "admin@bagietka.pl", role: "ADMIN", isActive: true },
      { id: "inactive", name: "Inactive", email: "inactive@bagietka.pl", role: "AGENT", isActive: false },
      { id: "reporter", name: "Reporter", email: "reporter@bagietka.pl", role: "REPORTER", isActive: true }
    ]);
    expect(workload).toEqual([
      { agentId: "agent", agentName: "Agent", openCount: 2 },
      { agentId: "admin", agentName: "Admin", openCount: 1 }
    ]);
  });

  it("returns complete empty aggregates", () => {
    expect(buildDashboardAlerts([], new Map(), now)).toEqual({ criticalCount: 0, slaBreachedCount: 0, tickets: [] });
    expect(buildDashboardMyQueue([], "agent")).toEqual({
      new: { count: 0, tickets: [] },
      waiting: { count: 0, tickets: [] },
      in_progress: { count: 0, tickets: [] }
    });
    const daily = buildDashboardDailyCounts([], now);
    expect(daily).toHaveLength(30);
    expect(daily.every((day) => day.created === 0 && day.resolved === 0)).toBe(true);
    expect(calculateAverageResolutionHours([], now)).toBeNull();
    expect(buildTopCategories([], [])).toEqual([]);
    expect(buildAgentWorkload([], [])).toEqual([]);
  });
});
