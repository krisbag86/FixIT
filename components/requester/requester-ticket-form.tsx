import { createTicketAction } from "@/app/actions";
import { TicketFormFaq } from "@/components/knowledge/ticket-form-faq";
import { CreateTicketSubmit } from "@/components/tickets/create-ticket-submit";
import type { Category, KnowledgeArticle } from "@/lib/types";

export function RequesterTicketForm({
  categories,
  articles,
  submissionId
}: {
  categories: Category[];
  articles: KnowledgeArticle[];
  submissionId: string;
}) {
  return (
    <div data-testid="new-ticket-form">
      <form action={createTicketAction} data-testid="requester-ticket-form" className="grid gap-5 rounded-2xl border border-black/10 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/10 sm:p-6">
        <input type="hidden" name="submissionId" value={submissionId} />
        <Field label="Kategoria">
          <select name="categoryId" className={inputClass} required>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Temat">
          <input name="title" className={inputClass} minLength={4} maxLength={120} placeholder="np. Kasa 2 nie drukuje paragonów" required />
        </Field>
        <Field label="Co się dzieje?">
          <textarea name="description" className={`${inputClass} min-h-40 py-3`} minLength={10} maxLength={2000} placeholder="Opisz problem, od kiedy występuje i czego próbowałeś." required />
        </Field>
        <Field label="Kontakt zwrotny (opcjonalnie)">
          <input name="contact" className={inputClass} maxLength={120} placeholder="Telefon lub dodatkowy e-mail" />
        </Field>
        <TicketFormFaq articles={articles} categories={categories} />
        <CreateTicketSubmit />
      </form>
    </div>
  );
}

const inputClass =
  "h-12 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      {children}
    </label>
  );
}
