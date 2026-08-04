import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationLog, Ticket, TicketComment, User } from "@/lib/types";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  findLatestQueuedNotification: vi.fn(),
  findUsersByIds: vi.fn(),
  updateNotificationLog: vi.fn(),
  sendEmailWithResult: vi.fn(),
  reportError: vi.fn()
}));

vi.mock("@/lib/data-store", () => ({
  findLatestQueuedNotification: mocks.findLatestQueuedNotification,
  findUsersByIds: mocks.findUsersByIds,
  updateNotificationLog: mocks.updateNotificationLog
}));

vi.mock("@/lib/email", () => ({
  sendEmailWithResult: mocks.sendEmailWithResult
}));

vi.mock("@/lib/sentry", () => ({
  reportError: mocks.reportError
}));

const reporter: User = {
  id: "usr_reporter",
  name: "Reporter",
  email: "reporter@bagietka.pl",
  role: "REPORTER",
  isActive: true
};

const agent: User = {
  id: "usr_agent",
  name: "Agent",
  email: "agent@bagietka.pl",
  role: "AGENT",
  isActive: true
};

const ticket: Ticket = {
  id: "t_123",
  number: "IT-2026-0001",
  title: "Nie dziala drukarka",
  description: "Drukarka w sklepie nie odpowiada.",
  status: "IN_PROGRESS",
  priority: "NORMAL",
  blocksWork: false,
  contact: "reporter@bagietka.pl",
  categoryId: "cat_printers",
  reporterId: reporter.id,
  assigneeId: agent.id,
  createdAt: "2026-06-18T10:00:00.000Z",
  updatedAt: "2026-06-18T10:00:00.000Z"
};

const comment: TicketComment = {
  id: "c_123",
  ticketId: ticket.id,
  authorId: agent.id,
  body: "Gotowe, prosze sprawdzic.",
  visibility: "PUBLIC",
  createdAt: "2026-06-18T11:00:00.000Z"
};

function notification(input: {
  id: string;
  type: NotificationLog["type"];
  recipientEmail: string;
}): NotificationLog {
  return {
    id: input.id,
    ticketId: ticket.id,
    recipientEmail: input.recipientEmail,
    type: input.type,
    status: "QUEUED",
    createdAt: "2026-06-18T11:00:00.000Z"
  };
}

describe("ticket email notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUsersByIds.mockImplementation((ids: string[]) =>
      Promise.resolve([reporter, agent].filter((user) => ids.includes(user.id)))
    );
    mocks.sendEmailWithResult.mockResolvedValue({ ok: true });
    mocks.updateNotificationLog.mockResolvedValue(undefined);
  });

  it("sends a resolved ticket notification and marks the queued log as sent", async () => {
    mocks.findLatestQueuedNotification.mockResolvedValue(
      notification({ id: "n_resolved", type: "TICKET_RESOLVED", recipientEmail: reporter.email })
    );

    const { notifyTicketUpdated } = await import("@/lib/notifications");

    await notifyTicketUpdated({
      before: ticket,
      after: { ...ticket, status: "RESOLVED", resolvedAt: "2026-06-18T12:00:00.000Z" },
      actorId: agent.id
    });

    expect(mocks.sendEmailWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        to: reporter.email,
        subject: expect.stringContaining("rozwiązany")
      })
    );
    expect(mocks.updateNotificationLog).toHaveBeenCalledWith("n_resolved", "SENT", undefined);
  });

  it("sends an assignment notification to the new assignee", async () => {
    mocks.findLatestQueuedNotification.mockResolvedValue(
      notification({ id: "n_assigned", type: "TICKET_ASSIGNED", recipientEmail: agent.email })
    );

    const { notifyTicketUpdated } = await import("@/lib/notifications");

    await notifyTicketUpdated({
      before: { ...ticket, assigneeId: undefined },
      after: ticket,
      actorId: reporter.id
    });

    expect(mocks.sendEmailWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        to: agent.email,
        subject: expect.stringContaining("przypisany do Ciebie")
      })
    );
    expect(mocks.updateNotificationLog).toHaveBeenCalledWith("n_assigned", "SENT", undefined);
  });

  it("sends a public comment notification to the ticket reporter", async () => {
    mocks.findLatestQueuedNotification.mockResolvedValue(
      notification({ id: "n_comment", type: "COMMENT_CREATED", recipientEmail: reporter.email })
    );

    const { notifyCommentAdded } = await import("@/lib/notifications");

    await notifyCommentAdded({ ticket, comment, authorId: agent.id });

    expect(mocks.sendEmailWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        to: reporter.email,
        subject: expect.stringContaining("Nowy komentarz")
      })
    );
    expect(mocks.updateNotificationLog).toHaveBeenCalledWith("n_comment", "SENT", undefined);
  });

  it("marks the queued notification as failed when SMTP send fails", async () => {
    mocks.findLatestQueuedNotification.mockResolvedValue(
      notification({ id: "n_created", type: "TICKET_CREATED", recipientEmail: reporter.email })
    );
    mocks.sendEmailWithResult.mockResolvedValue({
      ok: false,
      error: "SMTP configuration incomplete"
    });

    const { notifyTicketCreated } = await import("@/lib/notifications");

    await notifyTicketCreated(ticket, reporter);

    expect(mocks.updateNotificationLog).toHaveBeenCalledWith(
      "n_created",
      "FAILED",
      "SMTP configuration incomplete"
    );
  });
});
