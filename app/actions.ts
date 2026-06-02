"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { addComment, createKnowledgeArticle, createTicket, deleteKnowledgeArticle, findTicket, readDatabase, updateKnowledgeArticle, updateNotificationLog, updateTicket } from "@/lib/data-store";
import { can, canViewTicket } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
import { templateTicketCreated, templateTicketResolved, templateTicketAssigned, templateCommentAdded } from "@/lib/email-templates";
import type { CommentVisibility, Database, TicketPriority, TicketStatus } from "@/lib/types";

function findLatestQueuedNotification(database: Database, input: { ticketId: string; type: string; recipientEmail: string }) {
  return database.notificationLogs
    .filter((log) => log.ticketId === input.ticketId)
    .filter((log) => log.type === input.type)
    .filter((log) => log.recipientEmail === input.recipientEmail)
    .filter((log) => log.status === "QUEUED")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

const ticketSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().min(4).max(120),
  description: z.string().min(10).max(2000),
  contact: z.string().min(3).max(120),
  storeId: z.string().optional(),
  department: z.string().optional(),
  blocksWork: z.boolean(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"])
});

export async function createTicketAction(formData: FormData): Promise<void> {
  const user = await requireUser();

  if (!can(user, "ticket:create")) {
    throw new Error("Brak uprawnien do tworzenia zgloszen.");
  }

  const database = await readDatabase();
  const categoryId = String(formData.get("categoryId") ?? "");
  const category = database.categories.find((item) => item.id === categoryId);

  const input = ticketSchema.parse({
    categoryId,
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    contact: String(formData.get("contact") ?? ""),
    storeId: String(formData.get("storeId") || user.storeId || ""),
    department: String(formData.get("department") || user.department || ""),
    blocksWork: formData.get("blocksWork") === "on",
    priority: String(formData.get("priority") || category?.defaultPriority || "NORMAL")
  });

  const ticket = await createTicket({
    ...input,
    storeId: input.storeId || undefined,
    department: input.department || undefined,
    reporterId: user.id
  });

  // Send email notification (in background, don't block)
  try {
    const db = await readDatabase();
    const reporter = db.users.find((u) => u.id === user.id);
    if (reporter) {
      const template = templateTicketCreated(ticket, reporter);
      const notification = findLatestQueuedNotification(db, {
        ticketId: ticket.id,
        type: "TICKET_CREATED",
        recipientEmail: reporter.email
      });
      void (async () => {
        const ok = await sendEmail({
          to: reporter.email,
          subject: template.subject,
          html: template.html,
          text: template.text
        });
        if (notification) {
          await updateNotificationLog(notification.id, ok ? "SENT" : "FAILED");
        }
      })();
    }
  } catch (error) {
    console.error("Failed to initiate ticket creation email:", error);
    // Don't throw - ticket was already created
  }

  revalidatePath("/tickets");
  redirect(`/tickets/${ticket.id}`);
}

export async function updateTicketAction(formData: FormData): Promise<void> {
  const user = await requireUser();

  if (!can(user, "ticket:update")) {
    throw new Error("Brak uprawnien do aktualizacji ticketu.");
  }

  const ticketId = String(formData.get("ticketId") ?? "");
  const newStatus = String(formData.get("status") ?? "NEW") as TicketStatus;
  const newPriority = String(formData.get("priority") ?? "NORMAL") as TicketPriority;
  const newAssigneeId = String(formData.get("assigneeId") || "") || undefined;

  const oldTicket = await findTicket(ticketId);

  const updatedTicket = await updateTicket({
    ticketId,
    actorId: user.id,
    status: newStatus,
    priority: newPriority,
    assigneeId: newAssigneeId
  });

  // Send email notifications for status changes
  if (updatedTicket && oldTicket) {
    try {
      // If status changed to RESOLVED, send email to reporter (in background)
      if (oldTicket.status !== "RESOLVED" && newStatus === "RESOLVED") {
        const db = await readDatabase();
        const resolver = db.users.find((u) => u.id === user.id);
        const recipient = db.users.find((u) => u.id === oldTicket.reporterId);

        if (resolver && recipient) {
          const template = templateTicketResolved(updatedTicket, resolver);
          const notification = findLatestQueuedNotification(db, {
            ticketId: updatedTicket.id,
            type: "TICKET_RESOLVED",
            recipientEmail: recipient.email
          });
          void (async () => {
            const ok = await sendEmail({
              to: recipient.email,
              subject: template.subject,
              html: template.html,
              text: template.text
            });
            if (notification) {
              await updateNotificationLog(notification.id, ok ? "SENT" : "FAILED");
            }
          })();
        }
      }

      // If assignee changed, send email to new assignee (in background)
      if (oldTicket.assigneeId !== newAssigneeId && newAssigneeId) {
        const db = await readDatabase();
        const newAssignee = db.users.find((u) => u.id === newAssigneeId);

        if (newAssignee && updatedTicket) {
          const template = templateTicketAssigned(updatedTicket, newAssignee);
          const notification = findLatestQueuedNotification(db, {
            ticketId: updatedTicket.id,
            type: "TICKET_ASSIGNED",
            recipientEmail: newAssignee.email
          });
          void (async () => {
            const ok = await sendEmail({
              to: newAssignee.email,
              subject: template.subject,
              html: template.html,
              text: template.text
            });
            if (notification) {
              await updateNotificationLog(notification.id, ok ? "SENT" : "FAILED");
            }
          })();
        }
      }
    } catch (error) {
      console.error("Failed to send ticket update email:", error);
      // Don't throw - ticket was already updated
    }
  }

  revalidatePath("/tickets");
  revalidatePath("/admin/tickets");
}

export async function addCommentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") ?? "");
  const ticket = await findTicket(ticketId);

  if (!ticket || !canViewTicket(user, ticket)) {
    throw new Error("Brak dostepu do ticketu.");
  }

  const visibility = String(formData.get("visibility") ?? "PUBLIC") as CommentVisibility;

  if (visibility === "INTERNAL" && !can(user, "comment:internal")) {
    throw new Error("Brak uprawnien do notatek wewnetrznych.");
  }

  const body = String(formData.get("body") ?? "").trim();

  if (body.length < 2) {
    throw new Error("Komentarz jest za krotki.");
  }

  const comment = await addComment({
    ticketId: ticket.id,
    authorId: user.id,
    body,
    visibility
  });

  // Send email notification for public comments (in background, don't block)
  if (comment && visibility === "PUBLIC") {
    try {
      const db = await readDatabase();
      const author = db.users.find((u) => u.id === user.id);
      
      // Determine recipient: if author is reporter, send to assignee; otherwise send to reporter
      const recipientId = ticket.reporterId === user.id ? ticket.assigneeId : ticket.reporterId;
      const recipient = recipientId ? db.users.find((u) => u.id === recipientId) : null;

      if (author && recipient) {
        const template = templateCommentAdded(ticket, comment, author);
        const notification = findLatestQueuedNotification(db, {
          ticketId: ticket.id,
          type: "COMMENT_CREATED",
          recipientEmail: recipient.email
        });
        void (async () => {
          const ok = await sendEmail({
            to: recipient.email,
            subject: template.subject,
            html: template.html,
            text: template.text
          });
          if (notification) {
            await updateNotificationLog(notification.id, ok ? "SENT" : "FAILED");
          }
        })();
      }
    } catch (error) {
      console.error("Failed to initiate comment email:", error);
      // Don't throw - comment was already added
    }
  }

  revalidatePath(`/tickets/${ticket.id}`);
  revalidatePath(`/admin/tickets/${ticket.id}`);
}

const knowledgeSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().min(3).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  body: z.string().min(10).max(10000),
  categoryId: z.string().optional(),
  isPublished: z.boolean()
});

export async function createKnowledgeArticleAction(formData: FormData): Promise<void> {
  const user = await requireUser();

  if (!can(user, "admin:manage-faq")) {
    throw new Error("Brak uprawnien do zarzadzania baza wiedzy.");
  }

  const input = knowledgeSchema.parse({
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    body: String(formData.get("body") ?? ""),
    categoryId: String(formData.get("categoryId") || "") || undefined,
    isPublished: formData.get("isPublished") === "on"
  });

  await createKnowledgeArticle({ ...input, createdById: user.id });

  revalidatePath("/knowledge");
  revalidatePath("/admin/knowledge");
  redirect("/admin/knowledge");
}

export async function updateKnowledgeArticleAction(formData: FormData): Promise<void> {
  const user = await requireUser();

  if (!can(user, "admin:manage-faq")) {
    throw new Error("Brak uprawnien do zarzadzania baza wiedzy.");
  }

  const id = String(formData.get("id") ?? "");

  const input = knowledgeSchema.parse({
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    body: String(formData.get("body") ?? ""),
    categoryId: String(formData.get("categoryId") || "") || undefined,
    isPublished: formData.get("isPublished") === "on"
  });

  await updateKnowledgeArticle({ ...input, id, updatedById: user.id });

  revalidatePath("/knowledge");
  revalidatePath("/admin/knowledge");
  redirect("/admin/knowledge");
}

export async function deleteKnowledgeArticleAction(formData: FormData): Promise<void> {
  const user = await requireUser();

  if (!can(user, "admin:manage-faq")) {
    throw new Error("Brak uprawnien do zarzadzania baza wiedzy.");
  }

  const id = String(formData.get("id") ?? "");
  await deleteKnowledgeArticle(id);

  revalidatePath("/knowledge");
  revalidatePath("/admin/knowledge");
}
