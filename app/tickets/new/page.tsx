import { Send } from "lucide-react";
import { createTicketAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { TicketFormFaq } from "@/components/knowledge/ticket-form-faq";
import { requireUser } from "@/lib/auth";
import { listPublishedKnowledgeArticles, readDatabase } from "@/lib/data-store";
import { priorityLabels, ticketPriorities } from "@/lib/labels";

export default async function NewTicketPage() {
  const user = await requireUser();
  const [database, articles] = await Promise.all([readDatabase(), listPublishedKnowledgeArticles()]);
  const stores = database.stores.filter((store) => store.isActive);
  const categories = database.categories.filter((category) => category.isActive);

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-3xl font-black">Nowe zgłoszenie</h1>
        <p className="mt-2 text-ink/65 dark:text-paper/65">Krótki formularz dla sklepu i biura. Problem blokujący pracę podnosi priorytet do krytycznego.</p>
      </div>

      <form action={createTicketAction} data-testid="new-ticket-form" className="grid gap-5 rounded-md border border-black/10 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/10 lg:grid-cols-2">
        <Field label="Kategoria">
          <select name="categoryId" className={inputClass} required>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lokalizacja">
          <select name="storeId" defaultValue={user.storeId ?? ""} className={inputClass}>
            <option value="">Biuro / brak sklepu</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.code} - {store.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Dział">
          <input name="department" defaultValue={user.department ?? ""} className={inputClass} placeholder="np. Biuro, Magazyn" />
        </Field>
        <Field label="Pilność">
          <select name="priority" defaultValue="NORMAL" className={inputClass}>
            {ticketPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {priorityLabels[priority]}
              </option>
            ))}
          </select>
        </Field>
        <div className="lg:col-span-2">
          <Field label="Temat">
            <input name="title" className={inputClass} minLength={4} maxLength={120} placeholder="np. Kasa 2 nie drukuje paragonów" required />
          </Field>
        </div>
        <div className="lg:col-span-2">
          <Field label="Opis">
            <textarea name="description" className={`${inputClass} min-h-36 py-3`} minLength={10} maxLength={2000} placeholder="Co się dzieje, od kiedy, jaka kasa/stanowisko, czy próbowano restartu?" required />
          </Field>
        </div>
        <Field label="Kontakt">
          <input name="contact" className={inputClass} placeholder="telefon, email albo osoba na miejscu" required />
        </Field>
        <label className="flex min-h-12 items-center gap-3 rounded-md border border-black/10 bg-paper/70 px-3 text-sm font-semibold dark:border-white/10 dark:bg-white/5">
          <input name="blocksWork" type="checkbox" className="h-5 w-5 accent-mint" />
          Blokuje sprzedaż lub pracę
        </label>
        <TicketFormFaq articles={articles} categories={categories} />
        <div className="lg:col-span-2">
          <button type="submit" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-mint px-5 font-black text-white transition hover:bg-mint/90 sm:w-auto">
            <Send size={18} />
            Utwórz zgłoszenie
          </button>
        </div>
      </form>
    </AppShell>
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
