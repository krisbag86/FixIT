import Link from "next/link";
import { FileText } from "lucide-react";
import type { Category, KnowledgeArticle } from "@/lib/types";

export function TicketFormFaq({
  articles,
  categories
}: {
  articles: KnowledgeArticle[];
  categories: Category[];
}) {
  return (
    <div className="lg:col-span-2" id="faq-suggestions">
      <label className="mb-2 block text-sm font-bold">Może znajdziesz odpowiedź w bazie wiedzy?</label>
      <div className="rounded-md border border-black/10 bg-paper/70 p-3 dark:border-white/10 dark:bg-white/5">
        <p className="text-xs text-ink/60 dark:text-paper/60">
          Wybierz kategorię powyżej, aby zobaczyć powiązane artykuły.
        </p>
        <div className="mt-2 space-y-1">
          {articles.length > 0 ? (
            articles.map((article) => {
              const category = categories.find((c) => c.id === article.categoryId);
              return (
                <Link
                  key={article.id}
                  href={`/knowledge/${article.slug}`}
                  target="_blank"
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink/70 transition hover:bg-white/70 dark:text-paper/70 dark:hover:bg-white/10"
                >
                  <FileText size={14} className="shrink-0 text-mint" />
                  <span className="truncate">{article.title}</span>
                  {category ? (
                    <span className="ml-auto shrink-0 rounded bg-mint/10 px-1.5 py-0.5 text-[10px] font-bold text-mint">
                      {category.name}
                    </span>
                  ) : null}
                </Link>
              );
            })
          ) : (
            <p className="text-xs italic text-ink/50 dark:text-paper/50">Brak pasujących artykułów.</p>
          )}
        </div>
        <Link
          href="/knowledge"
          target="_blank"
          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-mint hover:underline"
        >
          Przeglądaj całą bazę wiedzy
        </Link>
      </div>
    </div>
  );
}
