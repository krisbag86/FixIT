"use client";

import { useActionState } from "react";
import { AlertCircle, Lock, Save } from "lucide-react";
import { changePasswordAction } from "./actions";

export function ChangePasswordForm() {
  const [error, formAction, pending] = useActionState(changePasswordAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-semibold tracking-wide text-ink/80 dark:text-paper/80" htmlFor="currentPassword">
          Obecne hasło
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          placeholder="admin1234"
          className="h-13 w-full rounded-xl border border-white/20 bg-white/80 px-4 text-ink outline-none ring-mint/20 transition-all duration-300 focus:border-mint focus:ring-4 dark:border-white/5 dark:bg-white/5 dark:text-paper"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold tracking-wide text-ink/80 dark:text-paper/80" htmlFor="newPassword">
          Nowe hasło
        </label>
        <div className="relative">
          <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40 dark:text-paper/40" />
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            placeholder="Co najmniej 6 znaków"
            minLength={6}
            className="h-13 w-full rounded-xl border border-white/20 bg-white/80 py-3 pl-11 pr-4 text-ink outline-none ring-mint/20 transition-all duration-300 focus:border-mint focus:ring-4 dark:border-white/5 dark:bg-white/5 dark:text-paper"
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold tracking-wide text-ink/80 dark:text-paper/80" htmlFor="confirmPassword">
          Potwierdź nowe hasło
        </label>
        <div className="relative">
          <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40 dark:text-paper/40" />
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Powtórz nowe hasło"
            minLength={6}
            className="h-13 w-full rounded-xl border border-white/20 bg-white/80 py-3 pl-11 pr-4 text-ink outline-none ring-mint/20 transition-all duration-300 focus:border-mint focus:ring-4 dark:border-white/5 dark:bg-white/5 dark:text-paper"
            required
          />
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-500/10 p-3.5 text-sm font-medium text-red-600 shadow-sm dark:text-red-300">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="group relative inline-flex h-13 w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-mint to-river px-5 font-bold text-white shadow-lg shadow-mint/20 transition-all duration-300 hover:shadow-xl hover:shadow-mint/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Save size={18} />
        {pending ? "Zmienianie..." : "Zmień hasło i zaloguj"}
      </button>
    </form>
  );
}
