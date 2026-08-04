import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TicketDetail } from "@/components/ticket-detail";
import { requireUser } from "@/lib/auth";
import { findTicket, getTicketDetailReferences, listAttachments, listComments, listEvents, listMacros, listTemplates } from "@/lib/data-store";
import { canUseAdmin } from "@/lib/permissions";

export default async function AdminTicketDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();

  if (!canUseAdmin(user)) {
    redirect("/tickets");
  }

  const { id } = await params;
  const ticket = await findTicket(id);

  if (!ticket) {
    notFound();
  }

  const [comments, events, attachments, templates, macros] = await Promise.all([
    listComments(ticket.id, true),
    listEvents(ticket.id),
    listAttachments(ticket.id),
    listTemplates(),
    listMacros()
  ]);
  const references = await getTicketDetailReferences({
    ticket,
    userIds: [...comments.map((comment) => comment.authorId), ...events.map((event) => event.actorId ?? "")],
    includeAssignees: true
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
        adminMode
        templates={templates}
        macros={macros}
      />
    </AppShell>
  );
}
