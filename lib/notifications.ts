import "server-only";

import { findLatestQueuedNotification, findUsersByIds, updateNotificationLog } from "@/lib/data-store";
import { sendEmailWithResult, type EmailSendResult } from "@/lib/email";
import {
  templateCommentAdded,
  templateTicketAssigned,
  templateTicketCreated,
  templateTicketResolved
} from "@/lib/email-templates";
import type { EmailTemplate } from "@/lib/email-templates";
import { reportError } from "@/lib/sentry";
import type { NotificationLog, Ticket, TicketComment, User } from "@/lib/types";

type TicketNotificationType =
  | "TICKET_CREATED"
  | "TICKET_RESOLVED"
  | "TICKET_ASSIGNED"
  | "COMMENT_CREATED";

export async function sendEmailWithRetry(
  send: () => Promise<EmailSendResult>,
  options?: { maxAttempts?: number; delayMs?: number }
): Promise<EmailSendResult> {
  const maxAttempts = Math.min(Math.max(options?.maxAttempts ?? 3, 1), 5);
  const delayMs = Math.max(options?.delayMs ?? 250, 0);
  let lastResult: EmailSendResult = { ok: false, error: "Email send failed." };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastResult = await send();
    if (lastResult.ok || attempt === maxAttempts) {
      return lastResult;
    }

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return lastResult;
}

async function sendQueuedNotification(input: {
  notification?: NotificationLog;
  ticketId: string;
  type: TicketNotificationType;
  recipientEmail: string;
  template: EmailTemplate;
}): Promise<void> {
  const notification = input.notification ?? await findLatestQueuedNotification({
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

  const result = await sendEmailWithRetry(() =>
    sendEmailWithResult({
      to: input.recipientEmail,
      subject: input.template.subject,
      html: input.template.html,
      text: input.template.text
    })
  );

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
    await sendQueuedNotification({
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
    if (input.before.status !== "RESOLVED" && input.after.status === "RESOLVED") {
      const users = await findUsersByIds([input.actorId, input.before.reporterId], { includeInactive: true });
      const resolverUser = users.find((user) => user.id === input.actorId);
      const recipientUser = users.find((user) => user.id === input.before.reporterId);

      if (resolverUser && recipientUser) {
        await sendQueuedNotification({
          ticketId: input.after.id,
          type: "TICKET_RESOLVED",
          recipientEmail: recipientUser.email,
          template: templateTicketResolved(input.after, resolverUser)
        });
      }
    }

    if (input.before.assigneeId !== input.after.assigneeId && input.after.assigneeId) {
      const [assignee] = await findUsersByIds([input.after.assigneeId]);

      if (assignee) {
        await sendQueuedNotification({
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
    const recipientId = input.ticket.reporterId === input.authorId ? input.ticket.assigneeId : input.ticket.reporterId;
    const users = await findUsersByIds([input.authorId, recipientId ?? ""], { includeInactive: true });
    const author = users.find((user) => user.id === input.authorId);
    const recipient = recipientId ? users.find((user) => user.id === recipientId) : undefined;

    if (author && recipient) {
      await sendQueuedNotification({
        ticketId: input.ticket.id,
        type: "COMMENT_CREATED",
        recipientEmail: recipient.email,
        template: templateCommentAdded(input.ticket, input.comment, author)
      });
    }
  });
}
