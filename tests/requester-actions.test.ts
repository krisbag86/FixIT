import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ticket, User } from "@/lib/types";

vi.mock("server-only", () => ({}));

const reporter: User = {
  id: "reporter",
  name: "Reporter",
  email: "reporter@bagietka.pl",
  role: "REPORTER",
  storeId: "store_waw01",
  isActive: true
};

const createdTicket: Ticket = {
  id: "ticket_created",
  number: "IT-2026-0001",
  title: "Kasa nie działa",
  description: "Kasa przestała działać.",
  status: "NEW",
  priority: "CRITICAL",
  blocksWork: false,
  contact: reporter.email,
  categoryId: "cat_pos",
  storeId: reporter.storeId,
  reporterId: reporter.id,
  createdAt: "2026-08-17T12:00:00.000Z",
  updatedAt: "2026-08-17T12:00:00.000Z"
};

function makeTicketForm(): FormData {
  const formData = new FormData();
  formData.set("categoryId", "cat_pos");
  formData.set("title", "Kasa nie działa");
  formData.set("description", "Kasa przestała działać.");
  formData.set("contact", "");
  formData.set("priority", "LOW");
  formData.set("storeId", "store_other");
  formData.set("blocksWork", "on");
  formData.set("submissionId", "4f6d9e62-c7e5-4c9b-a0a8-8c6c1e72a5e1");
  return formData;
}

function installMocks() {
  const createTicketWithResult = vi.fn(async () => ({ ticket: createdTicket, created: true }));
  const addComment = vi.fn(async (input: { visibility: string }) => ({ id: "comment_1", ...input }));
  const redirect = vi.fn((url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  });

  vi.doMock("@/lib/auth", () => ({ requireUser: vi.fn(async () => reporter) }));
  vi.doMock("@/lib/data-store", () => ({
    addComment,
    createTicketWithResult,
    findCategoryById: vi.fn(async () => ({ id: "cat_pos", defaultPriority: "CRITICAL" })),
    findTicket: vi.fn(async () => createdTicket)
  }));
  vi.doMock("@/lib/notifications", () => ({
    notifyCommentAdded: vi.fn(),
    notifyTicketCreated: vi.fn(),
    notifyTicketUpdated: vi.fn()
  }));
  vi.doMock("@/lib/permissions", () => ({
    can: vi.fn(() => true),
    canViewTicket: vi.fn(() => true)
  }));
  vi.doMock("@/lib/rate-limiter", () => ({
    checkRateLimit: vi.fn(async () => ({ allowed: true })),
    RATE_LIMITS: { MUTATION: { windowMs: 60_000, maxAttempts: 20 } }
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
  vi.doMock("next/navigation", () => ({ redirect }));

  return { addComment, createTicketWithResult, redirect };
}

describe("requester actions", () => {
  beforeEach(() => vi.resetModules());

  afterEach(() => {
    vi.doUnmock("@/lib/auth");
    vi.doUnmock("@/lib/data-store");
    vi.doUnmock("@/lib/notifications");
    vi.doUnmock("@/lib/permissions");
    vi.doUnmock("@/lib/rate-limiter");
    vi.doUnmock("next/cache");
    vi.doUnmock("next/navigation");
  });

  it("ignores forged technical ticket fields for a reporter", async () => {
    const { createTicketWithResult, redirect } = installMocks();
    const { createTicketAction } = await import("@/app/actions");

    await expect(createTicketAction(makeTicketForm())).rejects.toThrow("REDIRECT:/tickets/ticket_created");
    expect(createTicketWithResult).toHaveBeenCalledWith(expect.objectContaining({
      priority: "CRITICAL",
      blocksWork: false,
      storeId: "store_waw01",
      reporterId: reporter.id
    }));
    expect(redirect).toHaveBeenCalledWith("/tickets/ticket_created");
  });

  it("forces reporter replies to public visibility", async () => {
    const { addComment } = installMocks();
    const { addCommentAction } = await import("@/app/actions");
    const formData = new FormData();
    formData.set("ticketId", createdTicket.id);
    formData.set("body", "To nadal nie działa.");
    formData.set("visibility", "INTERNAL");

    await addCommentAction(formData);

    expect(addComment).toHaveBeenCalledWith(expect.objectContaining({
      ticketId: createdTicket.id,
      authorId: reporter.id,
      visibility: "PUBLIC"
    }));
  });
});
