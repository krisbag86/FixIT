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
        Powrót do bazy wiedzy
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
        <div className="prose prose-sm mt-6 max-w-none leading-7 text-ink/80 dark:text-paper/80">
          {renderMarkdown(article.body)}
        </div>
      </div>
    </article>
  );
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function renderMarkdown(body: string) {
  const lines = body.split("\n");
  const nodes = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1] ?? "";

    if (line.startsWith("# ")) {
      nodes.push(
        <h2 key={index} className="mb-4 text-2xl font-black text-ink dark:text-paper">
          {line.replace(/^#\s+/, "")}
        </h2>
      );
      continue;
    }

    if (line.startsWith("## ")) {
      nodes.push(
        <h3 key={index} className="mb-3 mt-6 text-xl font-black text-ink dark:text-paper">
          {line.replace(/^##\s+/, "")}
        </h3>
      );
      continue;
    }

    if (line.includes("|") && isTableSeparator(nextLine)) {
      const header = splitTableRow(line);
      const rows = [];
      index += 2;

      while (index < lines.length && lines[index].includes("|")) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }

      index -= 1;
      nodes.push(
        <div key={`table-${index}`} className="my-5 overflow-x-auto rounded-md border border-black/10 dark:border-white/10">
          <table className="min-w-[52rem] w-full border-collapse text-left text-sm">
            <thead className="bg-ink text-white dark:bg-paper dark:text-ink">
              <tr>
                {header.map((cell) => (
                  <th key={cell} className="px-3 py-2 font-black">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${row.join("-")}-${rowIndex}`} className="border-t border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/5">
                  {row.map((cell, cellIndex) => (
                    <td key={`${cell}-${cellIndex}`} className="max-w-[20rem] break-words px-3 py-2 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (line.trim() === "") {
      nodes.push(<br key={index} />);
      continue;
    }

    nodes.push(
      <p key={index} className="mb-2">
        {line}
      </p>
    );
  }

  return nodes;
}
