import Link from "next/link";
import { FileText } from "lucide-react";
import type { Category, KnowledgeArticle } from "@/lib/types";

export function ArticleCard({
  article,
  category
}: {
  article: KnowledgeArticle;
  category?: Category;
}) {
  return (
    <Link
      href={`/knowledge/${article.slug}`}
      className="block rounded-md border border-black/10 bg-white/80 p-5 shadow-sm transition hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
    >
      <div className="mb-3 flex items-center gap-2 text-mint">
        <FileText size={18} />
        {category ? (
          <span className="rounded-md bg-mint/10 px-2 py-0.5 text-xs font-bold uppercase text-mint">
            {category.name}
          </span>
        ) : null}
      </div>
      <h2 className="text-lg font-black leading-tight">{article.title}</h2>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/65 dark:text-paper/65">
        {article.body}
      </p>
    </Link>
  );
}