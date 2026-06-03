"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
      <AlertTriangle className="mb-4 text-red-500 dark:text-red-400" size={48} />
      <h1 className="text-2xl font-black text-red-700 dark:text-red-300">
        Błąd ładowania pulpitu
      </h1>
      <p className="mt-2 max-w-md text-ink/65 dark:text-paper/65">
        Nie udało się załadować danych pulpitu. Sprawdź połączenie z bazą danych
        i spróbuj ponownie.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-ink/40 dark:text-paper/40">
          {error.digest}
        </p>
      ) : null}
      <button
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-mint px-5 py-2.5 text-sm font-bold text-white transition hover:bg-mint/90"
      >
        <RefreshCw size={16} />
        Spróbuj ponownie
      </button>
    </div>
  );
}
