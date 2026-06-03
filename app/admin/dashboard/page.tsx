import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { ITDashboard } from "@/components/admin/it-dashboard";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getDashboardData, readDatabase } from "@/lib/data-store";
import { canUseAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  if (!canUseAdmin(user)) {
    redirect("/tickets");
  }

  const [dashboardData, database] = await Promise.all([
    getDashboardData(),
    readDatabase(),
  ]);

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-mint">
          <LayoutDashboard size={20} />
          <span className="text-sm font-black uppercase">Panel IT</span>
        </div>
        <h1 className="text-3xl font-black">Pulpit</h1>
        <p className="mt-2 text-ink/65 dark:text-paper/65">
          Przegląd stanu zgłoszeń i obciążenia zespołu IT.
        </p>
      </div>

      <AdminNav user={user} currentPath="/admin/dashboard" />
      <ITDashboard data={dashboardData} database={{ users: database.users }} />
    </AppShell>
  );
}
