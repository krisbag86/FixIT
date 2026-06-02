import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function PrivacyPage() {
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
              <ShieldCheck size={28} />
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-mint to-river bg-clip-text text-3xl font-black tracking-tight text-transparent">
                Polityka prywatności
              </h1>
              <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
                Informacja o przetwarzaniu danych osobowych &mdash; RODO
              </p>
            </div>
          </div>

          <div className="space-y-6 text-sm leading-7 text-ink/80 dark:text-paper/80">
            <p className="text-xs text-ink/40 dark:text-paper/40">
              Ostatnia aktualizacja: 1 czerwca 2026 r.
            </p>

            <section>
              <h2 className="mb-3 text-lg font-bold">§1. Administrator danych</h2>
              <p>
                Administratorem Twoich danych osobowych jest <strong>Bagietka Sp. z o.o.</strong> z siedzibą w Warszawie.
                Możesz skontaktować się z nami pod adresem e-mail: <strong>rodo@bagietka.pl</strong>.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-bold">§2. Zakres i cel przetwarzania danych</h2>
              <p>Przetwarzamy następujące dane osobowe Użytkowników Systemu FixIT:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Imię i nazwisko</li>
                <li>Służbowy adres e-mail</li>
                <li>Oddział / sklep (miejsce pracy)</li>
                <li>Rola w Systemie</li>
                <li>Treść zgłoszeń i komentarzy</li>
              </ul>
              <p className="mt-3">
                Dane są przetwarzane w celu umożliwienia korzystania z Systemu FixIT, tj. zgłaszania,
                obsługi i zarządzania incydentami IT (podstawa prawna: art. 6 ust. 1 lit. f RODO &mdash;
                prawnie uzasadniony interes Administratora).
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-bold">§3. Okres przechowywania danych</h2>
              <p>
                Dane osobowe przechowywane są przez czas trwania konta Użytkownika w Systemie,
                a po jego usunięciu &mdash; przez okres niezbędny do realizacji obowiązków archiwizacyjnych
                wynikających z przepisów prawa, nie dłużej niż 5 lat.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-bold">§4. Twoje prawa</h2>
              <p>Zgodnie z RODO przysługują Ci następujące prawa:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><strong>Dostępu</strong> &mdash; możesz zapytać, jakie dane na Twój temat przechowujemy.</li>
                <li><strong>Sprostowania</strong> &mdash; możesz poprawić swoje dane.</li>
                <li><strong>Usunięcia</strong> (&bdquo;prawo do bycia zapomnianym&rdquo;) &mdash; możesz zażądać usunięcia danych.</li>
                <li><strong>Ograniczenia przetwarzania</strong> &mdash; w określonych sytuacjach możesz żądać ograniczenia przetwarzania.</li>
                <li><strong>Sprzeciwu</strong> &mdash; masz prawo sprzeciwić się przetwarzaniu danych.</li>
              </ul>
              <p className="mt-3">
                Aby skorzystać ze swoich praw, wyślij wiadomość na adres: <strong>rodo@bagietka.pl</strong>.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-bold">§5. Odbiorcy danych</h2>
              <p>
                Dane mogą być udostępniane podmiotom przetwarzającym je na nasze zlecenie (np. dostawca hostingu),
                wyłącznie w zakresie niezbędnym do świadczenia usług. Dane nie są przekazywane do państw trzecich
                ani organizacji międzynarodowych.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-bold">§6. Bezpieczeństwo</h2>
              <p>
                Wdrażamy odpowiednie środki techniczne i organizacyjne, aby zapewnić bezpieczeństwo Twoich danych:
                szyfrowanie haseł (PBKDF2), bezpieczne sesje server-side, szyfrowane połączenie TLS
                oraz regularne audyty bezpieczeństwa.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-bold">§7. Kontakt i skarga</h2>
              <p>
                W razie pytań dotyczących prywatności napisz do nas: <strong>rodo@bagietka.pl</strong>.
                Przysługuje Ci również prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (PUODO).
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
