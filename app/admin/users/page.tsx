import { redirect } from "next/navigation";
import { Shield, ShieldOff, Users } from "lucide-react";
import { updateUserAdminAction } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { AppShell } from "@/components/app-shell";
import { RoleBadge } from "@/components/badges";
import { requireUser } from "@/lib/auth";
import { roleLabels } from "@/lib/labels";
import { listAdminAuditLogs, listStoresAdmin, listUsersAdmin } from "@/lib/data-store";
import { can } from "@/lib/permissions";

const roleOptions = ["REPORTER", "STORE_MANAGER", "AGENT", "ADMIN"] as const;

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();

  if (!can(user, "admin:manage-users")) {
    redirect("/admin/tickets");
  }

  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const [users, stores, auditLogs] = await Promise.all([
    listUsersAdmin({ includeInactive: true, query }),
    listStoresAdmin({ includeInactive: true }),
    listAdminAuditLogs(12)
  ]);

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-mint">
          <Users size={20} />
          <span className="text-sm font-black uppercase">Administracja</span>
        </div>
        <h1 className="text-3xl font-black">Uzytkownicy</h1>
        <p className="mt-2 text-ink/65 dark:text-paper/65">Role, aktywnosc i przypisanie do sklepow.</p>
      </div>

      <AdminNav user={user} currentPath="/admin/users" />

      <form className="mb-5 flex flex-wrap items-center gap-2 rounded-md border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/10">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Szukaj po imieniu, mailu lub dziale"
          className="h-10 min-w-[18rem] rounded-md border border-black/10 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/10"
        />
        <button className="h-10 rounded-md bg-ink px-4 text-sm font-bold text-white dark:bg-paper dark:text-ink" type="submit">
          Szukaj
        </button>
      </form>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <div className="overflow-hidden rounded-md border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/70 text-left dark:bg-white/10">
                <th className="px-4 py-3 font-bold">Uzytkownik</th>
                <th className="px-4 py-3 font-bold">Rola</th>
                <th className="px-4 py-3 font-bold">Sklep / dzial</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => {
                const store = stores.find((entry) => entry.id === item.storeId);

                return (
                  <tr key={item.id} className="border-t border-black/5 bg-white/80 align-top dark:border-white/5 dark:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-xs text-ink/60 dark:text-paper/60">{item.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={item.role} />
                    </td>
                    <td className="px-4 py-3 text-ink/70 dark:text-paper/70">
                      <div>{store ? `${store.code} - ${store.name}` : "-"}</div>
                      <div className="text-xs text-ink/50 dark:text-paper/50">{item.department ?? "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      {item.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-green-500/10 px-2 py-0.5 text-xs font-bold text-green-700 dark:text-green-300">
                          <Shield size={14} />
                          Aktywny
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                          <ShieldOff size={14} />
                          Nieaktywny
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <form action={updateUserAdminAction} className="grid gap-2 lg:grid-cols-[minmax(9rem,1fr)_minmax(11rem,1fr)_minmax(9rem,1fr)_auto_auto]">
                        <input type="hidden" name="id" value={item.id} />
                        <select name="role" defaultValue={item.role} className={fieldClass}>
                          {roleOptions.map((role) => (
                            <option key={role} value={role}>
                              {roleLabels[role]}
                            </option>
                          ))}
                        </select>
                        <select name="storeId" defaultValue={item.storeId ?? ""} className={fieldClass}>
                          <option value="">Bez sklepu</option>
                          {stores.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.code} - {entry.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          name="department"
                          defaultValue={item.department ?? ""}
                          placeholder="Dzial"
                          className={fieldClass}
                        />
                        <label className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-bold dark:border-white/10 dark:bg-white/10">
                          <input type="checkbox" name="isActive" defaultChecked={item.isActive} className="h-4 w-4" />
                          Aktywny
                        </label>
                        <button className="h-10 rounded-md bg-mint px-4 text-sm font-bold text-white transition hover:bg-mint/90" type="submit">
                          Zapisz
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
          <h2 className="text-lg font-black">Audit zmian</h2>
          <p className="mt-1 text-sm text-ink/65 dark:text-paper/65">Ostatnie zmiany rol, aktywnosci i slownikow.</p>
          <div className="mt-4 space-y-3">
            {auditLogs.map((log) => {
              const actor = users.find((entry) => entry.id === log.actorId);
              return (
                <div key={log.id} className="rounded-md border border-black/10 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5">
                  <div className="text-xs font-bold uppercase text-ink/45 dark:text-paper/45">{log.action}</div>
                  <div className="mt-1 text-sm font-semibold">{log.summary}</div>
                  <div className="mt-2 text-xs text-ink/55 dark:text-paper/55">
                    {actor?.email ?? "system"} · {new Date(log.createdAt).toLocaleString("pl-PL")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

const fieldClass = "h-10 rounded-md border border-black/10 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/10";
