import { describe, expect, it } from "vitest";
import { isTicketOverdue, matchesTicketFilters, parseTicketListFilters } from "@/lib/ticket-filters";
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
      overdue: true
    });
  });

  it("ignores invalid enum values instead of passing them to the data layer", () => {
    expect(parseTicketListFilters({ status: "BROKEN", priority: "URGENT" })).toEqual({});
  });

  it("matches search text across number, title and description", () => {
    expect(matchesTicketFilters(baseTicket, { query: "0001" })).toBe(true);
    expect(matchesTicketFilters(baseTicket, { query: "paragonów" })).toBe(true);
    expect(matchesTicketFilters(baseTicket, { query: "laptop" })).toBe(false);
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
});
