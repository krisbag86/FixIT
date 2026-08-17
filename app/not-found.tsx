import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 text-6xl font-black text-mint">404</div>
      <h1 className="text-2xl font-black">Strona nie znaleziona</h1>
      <p className="mt-2 max-w-md text-ink/65 dark:text-paper/65">
        Nie znaleziono strony o podanym adresie. Sprawdź adres lub wróć do zgłoszeń.
      </p>
      <Link
        href="/tickets"
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-mint px-5 py-2.5 text-sm font-bold text-white transition hover:bg-mint/90"
      >
        <Home size={16} />
        Wróć do zgłoszeń
      </Link>
    </div>
  );
}
