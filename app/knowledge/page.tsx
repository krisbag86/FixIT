import { BookOpen, Filter, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ArticleCard } from "@/components/knowledge/article-card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { listPublishedKnowledgeArticles, readDatabase } from "@/lib/data-store";

export default async function KnowledgePage({
  searchParams
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const database = await readDatabase();
  const articles = await listPublishedKnowledgeArticles({
    categoryId: params.category || undefined,
    query: params.q || undefined
  });
  const categories = database.categories.filter((c) => c.isActive);

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-mint">
            <BookOpen size={20} />
            <span className="text-sm font-black uppercase">Baza wiedzy</span>
          </div>
          <h1 className="text-3xl font-black">Baza wiedzy</h1>
          <p className="mt-2 text-ink/65 dark:text-paper/65">
            Rozwiązania typowych problemów. Jeśli nie znajdziesz odpowiedzi, utwórz zgłoszenie.
          </p>
        </div>
        <form className="flex w-full flex-wrap items-center gap-2 sm:w-auto" method="get">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 dark:text-paper/40" />
            <input
              name="q"
              type="search"
              defaultValue={params.q ?? ""}
              placeholder="Szukaj artykułów..."
              className="h-10 w-full rounded-md border border-black/10 bg-white pl-9 pr-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper sm:w-56"
            />
          </div>
          <Filter size={18} className="text-ink/50 dark:text-paper/50" />
          <select
            name="category"
            defaultValue={params.category ?? ""}
            className="h-10 min-w-48 rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper"
          >
            <option value="">Wszystkie kategorie</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <button
            className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-bold text-white dark:bg-paper dark:text-ink"
            type="submit"
          >
            Szukaj
          </button>
        </form>
      </div>

      {articles.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              category={categories.find((c) => c.id === article.categoryId)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          variant={params.q ? "search" : "articles"}
          description={
            params.q
              ? `Brak wyników dla "${params.q}". Spróbuj zmienić frazę.`
              : params.category
                ? "Brak opublikowanych artykułów w tej kategorii."
                : "Baza wiedzy nie zawiera jeszcze żadnych artykułów."
          }
        />
      )}
    </AppShell>
  );
}
