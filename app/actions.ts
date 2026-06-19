"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { addComment, createKnowledgeArticle, createTicket, deleteKnowledgeArticle, findTicket, readDatabase, updateKnowledgeArticle, updateTicket } from "@/lib/data-store";
import { sanitizeText } from "@/lib/escape-html";
import { notifyCommentAdded, notifyTicketCreated, notifyTicketUpdated } from "@/lib/notifications";
import { can, canViewTicket } from "@/lib/permissions";
import type { CommentVisibility, TicketPriority, TicketStatus } from "@/lib/types";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limiter";

async function enforceMutationRateLimit(userId: string): Promise<void> {
  const rateCheck = await checkRateLimit(`mutation:${userId}`, RATE_LIMITS.MUTATION.windowMs, RATE_LIMITS.MUTATION.maxAttempts);
  if (!rateCheck.allowed) {
    throw new Error("Zbyt wiele żądań. Spróbuj ponownie za kilka sekund.");
  }
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
  await enforceMutationRateLimit(user.id);

  if (!can(user, "ticket:create")) {
    throw new Error("Brak uprawnień do tworzenia zgłoszeń.");
  }

  const database = await readDatabase();
  const categoryId = String(formData.get("categoryId") ?? "");
  const category = database.categories.find((item) => item.id === categoryId);

  const input = ticketSchema.parse({
    categoryId,
    title: sanitizeText(String(formData.get("title") ?? "")),
    description: sanitizeText(String(formData.get("description") ?? "")),
    contact: sanitizeText(String(formData.get("contact") ?? "")),
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

  await notifyTicketCreated(ticket, user);

  revalidatePath("/tickets");
  redirect(`/tickets/${ticket.id}`);
}

export async function updateTicketAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await enforceMutationRateLimit(user.id);

  if (!can(user, "ticket:update")) {
    throw new Error("Brak uprawnień do aktualizacji zgłoszenia.");
  }

  const ticketId = String(formData.get("ticketId") ?? "");
  const newStatus = String(formData.get("status") ?? "NEW") as TicketStatus;
  const newPriority = String(formData.get("priority") ?? "NORMAL") as TicketPriority;
  const newAssigneeId = String(formData.get("assigneeId") || "") || undefined;

  const oldTicket = await findTicket(ticketId);

  if (!oldTicket || !canViewTicket(user, oldTicket)) {
    throw new Error("Brak dostępu do zgłoszenia.");
  }

  const updatedTicket = await updateTicket({
    ticketId,
    actorId: user.id,
    status: newStatus,
    priority: newPriority,
    assigneeId: newAssigneeId
  });

  if (updatedTicket) {
    await notifyTicketUpdated({ before: oldTicket, after: updatedTicket, actorId: user.id });
  }

  revalidatePath("/tickets");
  revalidatePath("/admin/tickets");
}

export async function addCommentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await enforceMutationRateLimit(user.id);
  const ticketId = String(formData.get("ticketId") ?? "");
  const ticket = await findTicket(ticketId);

  if (!ticket || !canViewTicket(user, ticket)) {
    throw new Error("Brak dostępu do zgłoszenia.");
  }

  const visibility = String(formData.get("visibility") ?? "PUBLIC") as CommentVisibility;

  if (visibility === "INTERNAL" && !can(user, "comment:internal")) {
    throw new Error("Brak uprawnień do notatek wewnętrznych.");
  }

  const body = sanitizeText(String(formData.get("body") ?? ""));

  if (body.length < 2) {
    throw new Error("Komentarz jest za krótki.");
  }

  if (body.length > 5000) {
    throw new Error("Komentarz jest za długi (maks. 5000 znaków).");
  }

  const comment = await addComment({
    ticketId: ticket.id,
    authorId: user.id,
    body,
    visibility
  });

  if (comment && visibility === "PUBLIC") {
    await notifyCommentAdded({ ticket, comment, authorId: user.id });
  }

  revalidatePath(`/tickets/${ticket.id}`);
  revalidatePath(`/admin/tickets/${ticket.id}`);
}

const knowledgeSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().min(3).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  body: z.string().min(10).max(30000),
  categoryId: z.string().optional(),
  isPublished: z.boolean()
});

export async function createKnowledgeArticleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await enforceMutationRateLimit(user.id);

  if (!can(user, "admin:manage-faq")) {
    throw new Error("Brak uprawnień do zarządzania bazą wiedzy.");
  }

  const input = knowledgeSchema.parse({
    title: sanitizeText(String(formData.get("title") ?? "")),
    slug: String(formData.get("slug") ?? ""),
    body: sanitizeText(String(formData.get("body") ?? "")),
    categoryId: String(formData.get("categoryId") || "") || undefined,
    isPublished: formData.get("isPublished") === "on"
  });

  await createKnowledgeArticle({ ...input, createdById: user.id, actorId: user.id });

  revalidatePath("/knowledge");
  revalidatePath("/admin/knowledge");
  redirect("/admin/knowledge");
}

export async function updateKnowledgeArticleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await enforceMutationRateLimit(user.id);

  if (!can(user, "admin:manage-faq")) {
    throw new Error("Brak uprawnień do zarządzania bazą wiedzy.");
  }

  const id = String(formData.get("id") ?? "");

  const input = knowledgeSchema.parse({
    title: sanitizeText(String(formData.get("title") ?? "")),
    slug: String(formData.get("slug") ?? ""),
    body: sanitizeText(String(formData.get("body") ?? "")),
    categoryId: String(formData.get("categoryId") || "") || undefined,
    isPublished: formData.get("isPublished") === "on"
  });

  await updateKnowledgeArticle({ ...input, id, updatedById: user.id, actorId: user.id });

  revalidatePath("/knowledge");
  revalidatePath("/admin/knowledge");
  redirect("/admin/knowledge");
}

export async function deleteKnowledgeArticleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await enforceMutationRateLimit(user.id);

  if (!can(user, "admin:manage-faq")) {
    throw new Error("Brak uprawnień do zarządzania bazą wiedzy.");
  }

  const id = String(formData.get("id") ?? "");
  await deleteKnowledgeArticle(id, user.id);

  revalidatePath("/knowledge");
  revalidatePath("/admin/knowledge");
}
