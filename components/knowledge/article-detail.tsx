import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import type { Category, KnowledgeArticle } from "@/lib/types";

export function ArticleDetail({
  article,
  category
}: {
  article: KnowledgeArticle;
  category?: Category;
}) {
  return (
    <article>
      <Link
        href="/knowledge"
        className="mb-6 inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-ink/70 transition hover:bg-white/70 hover:text-ink dark:text-paper/70 dark:hover:bg-white/10 dark:hover:text-paper"
      >
        <ArrowLeft size={18} />
        Powrot do bazy wiedzy
      </Link>

      <div className="rounded-md border border-black/10 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/10">
        <div className="mb-4 flex items-center gap-2 text-mint">
          <FileText size={20} />
          {category ? (
            <span className="rounded-md bg-mint/10 px-2 py-0.5 text-xs font-bold uppercase text-mint">
              {category.name}
            </span>
          ) : null}
        </div>
        <h1 className="text-3xl font-black">{article.title}</h1>
        <div className="prose prose-sm mt-6 max-w-none leading-7 text-ink/80 dark:text-paper/80 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-2">
          {article.body.split("\n").map((line, i) => {
            if (line.match(/^\d\.\s/)) {
              return (
                <p key={i} className="mb-2">
                  {line}
                </p>
              );
            }

            if (line.trim() === "") {
              return <br key={i} />;
            }

            return (
              <p key={i} className="mb-2">
                {line}
              </p>
            );
          })}
        </div>
      </div>
    </article>
  );
}