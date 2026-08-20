import { describe, expect, it } from "vitest";
import { getTicketSlaDeadline, getTicketSlaState, isTicketOverdue, matchesTicketFilters, parseTicketListFilters } from "@/lib/ticket-filters";
import type { Ticket } from "@/lib/types";

const baseTicket: Ticket = {
  id: "ticket-1",
  number: "IT-2026-0001",
  title: "Drukarka fiskalna nie działa",
  description: "Stanowisko 2 nie drukuje paragonów.",
  status: "IN_PROGRESS",
  priority: "HIGH",
  blocksWork: false,
  contact: "sklep@bagietka.pl",
  categoryId: "cat_printer",
  storeId: "store_waw01",
  reporterId: "reporter-1",
  assigneeId: "agent-1",
  createdAt: "2026-07-31T08:00:00.000Z",
  updatedAt: "2026-07-31T08:30:00.000Z"
};

describe("ticket list filters", () => {
  it("parses and validates URL filters", () => {
    expect(
      parseTicketListFilters({
        q: "  drukarka ",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assignee: "agent-1",
        store: "store_waw01",
        category: "cat_printer",
        mine: "1",
        overdue: "true",
        archived: "1",
        unassigned: "0"
      })
    ).toEqual({
      query: "drukarka",
      status: "IN_PROGRESS",
      priority: "HIGH",
      assigneeId: "agent-1",
      storeId: "store_waw01",
      categoryId: "cat_printer",
      mine: true,
      overdue: true,
      archived: true
    });
  });

  it("ignores invalid enum values instead of passing them to the data layer", () => {
    expect(parseTicketListFilters({ status: "BROKEN", priority: "URGENT" })).toEqual({});
  });

  it("parses dashboard stage and attention filters and ignores invalid values", () => {
    expect(parseTicketListFilters({ stage: "waiting", attention: "all" })).toEqual({
      stage: "waiting",
      attention: "all"
    });
    expect(parseTicketListFilters({ stage: "broken", attention: "later" })).toEqual({});
  });

  it("lets an exact status override a dashboard stage", () => {
    const filters = parseTicketListFilters({ status: "IN_PROGRESS", stage: "new" });

    expect(matchesTicketFilters({ ...baseTicket, status: "IN_PROGRESS" }, filters)).toBe(true);
    expect(matchesTicketFilters({ ...baseTicket, status: "NEW" }, filters)).toBe(false);
  });

  it("matches grouped stages and deduplicated attention modes", () => {
    const now = new Date("2026-08-20T12:00:00.000Z");

    expect(matchesTicketFilters({ ...baseTicket, status: "WAITING_FOR_USER" }, { stage: "waiting" }, undefined, now)).toBe(true);
    expect(matchesTicketFilters({ ...baseTicket, status: "WAITING_FOR_VENDOR" }, { stage: "waiting" }, undefined, now)).toBe(true);
    expect(matchesTicketFilters({ ...baseTicket, status: "NEW" }, { stage: "waiting" }, undefined, now)).toBe(false);
    expect(matchesTicketFilters({ ...baseTicket, priority: "CRITICAL" }, { attention: "critical" }, undefined, now)).toBe(true);
    expect(matchesTicketFilters(baseTicket, { attention: "overdue" }, undefined, now)).toBe(true);
    expect(matchesTicketFilters({ ...baseTicket, status: "RESOLVED", priority: "CRITICAL" }, { attention: "all" }, undefined, now)).toBe(false);
  });

  it("matches search text across number, title and description", () => {
    expect(matchesTicketFilters(baseTicket, { query: "0001" })).toBe(true);
    expect(matchesTicketFilters(baseTicket, { query: "paragonów" })).toBe(true);
    expect(matchesTicketFilters(baseTicket, { query: "laptop" })).toBe(false);
  });

  it("keeps resolved tickets active and moves closed tickets to the archive", () => {
    expect(matchesTicketFilters({ ...baseTicket, status: "RESOLVED" }, {})).toBe(true);
    expect(matchesTicketFilters({ ...baseTicket, status: "CLOSED" }, {})).toBe(false);
    expect(matchesTicketFilters({ ...baseTicket, status: "CANCELLED" }, {})).toBe(false);
    expect(matchesTicketFilters({ ...baseTicket, status: "RESOLVED" }, { archived: true })).toBe(false);
    expect(matchesTicketFilters({ ...baseTicket, status: "CLOSED" }, { archived: true })).toBe(true);
    expect(matchesTicketFilters({ ...baseTicket, status: "CANCELLED" }, { archived: true })).toBe(true);
  });

  it("matches ownership and assignment filters", () => {
    expect(matchesTicketFilters(baseTicket, { mine: true }, "agent-1")).toBe(true);
    expect(matchesTicketFilters(baseTicket, { mine: true }, "agent-2")).toBe(false);
    expect(matchesTicketFilters({ ...baseTicket, assigneeId: undefined }, { unassigned: true })).toBe(true);
    expect(matchesTicketFilters(baseTicket, { unassigned: true })).toBe(false);
  });

  it("recognizes overdue open tickets and excludes resolved tickets", () => {
    const now = new Date("2026-07-31T17:00:00.000Z");
    expect(isTicketOverdue(baseTicket, now)).toBe(true);
    expect(matchesTicketFilters(baseTicket, { overdue: true }, "agent-1", now)).toBe(true);
    expect(matchesTicketFilters({ ...baseTicket, status: "RESOLVED" }, { overdue: true }, "agent-1", now)).toBe(false);
  });

  it("uses dueAt when present and falls back to the priority deadline for invalid dates", () => {
    const now = new Date("2026-08-20T12:00:00.000Z");

    expect(isTicketOverdue({ ...baseTicket, dueAt: "2026-08-20T11:59:00.000Z" }, now)).toBe(true);
    expect(isTicketOverdue({ ...baseTicket, dueAt: "2026-08-20T12:01:00.000Z" }, now)).toBe(false);
    expect(
      getTicketSlaDeadline({
        ...baseTicket,
        createdAt: "2026-08-20T00:00:00.000Z",
        dueAt: "not-a-date",
        priority: "HIGH"
      }).toISOString()
    ).toBe("2026-08-20T08:00:00.000Z");
  });

  it("classifies SLA as on track, at risk, breached or completed", () => {
    const now = new Date("2026-07-31T12:00:00.000Z");

    expect(getTicketSlaState({ ...baseTicket, createdAt: "2026-07-31T06:00:00.000Z" }, now)).toBe("AT_RISK");
    expect(getTicketSlaState({ ...baseTicket, createdAt: "2026-07-31T04:00:00.000Z" }, now)).toBe("BREACHED");
    expect(getTicketSlaState({ ...baseTicket, createdAt: "2026-07-31T11:00:00.000Z" }, now)).toBe("ON_TRACK");
    expect(getTicketSlaState({ ...baseTicket, status: "CLOSED" }, now)).toBe("COMPLETED");
  });
});
