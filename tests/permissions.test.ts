import { describe, expect, it } from "vitest";
import { can, canUseAdmin, canViewTicket } from "@/lib/permissions";
import type { Ticket, User } from "@/lib/types";

const baseUser: User = {
  id: "u1",
  name: "User",
  email: "user@bagietka.pl",
  role: "REPORTER",
  isActive: true
};

const ticket: Ticket = {
  id: "t1",
  number: "IT-2026-0001",
  title: "Test",
  description: "Description",
  status: "NEW",
  priority: "NORMAL",
  blocksWork: false,
  contact: "123",
  categoryId: "cat",
  storeId: "store1",
  reporterId: "u1",
  createdAt: "2026-06-01T10:00:00.000Z",
  updatedAt: "2026-06-01T10:00:00.000Z"
};

describe("permissions", () => {
  it("keeps reporters out of admin actions", () => {
    expect(can(baseUser, "ticket:create")).toBe(true);
    expect(can(baseUser, "ticket:update")).toBe(false);
    expect(canUseAdmin(baseUser)).toBe(false);
  });

  it("allows agents to manage tickets", () => {
    const agent: User = { ...baseUser, id: "agent", role: "AGENT" };
    expect(can(agent, "ticket:view-all")).toBe(true);
    expect(can(agent, "comment:internal")).toBe(true);
    expect(canUseAdmin(agent)).toBe(true);
  });

  it("limits ticket visibility by role and store", () => {
    const reporter: User = { ...baseUser, id: "other" };
    const manager: User = { ...baseUser, id: "manager", role: "STORE_MANAGER", storeId: "store1" };
    const otherManager: User = { ...manager, storeId: "store2" };

    expect(canViewTicket(baseUser, ticket)).toBe(true);
    expect(canViewTicket(reporter, ticket)).toBe(false);
    expect(canViewTicket(manager, ticket)).toBe(true);
    expect(canViewTicket(otherManager, ticket)).toBe(false);
  });

  it("recomputes permissions and visibility correctly after a role change", () => {
    const promotedAgent: User = { ...baseUser, id: "agent-2", role: "AGENT" };
    const demotedReporter: User = { ...promotedAgent, role: "REPORTER" };
    const managerInStore: User = { ...baseUser, id: "manager-2", role: "STORE_MANAGER", storeId: "store1" };

    expect(can(promotedAgent, "ticket:update")).toBe(true);
    expect(canViewTicket(promotedAgent, ticket)).toBe(true);

    expect(can(demotedReporter, "ticket:update")).toBe(false);
    expect(canViewTicket(demotedReporter, ticket)).toBe(false);

    expect(can(managerInStore, "ticket:view-store")).toBe(true);
    expect(canViewTicket(managerInStore, ticket)).toBe(true);
  });
});
