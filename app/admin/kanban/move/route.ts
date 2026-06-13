import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { findTicket, updateTicket } from "@/lib/data-store";
import { can, canViewTicket } from "@/lib/permissions";
import type { TicketStatus } from "@/lib/types";

export async function POST(request: Request): Promise<Response> {
  const user = await requireUser();

  if (!can(user, "ticket:update")) {
    return new Response("Brak uprawnień.", { status: 403 });
  }

  const fd = await request.formData();
  const ticketId = String(fd.get("ticketId") ?? "");
  const newStatus = String(fd.get("status") ?? "") as TicketStatus;

  if (!ticketId || !newStatus) {
    return new Response("Brak wymaganych pól (ticketId, status).", { status: 400 });
  }

  const validStatuses: TicketStatus[] = [
    "NEW",
    "TRIAGED",
    "IN_PROGRESS",
    "WAITING_FOR_USER",
    "WAITING_FOR_VENDOR",
    "RESOLVED",
    "CLOSED",
    "CANCELLED"
  ];

  if (!validStatuses.includes(newStatus)) {
    return new Response("Nieprawidłowy status.", { status: 400 });
  }

  const ticket = await findTicket(ticketId);
  if (!ticket) {
    return new Response("Zgłoszenie nie istnieje.", { status: 404 });
  }

  if (!canViewTicket(user, ticket)) {
    return new Response("Brak dostępu do zgłoszenia.", { status: 403 });
  }

  await updateTicket({
    ticketId,
    actorId: user.id,
    status: newStatus,
    priority: ticket.priority,
    assigneeId: ticket.assigneeId
  });

  revalidatePath("/admin/kanban");
  revalidatePath("/admin/tickets");

  return new Response(null, { status: 204 });
}
