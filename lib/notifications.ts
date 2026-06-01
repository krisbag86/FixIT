import "server-only";

import { logNotification, readDatabase } from "@/lib/data-store";
import { sendEmail } from "@/lib/email";
import {
  magicLinkEmail,
  ticketAssignedEmail,
  ticketCommentEmail,
  ticketCreatedAgentEmail,
  ticketCreatedReporterEmail,
  ticketResolvedEmail,
  type RenderedEmail
} from "@/lib/email-templates";
import type { Ticket, User } from "@/lib/types";

async function dispatch(input: {
  to: string;
  type: string;
  ticketId?: string;
  email: RenderedEmail;
}): Promise<void> {
  if (!input.to) {
    return;
  }

  const result = await sendEmail({
    to: input.to,
    subject: input.email.subject,
    html: input.email.html,
    text: input.email.text
  });

  await logNotification({
    ticketId: input.ticketId,
    recipientEmail: input.to,
    type: input.type,
    status: result.ok ? "SENT" : "FAILED",
    error: result.error
  });
}

function ticketUrl(baseUrl: string, ticket: Ticket, forAgent: boolean): string {
  return `${baseUrl}${forAgent ? "/admin/tickets/" : "/tickets/"}${ticket.id}`;
}

function userById(users: User[], userId?: string): User | undefined {
  return users.find((user) => user.id === userId);
}

export async function sendMagicLink(input: {
  email: string;
  token: string;
  isNewAccount: boolean;
  baseUrl: string;
  ttlMinutes: number;
}): Promise<void> {
  const url = `${input.baseUrl}/auth/verify?token=${encodeURIComponent(input.token)}`;
  const email = magicLinkEmail({ url, ttlMinutes: input.ttlMinutes, isNewAccount: input.isNewAccount });

  await dispatch({
    to: input.email,
    type: input.isNewAccount ? "ACCOUNT_CONFIRMATION" : "LOGIN_LINK",
    email
  });
}

export async function notifyTicketCreated(input: { ticket: Ticket; baseUrl: string }): Promise<void> {
  const database = await readDatabase();
  const reporter = userById(database.users, input.ticket.reporterId);

  if (reporter?.email) {
    await dispatch({
      to: reporter.email,
      type: "TICKET_CREATED",
      ticketId: input.ticket.id,
      email: ticketCreatedReporterEmail({ ticket: input.ticket, url: ticketUrl(input.baseUrl, input.ticket, false) })
    });
  }

  const agents = database.users.filter(
    (user) => user.isActive && (user.role === "AGENT" || user.role === "ADMIN")
  );

  for (const agent of agents) {
    await dispatch({
      to: agent.email,
      type: "TICKET_CREATED_AGENT",
      ticketId: input.ticket.id,
      email: ticketCreatedAgentEmail({
        ticket: input.ticket,
        reporterName: reporter?.name ?? input.ticket.contact,
        url: ticketUrl(input.baseUrl, input.ticket, true)
      })
    });
  }
}

export async function notifyTicketAssigned(input: { ticket: Ticket; baseUrl: string }): Promise<void> {
  const database = await readDatabase();
  const assignee = userById(database.users, input.ticket.assigneeId);

  if (!assignee?.email) {
    return;
  }

  await dispatch({
    to: assignee.email,
    type: "TICKET_ASSIGNED",
    ticketId: input.ticket.id,
    email: ticketAssignedEmail({ ticket: input.ticket, url: ticketUrl(input.baseUrl, input.ticket, true) })
  });
}

export async function notifyTicketResolved(input: { ticket: Ticket; baseUrl: string }): Promise<void> {
  const database = await readDatabase();
  const reporter = userById(database.users, input.ticket.reporterId);

  if (!reporter?.email) {
    return;
  }

  await dispatch({
    to: reporter.email,
    type: "TICKET_RESOLVED",
    ticketId: input.ticket.id,
    email: ticketResolvedEmail({ ticket: input.ticket, url: ticketUrl(input.baseUrl, input.ticket, false) })
  });
}

export async function notifyNewComment(input: {
  ticket: Ticket;
  authorId: string;
  body: string;
  baseUrl: string;
}): Promise<void> {
  const database = await readDatabase();
  const recipientId = input.ticket.reporterId === input.authorId ? input.ticket.assigneeId : input.ticket.reporterId;
  const recipient = userById(database.users, recipientId);
  const author = userById(database.users, input.authorId);

  if (!recipient?.email) {
    return;
  }

  const forAgent = recipient.role === "AGENT" || recipient.role === "ADMIN";

  await dispatch({
    to: recipient.email,
    type: "COMMENT_CREATED",
    ticketId: input.ticket.id,
    email: ticketCommentEmail({
      ticket: input.ticket,
      authorName: author?.name ?? "Uzytkownik",
      body: input.body,
      url: ticketUrl(input.baseUrl, input.ticket, forAgent)
    })
  });
}
