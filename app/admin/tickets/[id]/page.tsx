import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TicketDetail } from "@/components/ticket-detail";
import { requireUser } from "@/lib/auth";
import { findTicket, listComments, listEvents, readDatabase } from "@/lib/data-store";
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

  const [database, comments, events] = await Promise.all([readDatabase(), listComments(ticket.id, true), listEvents(ticket.id)]);

  return (
    <AppShell user={user}>
      <TicketDetail
        currentUser={user}
        ticket={ticket}
        comments={comments}
        events={events}
        users={database.users}
        categories={database.categories}
        stores={database.stores}
        adminMode
      />
    </AppShell>
  );
}
