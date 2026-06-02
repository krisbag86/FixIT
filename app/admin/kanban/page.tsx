import { redirect } from "next/navigation";
import { Columns3 } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { KanbanBoard } from "@/components/admin/kanban-board";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { listVisibleTickets, readDatabase } from "@/lib/data-store";
import { canUseAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function KanbanPage() {
  const user = await requireUser();

  if (!canUseAdmin(user)) {
    redirect("/tickets");
  }

  const database = await readDatabase();
  const tickets = await listVisibleTickets(user);

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-mint">
          <Columns3 size={20} />
          <span className="text-sm font-black uppercase">Panel IT</span>
        </div>
        <h1 className="text-3xl font-black">Kanban</h1>
        <p className="mt-2 text-ink/65 dark:text-paper/65">
          Tablica zgłoszeń &mdash; przeciągnij kartę, aby zmienić status.
        </p>
      </div>

      <AdminNav user={user} currentPath="/admin/kanban" />
      <KanbanBoard tickets={tickets} users={database.users} />
    </AppShell>
  );
}
