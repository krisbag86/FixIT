import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TicketDetail } from "@/components/ticket-detail";
import { requireUser } from "@/lib/auth";
import { findTicket, listAttachments, listComments, listEvents, listMacros, listTemplates, readDatabase } from "@/lib/data-store";
import { canViewTicket } from "@/lib/permissions";

export default async function TicketDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const ticket = await findTicket(id);

  if (!ticket || !canViewTicket(user, ticket)) {
    notFound();
  }

  const includeInternal = user.role === "AGENT" || user.role === "ADMIN";
  const [database, comments, events, attachments, templates, macros] = await Promise.all([
    readDatabase(),
    listComments(ticket.id, includeInternal),
    listEvents(ticket.id),
    listAttachments(ticket.id),
    listTemplates(),
    listMacros()
  ]);

  return (
    <AppShell user={user}>
      <TicketDetail
        currentUser={user}
        ticket={ticket}
        comments={comments}
        events={events}
        attachments={attachments}
        users={database.users}
        categories={database.categories}
        stores={database.stores}
        templates={templates}
        macros={macros}
      />
    </AppShell>
  );
}
