"use client";

import { useActionState } from "react";
import { setupPasswordAction } from "@/app/setup/actions";

export function SetupPasswordForm({
  email,
  token
}: {
  email: string;
  token: string;
}) {
  const [error, formAction, pending] = useActionState(setupPasswordAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor="email" className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink/60 dark:text-paper/60">
          Adres e-mail
        </label>
        <input
          id="email"
          type="email"
          value={email}
          disabled
          className="h-11 w-full rounded-md border border-black/10 bg-gray-100/50 px-3 text-sm text-ink/60 outline-none dark:border-white/10 dark:bg-white/5 dark:text-paper/60"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink/60 dark:text-paper/60">
          Nowe hasło
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={200}
          autoComplete="new-password"
          placeholder="Minimum 8 znaków"
          className="h-11 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink/60 dark:text-paper/60">
          Potwierdź hasło
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          maxLength={200}
          autoComplete="new-password"
          placeholder="Powtórz hasło"
          className="h-11 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper"
        />
      </div>

      {error ? (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-lg bg-mint text-sm font-bold text-white transition hover:bg-mint/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Zapisywanie..." : "Ustaw hasło i zaloguj się"}
      </button>
    </form>
  );
}
