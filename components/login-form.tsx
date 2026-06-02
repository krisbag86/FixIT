"use client";

import { useActionState } from "react";
import { LogIn, Mail, AlertCircle } from "lucide-react";
import { loginAction } from "@/app/login/actions";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="space-y-5" data-testid="login-form">
      <div>
        <label className="mb-2 block text-sm font-semibold tracking-wide text-ink/80 dark:text-paper/80" htmlFor="email">
          E-mail służbowy
        </label>
        <div className="relative">
          <Mail size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40 dark:text-paper/40" />
          <input
            id="email"
            name="email"
            type="email"
            placeholder="imię.nazwisko@bagietka.pl"
            className="h-13 w-full rounded-xl border border-white/20 bg-white/80 py-3 pl-11 pr-4 text-ink outline-none ring-mint/20 transition-all duration-300 focus:border-mint focus:ring-4 focus:shadow-lg focus:shadow-mint/10 dark:border-white/5 dark:bg-white/5 dark:text-paper dark:focus:shadow-mint/5"
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
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        <LogIn size={18} className="transition-transform duration-300 group-hover:translate-x-0.5" />
        <span className="relative">{pending ? "Logowanie…" : "Wejdź do FixIT"}</span>
      </button>
    </form>
  );
}
