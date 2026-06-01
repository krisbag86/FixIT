import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TicketDetail } from "@/components/ticket-detail";
import { requireUser } from "@/lib/auth";
import { findTicket, listComments, listEvents, readDatabase } from "@/lib/data-store";
import { can, canViewTicket } from "@/lib/permissions";

export default async function TicketDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const ticket = await findTicket(id);

  if (!ticket || !canViewTicket(user, ticket)) {
    notFound();
  }

  const includeInternal = can(user, "comment:internal");
  const [database, comments, events] = await Promise.all([readDatabase(), listComments(ticket.id, includeInternal), listEvents(ticket.id)]);

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
      />
    </AppShell>
  );
}
