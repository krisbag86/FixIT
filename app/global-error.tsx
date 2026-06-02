"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
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
    <html>
      <body className="flex min-h-screen items-center justify-center bg-[#f7f5ef] p-8 dark:bg-[#0a0f16]">
        <div className="max-w-md text-center">
          <div className="mb-6 text-6xl text-[#1f8a70]">!</div>
          <h1 className="mb-3 text-2xl font-black text-[#17202a] dark:text-[#f7f5ef]">
            Wystąpił krytyczny błąd
          </h1>
          <p className="mb-6 text-sm text-[#17202a]/65 dark:text-[#f7f5ef]/65">
            Coś poszło nie tak. Zespół IT został powiadomiony.
          </p>
          <button
            onClick={reset}
            className="rounded-lg bg-[#1f8a70] px-6 py-2.5 text-sm font-semibold text-white 
                       transition-all hover:bg-[#187a62] active:scale-[0.97]"
          >
            Spróbuj ponownie
          </button>
        </div>
      </body>
    </html>
  );
}
