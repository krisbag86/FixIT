import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TicketDetail } from "@/components/ticket-detail";
import { requireUser } from "@/lib/auth";
import { findTicket, getTicketDetailReferences, listAttachments, listComments, listEvents, listMacros, listTemplates } from "@/lib/data-store";
import { canViewTicket } from "@/lib/permissions";

export default async function TicketDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const ticket = await findTicket(id);

  if (!ticket || !canViewTicket(user, ticket)) {
    notFound();
  }

  const includeInternal = user.role === "AGENT" || user.role === "ADMIN";
  const [comments, events, attachments, templates, macros] = await Promise.all([
    listComments(ticket.id, includeInternal),
    listEvents(ticket.id),
    listAttachments(ticket.id),
    listTemplates(),
    listMacros()
  ]);
  const references = await getTicketDetailReferences({
    ticket,
    userIds: [...comments.map((comment) => comment.authorId), ...events.map((event) => event.actorId ?? "")],
    includeAssignees: user.role === "AGENT" || user.role === "ADMIN"
  });

  return (
    <AppShell user={user}>
      <TicketDetail
        currentUser={user}
        ticket={ticket}
        comments={comments}
        events={events}
        attachments={attachments}
        users={references.users}
        categories={references.categories}
        stores={references.stores}
        templates={templates}
        macros={macros}
      />
    </AppShell>
  );
}
