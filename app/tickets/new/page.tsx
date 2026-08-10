import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createTicketAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { TicketFormFaq } from "@/components/knowledge/ticket-form-faq";
import { requireUser } from "@/lib/auth";
import { findDayLogEntry, getNewTicketFormData } from "@/lib/data-store";
import { priorityLabels, ticketPriorities } from "@/lib/labels";
import { CreateTicketSubmit } from "@/components/tickets/create-ticket-submit";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ fromDayLog?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const requestedDayLogEntryId = params.fromDayLog?.trim();
  const sourceEntry = requestedDayLogEntryId && can(user, "ticket:view-all")
    ? await findDayLogEntry(requestedDayLogEntryId)
    : undefined;

  if (sourceEntry?.ticketId) {
    redirect(`/tickets/${sourceEntry.ticketId}`);
  }

  const prefill = sourceEntry
    ? {
        title: sourceEntry.subject.slice(0, 120),
        description: sourceEntry.description.slice(0, 2000),
        contact: sourceEntry.fromName.slice(0, 120)
      }
    : undefined;
  const prefillWasTruncated = Boolean(
    sourceEntry && (sourceEntry.subject.length > 120 || sourceEntry.description.length > 2000 || sourceEntry.fromName.length > 120)
  );
  const { stores: availableStores, categories, articles } = await getNewTicketFormData();
  const storeCollator = new Intl.Collator("pl", { numeric: true, sensitivity: "base" });
  const stores = availableStores.sort((a, b) => storeCollator.compare(a.city, b.city) || storeCollator.compare(a.code, b.code));

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-3xl font-black">Nowe zgłoszenie</h1>
        <p className="mt-2 text-ink/65 dark:text-paper/65">Krótki formularz dla sklepu i biura. Problem blokujący pracę podnosi priorytet do krytycznego.</p>
      </div>

      {sourceEntry ? (
        <div className="mb-4 rounded-md border border-mint/30 bg-mint/10 px-4 py-3 text-sm text-ink/75 dark:text-paper/75">
          <strong>Formularz wypełniono na podstawie wpisu DayLog.</strong> Uzupełnij kategorię, lokalizację i pilność, a następnie sprawdź skopiowaną treść.
          {prefillWasTruncated ? " Dłuższe pola zostały skrócone do limitów formularza." : null}
        </div>
      ) : null}

      <form action={createTicketAction} data-testid="new-ticket-form" className="grid gap-5 rounded-md border border-black/10 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/10 lg:grid-cols-2">
        <input type="hidden" name="submissionId" value={randomUUID()} />
        {sourceEntry ? <input type="hidden" name="dayLogEntryId" value={sourceEntry.id} /> : null}
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
                {store.code} - {store.address || `${store.city} - ${store.name}`}
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
            <input name="title" defaultValue={prefill?.title} className={inputClass} minLength={4} maxLength={120} placeholder="np. Kasa 2 nie drukuje paragonów" required />
          </Field>
        </div>
        <div className="lg:col-span-2">
          <Field label="Opis">
            <textarea name="description" defaultValue={prefill?.description} className={`${inputClass} min-h-36 py-3`} minLength={10} maxLength={2000} placeholder="Co się dzieje, od kiedy, jaka kasa/stanowisko, czy próbowano restartu?" required />
          </Field>
        </div>
        <Field label="Kontakt">
          <input name="contact" defaultValue={prefill?.contact} className={inputClass} placeholder="telefon, email albo osoba na miejscu" required />
        </Field>
        <label className="flex min-h-12 items-center gap-3 rounded-md border border-black/10 bg-paper/70 px-3 text-sm font-semibold dark:border-white/10 dark:bg-white/5">
          <input name="blocksWork" type="checkbox" className="h-5 w-5 accent-mint" />
          Blokuje sprzedaż lub pracę
        </label>
        <TicketFormFaq articles={articles} categories={categories} />
        <div className="lg:col-span-2">
          <CreateTicketSubmit />
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
