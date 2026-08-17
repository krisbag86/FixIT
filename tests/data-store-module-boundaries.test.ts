import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("ticket data-store module", () => {
  it("exports the ticket read and write API", async () => {
    const ticketStore = await import("@/lib/data-store-tickets");

    expect(ticketStore.findTicket).toBeTypeOf("function");
    expect(ticketStore.createTicketWithResult).toBeTypeOf("function");
    expect(ticketStore.listVisibleTicketsPage).toBeTypeOf("function");
  });
});

describe("admin data-store module", () => {
  it("exports the admin CRUD API", async () => {
    const adminStore = await import("@/lib/data-store-admin");

    expect(adminStore.createUser).toBeTypeOf("function");
    expect(adminStore.updateStoreAdmin).toBeTypeOf("function");
    expect(adminStore.deleteCategoryAdmin).toBeTypeOf("function");
  });
});
