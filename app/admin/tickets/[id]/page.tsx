import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TicketDetail } from "@/components/ticket-detail";
import { requireUser } from "@/lib/auth";
import { findTicket, listAttachments, listComments, listEvents, listMacros, listTemplates, readDatabase } from "@/lib/data-store";
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

  const [database, comments, events, attachments, templates, macros] = await Promise.all([
    readDatabase(),
    listComments(ticket.id, true),
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
        adminMode
        templates={templates}
        macros={macros}
      />
    </AppShell>
  );
}
