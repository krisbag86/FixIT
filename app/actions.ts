"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { addComment, createKnowledgeArticle, createTicketWithResult, deleteKnowledgeArticle, findCategoryById, findTicket, updateKnowledgeArticle, updateTicket } from "@/lib/data-store";
import { sanitizeText } from "@/lib/escape-html";
import { notifyCommentAdded, notifyTicketCreated, notifyTicketUpdated } from "@/lib/notifications";
import { can, canViewTicket } from "@/lib/permissions";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limiter";
import { isRequesterPortalUser } from "@/lib/requester-portal";

const ticketStatusSchema = z.enum([
  "NEW",
  "TRIAGED",
  "IN_PROGRESS",
  "WAITING_FOR_USER",
  "WAITING_FOR_VENDOR",
  "RESOLVED",
  "CLOSED",
  "CANCELLED"
]);
const ticketPrioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]);
const commentVisibilitySchema = z.enum(["PUBLIC", "INTERNAL"]);

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function optionalFormString(formData: FormData, name: string): string | undefined {
  const value = formString(formData, name).trim();
  return value || undefined;
}

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
  priority: ticketPrioritySchema,
  submissionId: z.string().uuid(),
  dayLogEntryId: z.string().min(1).optional()
});

const updateTicketSchema = z.object({
  ticketId: z.string().min(1),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema,
  assigneeId: z.string().min(1).optional()
});

const commentSchema = z.object({
  ticketId: z.string().min(1),
  visibility: commentVisibilitySchema,
  body: z.string().min(2, "Komentarz jest za krótki.").max(5000, "Komentarz jest za długi (maks. 5000 znaków).")
});

export async function createTicketAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await enforceMutationRateLimit(user.id);

  if (!can(user, "ticket:create")) {
    throw new Error("Brak uprawnień do tworzenia zgłoszeń.");
  }

  const dayLogEntryId = optionalFormString(formData, "dayLogEntryId");
  if (dayLogEntryId && !can(user, "ticket:view-all")) {
    throw new Error("Brak uprawnień do tworzenia zgłoszeń z DayLog.");
  }

  const categoryId = formString(formData, "categoryId");
  const category = await findCategoryById(categoryId);
  const requesterPortal = isRequesterPortalUser(user);
  const submittedContact = optionalFormString(formData, "contact");

  const input = ticketSchema.parse({
    categoryId,
    title: sanitizeText(formString(formData, "title")),
    description: sanitizeText(formString(formData, "description")),
    contact: sanitizeText(submittedContact ?? (requesterPortal ? user.email : "")),
    storeId: requesterPortal ? user.storeId ?? "" : optionalFormString(formData, "storeId") ?? user.storeId ?? "",
    department: requesterPortal ? user.department ?? "" : optionalFormString(formData, "department") ?? user.department ?? "",
    blocksWork: requesterPortal ? false : formData.get("blocksWork") === "on",
    priority: requesterPortal ? category?.defaultPriority || "NORMAL" : formString(formData, "priority") || category?.defaultPriority || "NORMAL",
    submissionId: formString(formData, "submissionId"),
    dayLogEntryId
  });

  const result = await createTicketWithResult({
    ...input,
    storeId: input.storeId || undefined,
    department: input.department || undefined,
    reporterId: user.id
  });

  if (result.created) {
    await notifyTicketCreated(result.ticket, user);
  }

  revalidatePath("/tickets");
  if (input.dayLogEntryId) {
    revalidatePath("/admin/daylog");
  }
  redirect(`/tickets/${result.ticket.id}`);
}

export async function updateTicketAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await enforceMutationRateLimit(user.id);

  if (!can(user, "ticket:update")) {
    throw new Error("Brak uprawnień do aktualizacji zgłoszenia.");
  }

  const input = updateTicketSchema.parse({
    ticketId: formString(formData, "ticketId"),
    status: formString(formData, "status") || "NEW",
    priority: formString(formData, "priority") || "NORMAL",
    assigneeId: optionalFormString(formData, "assigneeId")
  });

  const oldTicket = await findTicket(input.ticketId);

  if (!oldTicket || !canViewTicket(user, oldTicket)) {
    throw new Error("Brak dostępu do zgłoszenia.");
  }

  const updatedTicket = await updateTicket({
    ticketId: oldTicket.id,
    actorId: user.id,
    status: input.status,
    priority: input.priority,
    assigneeId: input.assigneeId
  });

  if (updatedTicket) {
    await notifyTicketUpdated({ before: oldTicket, after: updatedTicket, actorId: user.id });
  }

  revalidatePath("/tickets");
  revalidatePath("/admin/tickets");
}

export async function confirmTicketResolutionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await enforceMutationRateLimit(user.id);

  if (!can(user, "ticket:confirm-resolution")) {
    throw new Error("Brak uprawnień do potwierdzenia rozwiązania zgłoszenia.");
  }

  const ticketId = formString(formData, "ticketId");
  const ticket = await findTicket(ticketId);

  if (!ticket || ticket.status !== "RESOLVED" || !canViewTicket(user, ticket)) {
    throw new Error("Można potwierdzić tylko widoczne zgłoszenie ze statusem Rozwiązane.");
  }

  const updatedTicket = await updateTicket({
    ticketId: ticket.id,
    actorId: user.id,
    status: "CLOSED",
    priority: ticket.priority,
    assigneeId: ticket.assigneeId
  });

  if (updatedTicket) {
    await notifyTicketUpdated({ before: ticket, after: updatedTicket, actorId: user.id });
  }

  revalidatePath(`/tickets/${ticket.id}`);
  revalidatePath("/tickets");
  revalidatePath("/admin/tickets");
}

export async function addCommentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await enforceMutationRateLimit(user.id);
  const rawInput = {
    ticketId: formString(formData, "ticketId"),
    visibility: formString(formData, "visibility") || "PUBLIC",
    body: sanitizeText(formString(formData, "body"))
  };
  const input = commentSchema.parse(rawInput);
  const ticket = await findTicket(input.ticketId);

  if (!ticket || !canViewTicket(user, ticket)) {
    throw new Error("Brak dostępu do zgłoszenia.");
  }

  const visibility = isRequesterPortalUser(user) ? "PUBLIC" : input.visibility;

  if (visibility === "INTERNAL" && !can(user, "comment:internal")) {
    throw new Error("Brak uprawnień do notatek wewnętrznych.");
  }

  const comment = await addComment({
    ticketId: ticket.id,
    authorId: user.id,
    body: input.body,
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
    title: sanitizeText(formString(formData, "title")),
    slug: formString(formData, "slug"),
    body: sanitizeText(formString(formData, "body")),
    categoryId: optionalFormString(formData, "categoryId"),
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

  const id = formString(formData, "id");

  const input = knowledgeSchema.parse({
    title: sanitizeText(formString(formData, "title")),
    slug: formString(formData, "slug"),
    body: sanitizeText(formString(formData, "body")),
    categoryId: optionalFormString(formData, "categoryId"),
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

  const id = formString(formData, "id");
  await deleteKnowledgeArticle(id, user.id);

  revalidatePath("/knowledge");
  revalidatePath("/admin/knowledge");
}
