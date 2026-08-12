import { CalendarClock, Download, ExternalLink, FilePlus2, Pencil } from "lucide-react";
import { redirect } from "next/navigation";
import { updateDayLogEntryAction } from "@/app/admin/daylog/actions";
import { DayLogDeleteButton } from "@/components/admin/daylog-delete-button";
import { DayLogCreateForm } from "@/components/admin/daylog-create-form";
import { AdminNav } from "@/components/admin/admin-nav";
import { AppShell } from "@/components/app-shell";
import { formatDateOnly, formatDateTime, formatDateTimeLocal, formatDateLabel, parseDateOnly } from "@/lib/format";
import { listDayLogEntries } from "@/lib/data-store";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function DayLogPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();

  if (!can(user, "ticket:view-all")) {
    redirect("/tickets");
  }

  const params = await searchParams;
  const selectedDate = parseDateOnly(params.date);
  const allEntries = await listDayLogEntries();
  const entries = selectedDate
    ? allEntries.filter((entry) => formatDateOnly(entry.occurredAt) === selectedDate)
    : allEntries;

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-mint">
          <CalendarClock size={20} />
          <span className="text-sm font-black uppercase">Administracja</span>
        </div>
        <h1 className="text-3xl font-black">DayLog</h1>
        <p className="mt-2 max-w-2xl text-ink/65 dark:text-paper/65">
          Wspólny dziennik telefonicznych i ustnych zgłoszeń. Każdy wpis jest oznaczony datą oraz administratorem, który go dodał.
        </p>
      </div>

      <AdminNav user={user} currentPath="/admin/daylog" />

      <section className="mb-8 rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Szybki wpis</h2>
            <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">Dodaj krótką notatkę po rozmowie lub zgłoszeniu ustnym.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action="/admin/daylog/export" method="POST" target="_blank">
              <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-md border border-black/10 bg-white px-4 text-sm font-bold transition hover:border-mint hover:text-mint dark:border-white/10 dark:bg-white/5">
                <Download size={16} />
                Eksportuj Excel
              </button>
            </form>
            <DayLogCreateForm initialOccurredAt={formatDateTimeLocal(new Date())} />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-black">Oś czasu</h2>
            <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
              {selectedDate
                ? `Wpisy z dnia ${formatDateLabel(selectedDate)}.`
                : "Najnowsze wpisy są po lewej. Przewiń poziomo, aby zobaczyć starsze."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <form method="get" className="flex flex-wrap items-center gap-2">
              <label htmlFor="daylog-date" className="text-sm font-bold">
                Pokaż dzień
              </label>
              <input
                id="daylog-date"
                name="date"
                type="date"
                defaultValue={selectedDate ?? ""}
                className={filterClass}
                aria-label="Filtruj DayLog po dniu"
              />
              <button type="submit" className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-bold text-white dark:bg-paper dark:text-ink">
                Filtruj
              </button>
              {selectedDate ? (
                <a href="/admin/daylog" className="px-1 text-sm font-bold text-ink/65 hover:text-ink dark:text-paper/65 dark:hover:text-paper">
                  Wyczyść
                </a>
              ) : null}
            </form>
            <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-bold text-ink/60 dark:bg-white/10 dark:text-paper/60">{entries.length} wpisów</span>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-md border border-dashed border-black/15 bg-white/50 p-10 text-center text-sm text-ink/55 dark:border-white/15 dark:bg-white/5 dark:text-paper/55">
            {selectedDate ? "Brak wpisów z wybranego dnia." : "Brak wpisów. Dodaj pierwszy telefoniczny lub ustny kontakt."}
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="relative flex min-w-max gap-5 px-2 pt-2">
              <div className="absolute left-8 right-8 top-6 h-px bg-mint/35" aria-hidden="true" />
              {entries.map((entry) => (
                <article key={entry.id} className="relative w-[min(82vw,21rem)] shrink-0 pt-8">
                  <div className="absolute left-4 top-0 z-10 h-3 w-3 rounded-full border-2 border-white bg-mint shadow-sm dark:border-ink" aria-hidden="true" />
                  <div className="flex h-full flex-col rounded-md border border-black/10 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/10">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-ink/55 dark:text-paper/55">
                      <time dateTime={entry.occurredAt}>{formatDateTime(entry.occurredAt)}</time>
                      <span className="rounded-full bg-mint/10 px-2 py-1 text-mint">{entry.createdByName ?? entry.createdByEmail ?? "Administrator"}</span>
                    </div>
                    <div className="mb-1 text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-paper/45">Od kogo</div>
                    <div className="mb-3 font-semibold">{entry.fromName}</div>
                    <h3 className="mb-2 text-lg font-black">{entry.subject}</h3>
                    <p className="whitespace-pre-wrap pb-4 text-sm leading-relaxed text-ink/70 dark:text-paper/70">{entry.description}</p>
                    <div className="mt-auto grid gap-2 border-t border-black/10 pt-3 dark:border-white/10">
                      {entry.ticketId ? (
                        <a
                          href={`/tickets/${entry.ticketId}`}
                          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-mint px-3 text-xs font-bold text-white transition hover:bg-mint/90"
                        >
                          <ExternalLink size={14} />
                          {entry.ticketNumber ?? "Otwórz zgłoszenie"}
                        </a>
                      ) : (
                        <a
                          href={`/tickets/new?fromDayLog=${encodeURIComponent(entry.id)}`}
                          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-mint px-3 text-xs font-bold text-white transition hover:bg-mint/90"
                        >
                          <FilePlus2 size={14} />
                          Utwórz zgłoszenie
                        </a>
                      )}
                      <details className="min-w-0">
                        <summary className="flex h-9 w-full cursor-pointer list-none items-center justify-center gap-1.5 rounded-md border border-black/10 px-3 text-xs font-bold text-ink/70 transition hover:border-mint hover:text-mint dark:border-white/10 dark:text-paper/70">
                          <Pencil size={14} />
                          Edytuj
                        </summary>
                        <form action={updateDayLogEntryAction} className="mt-3 grid gap-3 border-t border-black/10 pt-3 dark:border-white/10">
                          <input type="hidden" name="id" value={entry.id} />
                          <label className="grid gap-1 text-xs font-bold">
                            Data i godzina
                            <input name="occurredAt" type="datetime-local" defaultValue={formatDateTimeLocal(entry.occurredAt)} required className={fieldClass} />
                          </label>
                          <label className="grid gap-1 text-xs font-bold">
                            Od kogo?
                            <input name="fromName" defaultValue={entry.fromName} required maxLength={160} className={fieldClass} />
                          </label>
                          <label className="grid gap-1 text-xs font-bold">
                            Temat
                            <input name="subject" defaultValue={entry.subject} required maxLength={200} className={fieldClass} />
                          </label>
                          <label className="grid gap-1 text-xs font-bold">
                            Opis
                            <textarea name="description" defaultValue={entry.description} required maxLength={10000} className={`${fieldClass} min-h-24 resize-y`} />
                          </label>
                          <button type="submit" className="h-9 rounded-md bg-mint px-3 text-xs font-bold text-white transition hover:bg-mint/90">
                            Zapisz zmiany
                          </button>
                        </form>
                      </details>
                      <DayLogDeleteButton id={entry.id} subject={entry.subject} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}

const fieldClass = "h-10 rounded-md border border-black/10 bg-white px-3 text-sm font-normal outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper";
const filterClass = "h-10 rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper";
