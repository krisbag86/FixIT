import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { SettingsTile } from "@/components/admin/settings-tile";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getSettingsTilesForUser } from "@/lib/admin-navigation";
import { canUseAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const user = await requireUser();

  if (!canUseAdmin(user)) {
    redirect("/tickets");
  }

  const tiles = getSettingsTilesForUser(user);

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-mint">
          <Settings size={20} />
          <span className="text-sm font-black uppercase">Panel IT</span>
        </div>
        <h1 className="text-3xl font-black">Ustawienia</h1>
        <p className="mt-2 text-ink/65 dark:text-paper/65">Zarządzaj konfiguracją, zespołem i raportowaniem w jednym miejscu.</p>
      </div>

      <AdminNav user={user} currentPath="/admin/settings" />

      <div data-testid="settings-grid" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <SettingsTile key={tile.href} {...tile} />
        ))}
      </div>
    </AppShell>
  );
}
