import { redirect } from "next/navigation";
import { Building2, Plus, Trash2 } from "lucide-react";
import { createStoreAdminAction, deleteStoreAdminAction, updateStoreAdminAction } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getStoreAdminPageData } from "@/lib/data-store";
import { can } from "@/lib/permissions";

export default async function AdminStoresPage() {
  const user = await requireUser();

  if (!can(user, "admin:manage-stores")) {
    redirect("/admin/tickets");
  }

  const { stores, usage } = await getStoreAdminPageData();

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-mint">
          <Building2 size={20} />
          <span className="text-sm font-black uppercase">Administracja</span>
        </div>
        <h1 className="text-3xl font-black">Sklepy</h1>
        <p className="mt-2 text-ink/65 dark:text-paper/65">Zarządzanie sklepami i kontrola aktywności słownika.</p>
      </div>

      <AdminNav user={user} currentPath="/admin/stores" />

      <section className="mb-6 rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
        <div className="mb-4 flex items-center gap-2">
          <Plus size={18} className="text-mint" />
          <h2 className="text-lg font-black">Dodaj sklep</h2>
        </div>
        <form action={createStoreAdminAction} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <input name="code" placeholder="Kod" className={fieldClass} />
          <input name="name" placeholder="Nazwa" className={`${fieldClass} sm:col-span-2 xl:col-span-2`} />
          <input name="city" placeholder="Miasto" className={fieldClass} />
          <input name="address" placeholder="Adres" className={`${fieldClass} sm:col-span-2 xl:col-span-2`} />
          <input name="region" placeholder="Region" className={fieldClass} />
          <label className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-bold dark:border-white/10 dark:bg-white/10">
            <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" />
            Aktywny
          </label>
          <button className="h-10 rounded-md bg-mint px-4 text-sm font-bold text-white transition hover:bg-mint/90 sm:col-span-2 xl:col-span-1" type="submit">
            Dodaj
          </button>
        </form>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {stores.map((store) => {
          const storeUsage = usage[store.id] ?? { userCount: 0, ticketCount: 0 };

          return (
            <article
              key={store.id}
              data-testid="store-card"
              className="rounded-md border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs font-bold text-ink/55 dark:text-paper/55">{store.code}</div>
                  <h2 className="mt-1 truncate text-lg font-black">{store.name}</h2>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                    store.isActive
                      ? "bg-mint/15 text-mint"
                      : "bg-ink/10 text-ink/55 dark:bg-white/10 dark:text-paper/55"
                  }`}
                >
                  {store.isActive ? "Aktywny" : "Nieaktywny"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-black/5 bg-black/[.02] px-3 py-2 dark:border-white/5 dark:bg-white/[.03]">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink/45 dark:text-paper/45">Lokalizacja</div>
                  <div className="mt-1 font-semibold">{store.city || "-"}</div>
                  <div className="text-sm text-ink/65 dark:text-paper/65">{store.address || "-"}</div>
                  {store.region ? <div className="text-xs text-ink/55 dark:text-paper/55">{store.region}</div> : null}
                </div>
                <div className="rounded-md border border-black/5 bg-black/[.02] px-3 py-2 dark:border-white/5 dark:bg-white/[.03]">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink/45 dark:text-paper/45">Powiązania</div>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-lg font-black">{storeUsage.userCount}</div>
                      <div className="text-xs text-ink/55 dark:text-paper/55">użytkowników</div>
                    </div>
                    <div>
                      <div className="text-lg font-black">{storeUsage.ticketCount}</div>
                      <div className="text-xs text-ink/55 dark:text-paper/55">zgłoszeń</div>
                    </div>
                  </div>
                </div>
              </div>

              <form action={updateStoreAdminAction} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <input type="hidden" name="id" value={store.id} />
                <input name="code" aria-label={`Kod sklepu ${store.name}`} defaultValue={store.code} className={fieldClass} />
                <input name="name" aria-label={`Nazwa sklepu ${store.name}`} defaultValue={store.name} className={`${fieldClass} sm:col-span-2 xl:col-span-2`} />
                <input name="city" aria-label={`Miasto sklepu ${store.name}`} defaultValue={store.city} className={fieldClass} />
                <input name="address" aria-label={`Adres sklepu ${store.name}`} defaultValue={store.address} className={`${fieldClass} sm:col-span-2 xl:col-span-2`} />
                <input name="region" aria-label={`Region sklepu ${store.name}`} defaultValue={store.region} className={fieldClass} />
                <label className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-bold dark:border-white/10 dark:bg-white/10">
                  <input type="checkbox" name="isActive" defaultChecked={store.isActive} className="h-4 w-4" />
                  Aktywny
                </label>
                <button className="h-10 rounded-md bg-ink px-4 text-sm font-bold text-white dark:bg-paper dark:text-ink sm:col-span-2 xl:col-span-1" type="submit">
                  Zapisz
                </button>
              </form>

              <div className="mt-3 flex justify-end border-t border-black/5 pt-3 dark:border-white/5">
                <form action={deleteStoreAdminAction}>
                  <input type="hidden" name="id" value={store.id} />
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 text-sm font-bold text-red-600 dark:text-red-400"
                  >
                    <Trash2 size={16} />
                    Usuń
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}

const fieldClass =
  "h-10 w-full min-w-0 rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper";
