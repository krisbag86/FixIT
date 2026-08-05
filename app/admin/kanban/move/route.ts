import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { findTicket, updateTicket } from "@/lib/data-store";
import { notifyTicketUpdated } from "@/lib/notifications";
import { can, canViewTicket } from "@/lib/permissions";
import { isTicketStatus } from "@/lib/labels";

export async function POST(request: Request): Promise<Response> {
  const user = await requireUser();

  if (!can(user, "ticket:update")) {
    return new Response("Brak uprawnień.", { status: 403 });
  }

  const fd = await request.formData();
  const ticketId = String(fd.get("ticketId") ?? "");
  const newStatus = String(fd.get("status") ?? "");

  if (!ticketId || !newStatus) {
    return new Response("Brak wymaganych pól (ticketId, status).", { status: 400 });
  }

  if (!isTicketStatus(newStatus)) {
    return new Response("Nieprawidłowy status.", { status: 400 });
  }

  const ticket = await findTicket(ticketId);
  if (!ticket) {
    return new Response("Zgłoszenie nie istnieje.", { status: 404 });
  }

  if (!canViewTicket(user, ticket)) {
    return new Response("Brak dostępu do zgłoszenia.", { status: 403 });
  }

  const updatedTicket = await updateTicket({
    ticketId: ticket.id,
    actorId: user.id,
    status: newStatus,
    priority: ticket.priority,
    assigneeId: ticket.assigneeId
  });

  if (updatedTicket) {
    await notifyTicketUpdated({ before: ticket, after: updatedTicket, actorId: user.id });
  }

  revalidatePath("/admin/kanban");
  revalidatePath("/admin/tickets");

  return new Response(null, { status: 204 });
}
