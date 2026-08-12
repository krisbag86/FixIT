"use client";

import { Plus } from "lucide-react";
import { createDayLogEntryAction } from "@/app/admin/daylog/actions";
import { formatDateTimeLocal } from "@/lib/format";

export function DayLogCreateForm({ initialOccurredAt }: { initialOccurredAt: string }) {
  function setCurrentTimeForEmptyForm(details: HTMLDetailsElement) {
    if (!details.open) {
      return;
    }

    const form = details.querySelector("form");
    const occurredAt = form?.elements.namedItem("occurredAt");
    if (!form || !(occurredAt instanceof HTMLInputElement)) {
      return;
    }

    const values = new FormData(form);
    const hasDraft = ["fromName", "subject", "description"].some((name) => String(values.get(name) ?? "").trim());
    if (!hasDraft) {
      const currentDateTime = formatDateTimeLocal(new Date());
      occurredAt.defaultValue = currentDateTime;
      occurredAt.value = currentDateTime;
    }
  }

  function restoreCurrentTimeAfterReset(form: HTMLFormElement) {
    requestAnimationFrame(() => {
      const details = form.closest("details");
      if (details instanceof HTMLDetailsElement) {
        setCurrentTimeForEmptyForm(details);
      }
    });
  }

  return (
    <details onToggle={(event) => setCurrentTimeForEmptyForm(event.currentTarget)}>
      <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-md bg-mint px-4 text-sm font-bold text-white transition hover:bg-mint/90">
        <Plus size={16} />
        Nowy wpis
      </summary>
      <form
        action={createDayLogEntryAction}
        onReset={(event) => restoreCurrentTimeAfterReset(event.currentTarget)}
        className="mt-4 grid gap-3 border-t border-black/10 pt-4 dark:border-white/10 sm:grid-cols-2"
      >
        <label className="grid gap-1 text-sm font-semibold">
          Data i godzina
          <input name="occurredAt" type="datetime-local" defaultValue={initialOccurredAt} required className={fieldClass} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Od kogo?
          <input name="fromName" placeholder="np. Anna Kowalska / sklep 12" required maxLength={160} className={fieldClass} />
        </label>
        <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
          Temat
          <input name="subject" placeholder="Krótki temat rozmowy" required maxLength={200} className={fieldClass} />
        </label>
        <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
          Opis
          <textarea
            name="description"
            placeholder="Co ustalono? Jakie działania wykonano lub są do wykonania?"
            required
            maxLength={10000}
            className={`${fieldClass} min-h-28 resize-y`}
          />
        </label>
        <div className="flex justify-end sm:col-span-2">
          <button type="submit" className="h-10 rounded-md bg-ink px-5 text-sm font-bold text-white transition hover:bg-ink/90 dark:bg-paper dark:text-ink">
            Zapisz wpis
          </button>
        </div>
      </form>
    </details>
  );
}

const fieldClass =
  "h-10 rounded-md border border-black/10 bg-white px-3 text-sm font-normal outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper";
