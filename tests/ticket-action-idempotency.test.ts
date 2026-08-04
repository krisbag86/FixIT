import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ticket, User } from "@/lib/types";

vi.mock("server-only", () => ({}));

const admin: User = {
  id: "usr_admin",
  name: "Admin",
  email: "admin@bagietka.pl",
  role: "ADMIN",
  isActive: true
};

const existingTicket: Ticket = {
  id: "ticket_existing",
  number: "IT-2026-0001",
  title: "Drukarka nie działa",
  description: "Drukarka na stanowisku 2 nie drukuje paragonów.",
  status: "NEW",
  priority: "HIGH",
  blocksWork: false,
  contact: "sklep@bagietka.pl",
  categoryId: "cat_printer",
  reporterId: admin.id,
  createdAt: "2026-08-04T12:00:00.000Z",
  updatedAt: "2026-08-04T12:00:00.000Z"
};

function makeForm(): FormData {
  const formData = new FormData();
  formData.set("categoryId", "cat_printer");
  formData.set("title", existingTicket.title);
  formData.set("description", existingTicket.description);
  formData.set("contact", existingTicket.contact);
  formData.set("priority", existingTicket.priority);
  formData.set("submissionId", "4f6d9e62-c7e5-4c9b-a0a8-8c6c1e72a5e1");
  return formData;
}

describe("createTicketAction idempotency", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/auth");
    vi.doUnmock("@/lib/data-store");
    vi.doUnmock("@/lib/notifications");
    vi.doUnmock("@/lib/permissions");
    vi.doUnmock("@/lib/rate-limiter");
    vi.doUnmock("next/cache");
    vi.doUnmock("next/navigation");
  });

  it("redirects to the existing ticket without sending a second notification", async () => {
    const createTicketWithResult = vi.fn(async () => ({ ticket: existingTicket, created: false }));
    const notifyTicketCreated = vi.fn();
    const redirect = vi.fn((url: string): never => {
      throw new Error(`REDIRECT:${url}`);
    });

    vi.doMock("@/lib/auth", () => ({ requireUser: vi.fn(async () => admin) }));
    vi.doMock("@/lib/data-store", () => ({
      addComment: vi.fn(),
      createKnowledgeArticle: vi.fn(),
      createTicketWithResult,
      deleteKnowledgeArticle: vi.fn(),
      findCategoryById: vi.fn(async () => ({ id: "cat_printer", defaultPriority: "HIGH" })),
      findTicket: vi.fn(),
      updateKnowledgeArticle: vi.fn(),
      updateTicket: vi.fn()
    }));
    vi.doMock("@/lib/notifications", () => ({
      notifyCommentAdded: vi.fn(),
      notifyTicketCreated,
      notifyTicketUpdated: vi.fn()
    }));
    vi.doMock("@/lib/permissions", () => ({ can: vi.fn(() => true), canViewTicket: vi.fn(() => true) }));
    vi.doMock("@/lib/rate-limiter", () => ({
      checkRateLimit: vi.fn(async () => ({ allowed: true })),
      RATE_LIMITS: { MUTATION: { windowMs: 60_000, maxAttempts: 20 } }
    }));
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
    vi.doMock("next/navigation", () => ({ redirect }));

    const { createTicketAction } = await import("@/app/actions");

    await expect(createTicketAction(makeForm())).rejects.toThrow("REDIRECT:/tickets/ticket_existing");
    expect(createTicketWithResult).toHaveBeenCalledOnce();
    expect(notifyTicketCreated).not.toHaveBeenCalled();
  });
});
