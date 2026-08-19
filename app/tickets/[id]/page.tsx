import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TicketDetail } from "@/components/ticket-detail";
import { RequesterTicketDetail } from "@/components/requester/requester-ticket-detail";
import { requireUser } from "@/lib/auth";
import { findTicket, findUsersByIds, getTicketDetailReferences, listAttachments, listComments, listEvents, listMacros, listTemplates } from "@/lib/data-store";
import { canViewTicket } from "@/lib/permissions";
import { isRequesterPortalUser } from "@/lib/requester-portal";

export default async function TicketDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const ticket = await findTicket(id);

  if (!ticket || !canViewTicket(user, ticket)) {
    notFound();
  }

  if (isRequesterPortalUser(user)) {
    const comments = await listComments(ticket.id, false);
    const users = await findUsersByIds([...new Set(comments.map((comment) => comment.authorId))]);

    return (
      <AppShell user={user}>
        <RequesterTicketDetail currentUser={user} ticket={ticket} comments={comments} users={users} />
      </AppShell>
    );
  }

  const includeInternal = user.role === "AGENT" || user.role === "ADMIN";
  const [comments, events, attachments, templates, macros] = await Promise.all([
    listComments(ticket.id, includeInternal),
    listEvents(ticket.id, includeInternal),
    listAttachments(ticket.id, includeInternal),
    includeInternal ? listTemplates() : Promise.resolve([]),
    includeInternal ? listMacros() : Promise.resolve([])
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
