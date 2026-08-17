"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function RootError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <AlertTriangle className="mb-4 text-red-500 dark:text-red-400" size={48} />
      <h1 className="text-2xl font-black text-red-700 dark:text-red-300">Coś poszło nie tak</h1>
      <p className="mt-2 max-w-md text-ink/65 dark:text-paper/65">
        Wystąpił nieoczekiwany błąd. Spróbuj ponownie.
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
