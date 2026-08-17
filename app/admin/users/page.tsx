import { redirect } from "next/navigation";
import { Shield, ShieldOff, Users } from "lucide-react";
import { updateUserAdminAction } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { UserDeleteButton } from "@/components/admin/user-delete-button";
import { UserInviteButton } from "@/components/admin/user-invite-button";
import { MfaSetup } from "@/components/admin/mfa-setup";
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
        <h1 className="text-3xl font-black">Użytkownicy</h1>
        <p className="mt-2 text-ink/65 dark:text-paper/65">Role, aktywność i przypisanie do sklepów.</p>
      </div>

      <AdminNav user={user} currentPath="/admin/users" />

      <MfaSetup enabled={Boolean(user.mfaEnabled)} />

      <CreateUserForm stores={stores} />

      <form className="control-panel mb-5 flex flex-wrap items-center gap-2 rounded-md p-3">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Szukaj po imieniu, mailu lub dziale"
          className="h-10 w-full min-w-0 rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper sm:w-auto sm:min-w-[18rem]"
        />
        <button className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-bold text-white dark:bg-paper dark:text-ink" type="submit">
          Szukaj
        </button>
      </form>

      <div className="space-y-6">
        <section className="space-y-3" aria-label="Lista użytkowników">
          {users.length === 0 ? (
            <div className="rounded-md border border-black/10 bg-white/75 p-6 text-center text-sm text-ink/60 dark:border-white/10 dark:bg-white/10 dark:text-paper/60">
              Brak użytkowników pasujących do wyszukiwania.
            </div>
          ) : null}

          {users.map((item) => {
            const store = stores.find((entry) => entry.id === item.storeId);

            return (
              <article key={item.id} className="rounded-md border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/5 pb-3 dark:border-white/5">
                  <div className="min-w-0">
                    <h2 className="font-black">{item.name}</h2>
                    <div className="truncate text-xs text-ink/60 dark:text-paper/60">{item.email}</div>
                    <div className="mt-1 text-xs text-ink/50 dark:text-paper/50">
                      {store ? `${store.code} - ${store.name}` : "Bez sklepu"} · {item.department ?? "Bez działu"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <RoleBadge role={item.role} />
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
                    {item.isScheduleMember ? (
                      <span className="rounded-md bg-mint/10 px-2 py-0.5 text-xs font-bold text-mint">Grafik · {item.scheduleOrder ?? "bez kolejności"}</span>
                    ) : null}
                  </div>
                </div>

                <form action={updateUserAdminAction} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <input type="hidden" name="id" value={item.id} />
                  <label className="grid gap-1.5 text-xs font-bold text-ink/60 dark:text-paper/60">
                    Rola
                    <select name="role" defaultValue={item.role} className={fieldClass}>
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-ink/60 dark:text-paper/60">
                    Sklep
                    <select name="storeId" defaultValue={item.storeId ?? ""} className={fieldClass}>
                      <option value="">Bez sklepu</option>
                      {stores.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.code} - {entry.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-ink/60 dark:text-paper/60 md:col-span-2 xl:col-span-1">
                    Dział
                    <input
                      type="text"
                      name="department"
                      defaultValue={item.department ?? ""}
                      placeholder="Dział"
                      className={fieldClass}
                    />
                  </label>

                  <div className="flex flex-wrap items-end gap-2 rounded-md border border-black/5 bg-black/[0.02] p-3 md:col-span-2 dark:border-white/5 dark:bg-white/[0.03] xl:col-span-3">
                    <label className={toggleClass}>
                      <input type="checkbox" name="isActive" defaultChecked={item.isActive} className="h-4 w-4" />
                      Aktywny
                    </label>
                    <label className={toggleClass}>
                      <input type="checkbox" name="isScheduleMember" defaultChecked={item.isScheduleMember} className="h-4 w-4" />
                      Obecny w grafiku
                    </label>
                    <label className="grid w-28 gap-1 text-xs font-bold text-ink/60 dark:text-paper/60">
                      Kolejność
                      <input
                        type="number"
                        name="scheduleOrder"
                        defaultValue={item.scheduleOrder ?? ""}
                        min={0}
                        max={999}
                        placeholder="Lp."
                        aria-label={`Kolejność w grafiku: ${item.name}`}
                        className={fieldClass}
                      />
                    </label>
                    <button className="h-10 rounded-md bg-mint px-5 text-sm font-bold text-white transition hover:bg-mint/90" type="submit">
                      Zapisz zmiany
                    </button>
                  </div>
                </form>

                <div className="mt-3 flex flex-wrap items-start gap-2">
                  <UserInviteButton userId={item.id} disabled={!item.isActive || !item.mustChangePassword} />
                  <UserDeleteButton
                    userId={item.id}
                    userEmail={item.email}
                    disabled={item.id === user.id}
                    disabledReason="Nie możesz usunąć własnego konta."
                  />
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
          <h2 className="text-lg font-black">Dziennik zmian</h2>
          <p className="mt-1 text-sm text-ink/65 dark:text-paper/65">Ostatnie zmiany ról, aktywności, zaproszeń i zdarzeń bezpieczeństwa.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
        </section>
      </div>
    </AppShell>
  );
}

const fieldClass =
  "h-10 w-full min-w-0 rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper";

const toggleClass =
  "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-md border border-black/10 bg-white px-3 text-xs font-bold dark:border-white/10 dark:bg-white/10";
