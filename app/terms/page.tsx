import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function TermsPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10">
      {/* Tło */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-32 -top-32 h-96 w-96 animate-pulse rounded-full bg-mint/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 animate-pulse rounded-full bg-river/10 blur-3xl" style={{ animationDelay: "2s" }} />
      </div>

      <div className="mx-auto max-w-3xl">
        {/* Nagłówek */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink/60 transition-colors hover:text-ink dark:text-paper/60 dark:hover:text-paper"
          >
            <ArrowLeft size={18} />
            Powrót do logowania
          </Link>
          <ThemeToggle />
        </div>

        <article className="rounded-2xl border border-white/20 bg-paper/95 p-8 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-ink/95 sm:p-12">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-mint to-river text-white shadow-lg shadow-mint/20">
              <FileText size={28} />
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-mint to-river bg-clip-text text-3xl font-black tracking-tight text-transparent">
                Regulamin
              </h1>
              <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
                System zgłoszeń IT FixIT — Bagietka Sp. z o.o.
              </p>
            </div>
          </div>

          <div className="space-y-6 text-sm leading-7 text-ink/80 dark:text-paper/80">
            <p className="text-xs text-ink/40 dark:text-paper/40">
              Ostatnia aktualizacja: 1 czerwca 2026 r.
            </p>

            <section>
              <h2 className="mb-3 text-lg font-bold">§1. Postanowienia ogólne</h2>
              <p>
                Niniejszy regulamin określa zasady korzystania z systemu FixIT (zwanego dalej &bdquo;Systemem&rdquo;),
                przeznaczonego do zgłaszania i obsługi incydentów IT w sieci sklepów i biura Bagietka Sp. z o.o.
              </p>
              <p className="mt-3">
                System jest narzędziem wewnętrznym, przeznaczonym wyłącznie dla pracowników i współpracowników
                Bagietka Sp. z o.o. posiadających aktywne konto użytkownika.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-bold">§2. Definicje</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li><strong>System</strong> &mdash; aplikacja FixIT Helpdesk dostępna pod adresem wskazanym przez Administratora.</li>
                <li><strong>Użytkownik</strong> &mdash; osoba posiadająca aktywne konto w Systemie.</li>
                <li><strong>Zgłoszenie</strong> &mdash; zgłoszony za pośrednictwem Systemu incydent lub problem IT.</li>
                <li><strong>Administrator</strong> &mdash; Bagietka Sp. z o.o., właściciel Systemu.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-bold">§3. Zasady korzystania</h2>
              <ol className="list-decimal space-y-2 pl-5">
                <li>Użytkownik zobowiązuje się do korzystania z Systemu zgodnie z jego przeznaczeniem.</li>
                <li>Zabrania się wprowadzania do Systemu treści niezgodnych z prawem lub naruszających dobra osobiste.</li>
                <li>Użytkownik zobowiązuje się do zachowania w poufności swoich danych logowania.</li>
                <li>Administrator nie ponosi odpowiedzialności za szkody wynikłe z nieuprawnionego dostępu do konta Użytkownika.</li>
                <li>Każde zgłoszenie powinno zawierać prawdziwe i rzetelne informacje.</li>
              </ol>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-bold">§4. Odpowiedzialność</h2>
              <p>
                Administrator dokłada wszelkich starań, aby System działał w sposób ciągły i niezakłócony,
                jednak nie gwarantuje dostępności Systemu w 100% czasu. Administrator zastrzega sobie prawo
                do przerw technicznych w celu konserwacji i rozwoju Systemu.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-bold">§5. Postanowienia końcowe</h2>
              <p>
                Administrator zastrzega sobie prawo do zmiany Regulaminu. Użytkownicy zostaną powiadomieni
                o zmianach drogą mailową. W sprawach nieuregulowanych niniejszym regulaminem zastosowanie
                mają przepisy Kodeksu cywilnego oraz właściwych ustaw.
              </p>
            </section>
          </div>
        </article>

        {/* Stopka */}
        <p className="mt-6 text-center text-xs text-ink/40 dark:text-paper/40">
          &copy; 2026 Krzysztof Graczyk. Wszelkie prawa zastrzeżone.
        </p>
      </div>
    </main>
  );
}
