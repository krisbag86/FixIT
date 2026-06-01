"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { addComment, createTicket, findTicket, readDatabase, updateTicket } from "@/lib/data-store";
import { can, canViewTicket } from "@/lib/permissions";
import type { CommentVisibility, TicketPriority, TicketStatus } from "@/lib/types";

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

  revalidatePath("/tickets");
  redirect(`/tickets/${ticket.id}`);
}

export async function updateTicketAction(formData: FormData): Promise<void> {
  const user = await requireUser();

  if (!can(user, "ticket:update")) {
    throw new Error("Brak uprawnien do aktualizacji ticketu.");
  }

  const ticketId = String(formData.get("ticketId") ?? "");
  await updateTicket({
    ticketId,
    actorId: user.id,
    status: String(formData.get("status") ?? "NEW") as TicketStatus,
    priority: String(formData.get("priority") ?? "NORMAL") as TicketPriority,
    assigneeId: String(formData.get("assigneeId") || "") || undefined
  });

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

  await addComment({
    ticketId: ticket.id,
    authorId: user.id,
    body,
    visibility
  });

  revalidatePath(`/tickets/${ticket.id}`);
  revalidatePath(`/admin/tickets/${ticket.id}`);
}
