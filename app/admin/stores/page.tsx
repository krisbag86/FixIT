import { redirect } from "next/navigation";
import { Building2, Plus, Trash2 } from "lucide-react";
import { createStoreAdminAction, deleteStoreAdminAction, updateStoreAdminAction } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { listStoresAdmin, readDatabase } from "@/lib/data-store";
import { can } from "@/lib/permissions";

export default async function AdminStoresPage() {
  const user = await requireUser();

  if (!can(user, "admin:manage-stores")) {
    redirect("/admin/tickets");
  }

  const [stores, database] = await Promise.all([listStoresAdmin({ includeInactive: true }), readDatabase()]);

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-mint">
          <Building2 size={20} />
          <span className="text-sm font-black uppercase">Administracja</span>
        </div>
        <h1 className="text-3xl font-black">Sklepy</h1>
        <p className="mt-2 text-ink/65 dark:text-paper/65">CRUD sklepow i kontrola aktywnosci slownika.</p>
      </div>

      <AdminNav user={user} currentPath="/admin/stores" />

      <section className="mb-6 rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
        <div className="mb-4 flex items-center gap-2">
          <Plus size={18} className="text-mint" />
          <h2 className="text-lg font-black">Dodaj sklep</h2>
        </div>
        <form action={createStoreAdminAction} className="grid gap-3 lg:grid-cols-[9rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
          <input name="code" placeholder="Kod" className={fieldClass} />
          <input name="name" placeholder="Nazwa" className={fieldClass} />
          <input name="city" placeholder="Miasto" className={fieldClass} />
          <input name="region" placeholder="Region" className={fieldClass} />
          <label className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-bold dark:border-white/10 dark:bg-white/10">
            <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" />
            Aktywny
          </label>
          <button className="h-10 rounded-md bg-mint px-4 text-sm font-bold text-white transition hover:bg-mint/90" type="submit">
            Dodaj
          </button>
        </form>
      </section>

      <div className="overflow-hidden rounded-md border border-black/10 dark:border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/70 text-left dark:bg-white/10">
              <th className="px-4 py-3 font-bold">Kod</th>
              <th className="px-4 py-3 font-bold">Nazwa</th>
              <th className="px-4 py-3 font-bold">Lokalizacja</th>
              <th className="px-4 py-3 font-bold">Powiazania</th>
              <th className="px-4 py-3 font-bold">Edycja</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => {
              const userCount = database.users.filter((item) => item.storeId === store.id).length;
              const ticketCount = database.tickets.filter((item) => item.storeId === store.id).length;

              return (
                <tr key={store.id} className="border-t border-black/5 bg-white/80 align-top dark:border-white/5 dark:bg-white/5">
                  <td className="px-4 py-3 font-mono text-xs font-bold">{store.code}</td>
                  <td className="px-4 py-3 font-semibold">{store.name}</td>
                  <td className="px-4 py-3 text-ink/65 dark:text-paper/65">
                    {store.city || "-"} / {store.region || "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink/60 dark:text-paper/60">
                    {userCount} uzytk. · {ticketCount} ticket.
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <form action={updateStoreAdminAction} className="grid gap-2 lg:grid-cols-[8rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                        <input type="hidden" name="id" value={store.id} />
                        <input name="code" defaultValue={store.code} className={fieldClass} />
                        <input name="name" defaultValue={store.name} className={fieldClass} />
                        <input name="city" defaultValue={store.city} className={fieldClass} />
                        <input name="region" defaultValue={store.region} className={fieldClass} />
                        <label className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-bold dark:border-white/10 dark:bg-white/10">
                          <input type="checkbox" name="isActive" defaultChecked={store.isActive} className="h-4 w-4" />
                          Aktywny
                        </label>
                        <button className="h-10 rounded-md bg-ink px-4 text-sm font-bold text-white dark:bg-paper dark:text-ink" type="submit">
                          Zapisz
                        </button>
                      </form>
                      <form action={deleteStoreAdminAction}>
                        <input type="hidden" name="id" value={store.id} />
                        <button
                          type="submit"
                          className="inline-flex h-10 items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 text-sm font-bold text-red-600 dark:text-red-400"
                        >
                          <Trash2 size={16} />
                          Usun
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

const fieldClass = "h-10 rounded-md border border-black/10 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/10";
