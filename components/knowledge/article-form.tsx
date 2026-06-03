import { Save } from "lucide-react";
import type { Category, KnowledgeArticle } from "@/lib/types";

const inputClass =
  "h-12 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper";

export function ArticleFormFields({
  article,
  categories
}: {
  article?: KnowledgeArticle;
  categories: Category[];
}) {
  return (
    <>
      <div>
        <label className="mb-2 block text-sm font-bold" htmlFor="title">
          Tytuł
        </label>
        <input
          id="title"
          name="title"
          defaultValue={article?.title ?? ""}
          className={inputClass}
          minLength={3}
          maxLength={200}
          required
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-bold" htmlFor="slug">
          Slug (identyfikator w URL)
        </label>
        <input
          id="slug"
          name="slug"
          defaultValue={article?.slug ?? ""}
          className={`${inputClass} font-mono text-sm`}
          minLength={3}
          maxLength={200}
          pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
          required
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-bold" htmlFor="categoryId">
          Kategoria
        </label>
        <select id="categoryId" name="categoryId" defaultValue={article?.categoryId ?? ""} className={inputClass}>
          <option value="">Brak kategorii</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-2 block text-sm font-bold" htmlFor="body">
          Treść
        </label>
        <textarea
          id="body"
          name="body"
          defaultValue={article?.body ?? ""}
          className={`${inputClass} min-h-48 py-3 font-mono text-sm leading-6`}
          minLength={10}
          maxLength={10000}
          required
        />
      </div>
      <label className="flex min-h-12 items-center gap-3 rounded-md border border-black/10 bg-paper/70 px-3 text-sm font-semibold dark:border-white/10 dark:bg-white/5">
        <input
          name="isPublished"
          type="checkbox"
          defaultChecked={article?.isPublished ?? false}
          className="h-5 w-5 accent-mint"
        />
        Opublikowany (widoczny dla użytkowników)
      </label>
      <div>
        <button
          type="submit"
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-mint px-5 font-black text-white transition hover:bg-mint/90 sm:w-auto"
        >
          <Save size={18} />
          {article ? "Zapisz zmiany" : "Utwórz artykuł"}
        </button>
      </div>
    </>
  );
}
