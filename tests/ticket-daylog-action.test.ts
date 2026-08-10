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

const ticket: Ticket = {
  id: "ticket_daylog",
  number: "IT-2026-0002",
  title: "Awaria drukarki",
  description: "Drukarka nie drukuje etykiet od rana.",
  status: "NEW",
  priority: "NORMAL",
  blocksWork: false,
  contact: "Sklep Warszawa",
  categoryId: "cat_printer",
  reporterId: admin.id,
  createdAt: "2026-08-10T08:30:00.000Z",
  updatedAt: "2026-08-10T08:30:00.000Z"
};

function makeForm(): FormData {
  const formData = new FormData();
  formData.set("categoryId", ticket.categoryId);
  formData.set("title", ticket.title);
  formData.set("description", ticket.description);
  formData.set("contact", ticket.contact);
  formData.set("priority", ticket.priority);
  formData.set("submissionId", "4f6d9e62-c7e5-4c9b-a0a8-8c6c1e72a5e4");
  formData.set("dayLogEntryId", "daylog_1");
  return formData;
}

describe("createTicketAction from DayLog", () => {
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

  function installMocks(user: User) {
    const createTicketWithResult = vi.fn(async () => ({ ticket, created: true }));
    const revalidatePath = vi.fn();
    const redirect = vi.fn((url: string): never => {
      throw new Error(`REDIRECT:${url}`);
    });

    vi.doMock("@/lib/auth", () => ({ requireUser: vi.fn(async () => user) }));
    vi.doMock("@/lib/data-store", () => ({
      addComment: vi.fn(),
      createKnowledgeArticle: vi.fn(),
      createTicketWithResult,
      deleteKnowledgeArticle: vi.fn(),
      findCategoryById: vi.fn(async () => ({ id: "cat_printer", defaultPriority: "NORMAL" })),
      findTicket: vi.fn(),
      updateKnowledgeArticle: vi.fn(),
      updateTicket: vi.fn()
    }));
    vi.doMock("@/lib/notifications", () => ({
      notifyCommentAdded: vi.fn(),
      notifyTicketCreated: vi.fn(),
      notifyTicketUpdated: vi.fn()
    }));
    vi.doMock("@/lib/permissions", async (importOriginal) => {
      const original = await importOriginal<typeof import("@/lib/permissions")>();
      return original;
    });
    vi.doMock("@/lib/rate-limiter", () => ({
      checkRateLimit: vi.fn(async () => ({ allowed: true })),
      RATE_LIMITS: { MUTATION: { windowMs: 60_000, maxAttempts: 20 } }
    }));
    vi.doMock("next/cache", () => ({ revalidatePath }));
    vi.doMock("next/navigation", () => ({ redirect }));

    return { createTicketWithResult, revalidatePath };
  }

  it("forwards the source entry and refreshes DayLog", async () => {
    const { createTicketWithResult, revalidatePath } = installMocks(admin);
    const { createTicketAction } = await import("@/app/actions");

    await expect(createTicketAction(makeForm())).rejects.toThrow("REDIRECT:/tickets/ticket_daylog");

    expect(createTicketWithResult).toHaveBeenCalledWith(expect.objectContaining({ dayLogEntryId: "daylog_1" }));
    expect(revalidatePath).toHaveBeenCalledWith("/admin/daylog");
  });

  it("rejects a forged DayLog source from a reporter", async () => {
    const reporter: User = { ...admin, id: "usr_reporter", role: "REPORTER" };
    const { createTicketWithResult } = installMocks(reporter);
    const { createTicketAction } = await import("@/app/actions");

    await expect(createTicketAction(makeForm())).rejects.toThrow("Brak uprawnień do tworzenia zgłoszeń z DayLog.");
    expect(createTicketWithResult).not.toHaveBeenCalled();
  });
});
