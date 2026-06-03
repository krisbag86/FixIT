import { redirect } from "next/navigation";
import { Plus, Tags, Trash2 } from "lucide-react";
import { createCategoryAdminAction, deleteCategoryAdminAction, updateCategoryAdminAction } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { AppShell } from "@/components/app-shell";
import { priorityLabels, ticketPriorities } from "@/lib/labels";
import { requireUser } from "@/lib/auth";
import { listCategoriesAdmin, readDatabase } from "@/lib/data-store";
import { can } from "@/lib/permissions";

export default async function AdminCategoriesPage() {
  const user = await requireUser();

  if (!can(user, "admin:manage-categories")) {
    redirect("/admin/tickets");
  }

  const [categories, database] = await Promise.all([listCategoriesAdmin({ includeInactive: true }), readDatabase()]);

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-mint">
          <Tags size={20} />
          <span className="text-sm font-black uppercase">Administracja</span>
        </div>
        <h1 className="text-3xl font-black">Kategorie</h1>
        <p className="mt-2 text-ink/65 dark:text-paper/65">Słownik kategorii dla zgłoszeń i bazy wiedzy.</p>
      </div>

      <AdminNav user={user} currentPath="/admin/categories" />

      <section className="mb-6 rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
        <div className="mb-4 flex items-center gap-2">
          <Plus size={18} className="text-mint" />
          <h2 className="text-lg font-black">Dodaj kategorię</h2>
        </div>
        <form action={createCategoryAdminAction} className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_12rem_auto_auto]">
          <input name="name" placeholder="Nazwa kategorii" className={fieldClass} />
          <select name="defaultPriority" defaultValue="NORMAL" className={fieldClass}>
            {ticketPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {priorityLabels[priority]}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-bold dark:border-white/10 dark:bg-white/10">
            <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" />
            Aktywna
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
              <th className="px-4 py-3 font-bold">Kategoria</th>
              <th className="px-4 py-3 font-bold">Domyślny priorytet</th>
              <th className="px-4 py-3 font-bold">Powiązania</th>
              <th className="px-4 py-3 font-bold">Edycja</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const ticketCount = database.tickets.filter((item) => item.categoryId === category.id).length;
              const articleCount = database.knowledgeArticles.filter((item) => item.categoryId === category.id).length;

              return (
                <tr key={category.id} className="border-t border-black/5 bg-white/80 align-top dark:border-white/5 dark:bg-white/5">
                  <td className="px-4 py-3 font-semibold">{category.name}</td>
                  <td className="px-4 py-3 text-ink/65 dark:text-paper/65">{priorityLabels[category.defaultPriority]}</td>
                  <td className="px-4 py-3 text-xs text-ink/60 dark:text-paper/60">
                    {ticketCount} zgłosz. · {articleCount} art.
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <form action={updateCategoryAdminAction} className="grid gap-2 lg:grid-cols-[minmax(0,1.3fr)_12rem_auto_auto]">
                        <input type="hidden" name="id" value={category.id} />
                        <input name="name" defaultValue={category.name} className={fieldClass} />
                        <select name="defaultPriority" defaultValue={category.defaultPriority} className={fieldClass}>
                          {ticketPriorities.map((priority) => (
                            <option key={priority} value={priority}>
                              {priorityLabels[priority]}
                            </option>
                          ))}
                        </select>
                        <label className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-bold dark:border-white/10 dark:bg-white/10">
                          <input type="checkbox" name="isActive" defaultChecked={category.isActive} className="h-4 w-4" />
                          Aktywna
                        </label>
                        <button className="h-10 rounded-md bg-ink px-4 text-sm font-bold text-white dark:bg-paper dark:text-ink" type="submit">
                          Zapisz
                        </button>
                      </form>
                      <form action={deleteCategoryAdminAction}>
                        <input type="hidden" name="id" value={category.id} />
                        <button
                          type="submit"
                          className="inline-flex h-10 items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 text-sm font-bold text-red-600 dark:text-red-400"
                        >
                          <Trash2 size={16} />
                          Usuń
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

const fieldClass =
  "h-10 w-full min-w-0 rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper";
