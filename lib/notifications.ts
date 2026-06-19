import "server-only";

import { readDatabase, updateNotificationLog } from "@/lib/data-store";
import { sendEmailWithResult } from "@/lib/email";
import {
  templateCommentAdded,
  templateTicketAssigned,
  templateTicketCreated,
  templateTicketResolved
} from "@/lib/email-templates";
import type { EmailTemplate } from "@/lib/email-templates";
import { reportError } from "@/lib/sentry";
import type { Database, NotificationLog, Ticket, TicketComment, User } from "@/lib/types";

type TicketNotificationType =
  | "TICKET_CREATED"
  | "TICKET_RESOLVED"
  | "TICKET_ASSIGNED"
  | "COMMENT_CREATED";

function findLatestQueuedNotification(
  database: Database,
  input: { ticketId: string; type: TicketNotificationType; recipientEmail: string }
): NotificationLog | undefined {
  return database.notificationLogs
    .filter((log) => log.ticketId === input.ticketId)
    .filter((log) => log.type === input.type)
    .filter((log) => log.recipientEmail === input.recipientEmail)
    .filter((log) => log.status === "QUEUED")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

async function sendQueuedNotification(input: {
  database: Database;
  ticketId: string;
  type: TicketNotificationType;
  recipientEmail: string;
  template: EmailTemplate;
}): Promise<void> {
  const notification = findLatestQueuedNotification(input.database, {
    ticketId: input.ticketId,
    type: input.type,
    recipientEmail: input.recipientEmail
  });

  if (!notification) {
    console.warn(
      `Skipping ${input.type} email for ticket ${input.ticketId}; no queued notification log for ${input.recipientEmail}.`
    );
    return;
  }

  const result = await sendEmailWithResult({
    to: input.recipientEmail,
    subject: input.template.subject,
    html: input.template.html,
    text: input.template.text
  });

  await updateNotificationLog(notification.id, result.ok ? "SENT" : "FAILED", result.error);
}

async function safelyNotify(
  context: string,
  details: Record<string, string | undefined>,
  sender: () => Promise<void>
): Promise<void> {
  try {
    await sender();
  } catch (error) {
    console.error(`Failed to send ${context} email notification:`, error);
    reportError(error, { context, ...details });
  }
}

export async function notifyTicketCreated(ticket: Ticket, reporter: User): Promise<void> {
  await safelyNotify("notifyTicketCreated", { ticketId: ticket.id }, async () => {
    const database = await readDatabase();
    await sendQueuedNotification({
      database,
      ticketId: ticket.id,
      type: "TICKET_CREATED",
      recipientEmail: reporter.email,
      template: templateTicketCreated(ticket, reporter)
    });
  });
}

export async function notifyTicketUpdated(input: {
  before: Ticket;
  after: Ticket;
  actorId: string;
}): Promise<void> {
  await safelyNotify("notifyTicketUpdated", { ticketId: input.after.id }, async () => {
    const database = await readDatabase();

    if (input.before.status !== "RESOLVED" && input.after.status === "RESOLVED") {
      const resolver = database.users.find((user) => user.id === input.actorId);
      const recipient = database.users.find((user) => user.id === input.before.reporterId);

      if (resolver && recipient) {
        await sendQueuedNotification({
          database,
          ticketId: input.after.id,
          type: "TICKET_RESOLVED",
          recipientEmail: recipient.email,
          template: templateTicketResolved(input.after, resolver)
        });
      }
    }

    if (input.before.assigneeId !== input.after.assigneeId && input.after.assigneeId) {
      const assignee = database.users.find((user) => user.id === input.after.assigneeId);

      if (assignee) {
        await sendQueuedNotification({
          database,
          ticketId: input.after.id,
          type: "TICKET_ASSIGNED",
          recipientEmail: assignee.email,
          template: templateTicketAssigned(input.after, assignee)
        });
      }
    }
  });
}

export async function notifyCommentAdded(input: {
  ticket: Ticket;
  comment: TicketComment;
  authorId: string;
}): Promise<void> {
  await safelyNotify("notifyCommentAdded", { ticketId: input.ticket.id, commentId: input.comment.id }, async () => {
    const database = await readDatabase();
    const author = database.users.find((user) => user.id === input.authorId);
    const recipientId = input.ticket.reporterId === input.authorId ? input.ticket.assigneeId : input.ticket.reporterId;
    const recipient = recipientId ? database.users.find((user) => user.id === recipientId) : undefined;

    if (author && recipient) {
      await sendQueuedNotification({
        database,
        ticketId: input.ticket.id,
        type: "COMMENT_CREATED",
        recipientEmail: recipient.email,
        template: templateCommentAdded(input.ticket, input.comment, author)
      });
    }
  });
}
