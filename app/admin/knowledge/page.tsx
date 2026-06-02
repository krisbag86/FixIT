import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, Edit, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { deleteKnowledgeArticleAction } from "@/app/actions";
import { listKnowledgeArticles, readDatabase } from "@/lib/data-store";
import { canUseAdmin } from "@/lib/permissions";

export default async function AdminKnowledgePage() {
  const user = await requireUser();

  if (!canUseAdmin(user)) {
    redirect("/tickets");
  }

  const [database, articles] = await Promise.all([readDatabase(), listKnowledgeArticles()]);

  const canManageFaq = user.role === "ADMIN";

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-mint">
            <BookOpen size={20} />
            <span className="text-sm font-black uppercase">Panel IT</span>
          </div>
          <h1 className="text-3xl font-black">Baza wiedzy</h1>
          <p className="mt-2 text-ink/65 dark:text-paper/65">Zarzadzanie artykulami bazy wiedzy.</p>
        </div>
        {canManageFaq ? (
          <Link
            href="/admin/knowledge/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-mint px-4 font-bold text-white transition hover:bg-mint/90"
          >
            <Plus size={18} />
            Nowy artykul
          </Link>
        ) : null}
      </div>

      <AdminNav user={user} currentPath="/admin/knowledge" />

      {articles.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/70 text-left dark:bg-white/10">
                <th className="px-4 py-3 font-bold">Tytul</th>
                <th className="hidden px-4 py-3 font-bold md:table-cell">Slug</th>
                <th className="px-4 py-3 font-bold">Kategoria</th>
                <th className="px-4 py-3 font-bold">Status</th>
                {canManageFaq ? <th className="px-4 py-3 font-bold">Akcje</th> : null}
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => {
                const category = database.categories.find((c) => c.id === article.categoryId);
                return (
                  <tr key={article.id} className="border-t border-black/5 bg-white/80 dark:border-white/5 dark:bg-white/5">
                    <td className="px-4 py-3 font-semibold">{article.title}</td>
                    <td className="hidden px-4 py-3 font-mono text-xs text-ink/60 dark:text-paper/60 md:table-cell">
                      {article.slug}
                    </td>
                    <td className="px-4 py-3 text-ink/60 dark:text-paper/60">
                      {category?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      {article.isPublished ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-green-500/10 px-2 py-0.5 text-xs font-bold text-green-700 dark:text-green-300">
                          <Eye size={14} />
                          Widoczny
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                          <EyeOff size={14} />
                          Ukryty
                        </span>
                      )}
                    </td>
                    {canManageFaq ? (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/knowledge/${article.id}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-black/10 bg-white text-ink/70 transition hover:bg-white/70 dark:border-white/10 dark:bg-white/10 dark:text-paper/70"
                            title="Edytuj"
                          >
                            <Edit size={15} />
                          </Link>
                          <form action={deleteKnowledgeArticleAction}>
                            <input type="hidden" name="id" value={article.id} />
                            <button
                              type="submit"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-500/20 bg-red-500/5 text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
                              title="Usun"
                            >
                              <Trash2 size={15} />
                            </button>
                          </form>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-black/20 bg-white/60 p-10 text-center dark:border-white/20 dark:bg-white/10">
          <h2 className="text-xl font-black">Brak artykulow</h2>
          <p className="mt-2 text-ink/65 dark:text-paper/65">Dodaj pierwszy artykul do bazy wiedzy.</p>
        </div>
      )}
    </AppShell>
  );
}
