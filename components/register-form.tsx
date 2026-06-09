"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AlertCircle, KeyRound, Mail, User } from "lucide-react";
import { registerAction } from "@/app/register/actions";

export function RegisterForm() {
  const [error, formAction, pending] = useActionState(registerAction, undefined);
  const [termsAccepted, setTermsAccepted] = useState(false);

  return (
    <form action={formAction} className="space-y-5" data-testid="register-form">
      <div>
        <label className="mb-2 block text-sm font-semibold tracking-wide text-ink/80 dark:text-paper/80" htmlFor="name">
          Imię i nazwisko
        </label>
        <div className="relative">
          <User size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40 dark:text-paper/40" />
          <input
            id="name"
            name="name"
            type="text"
            placeholder="Jan Kowalski"
            className="h-13 w-full rounded-xl border border-white/20 bg-white/80 py-3 pl-11 pr-4 text-ink outline-none ring-mint/20 transition-all duration-300 focus:border-mint focus:ring-4 focus:shadow-lg focus:shadow-mint/10 dark:border-white/5 dark:bg-white/5 dark:text-paper dark:focus:shadow-mint/5"
            required
          />
        </div>
      </div>

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
            placeholder="imie.nazwisko@bagietka.pl"
            className="h-13 w-full rounded-xl border border-white/20 bg-white/80 py-3 pl-11 pr-4 text-ink outline-none ring-mint/20 transition-all duration-300 focus:border-mint focus:ring-4 focus:shadow-lg focus:shadow-mint/10 dark:border-white/5 dark:bg-white/5 dark:text-paper dark:focus:shadow-mint/5"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold tracking-wide text-ink/80 dark:text-paper/80" htmlFor="password">
            Hasło
          </label>
          <div className="relative">
            <KeyRound size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40 dark:text-paper/40" />
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Minimum 8 znaków"
              className="h-13 w-full rounded-xl border border-white/20 bg-white/80 py-3 pl-11 pr-4 text-ink outline-none ring-mint/20 transition-all duration-300 focus:border-mint focus:ring-4 focus:shadow-lg focus:shadow-mint/10 dark:border-white/5 dark:bg-white/5 dark:text-paper dark:focus:shadow-mint/5"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold tracking-wide text-ink/80 dark:text-paper/80" htmlFor="confirmPassword">
            Powtórz hasło
          </label>
          <div className="relative">
            <KeyRound size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40 dark:text-paper/40" />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Powtórz hasło"
              className="h-13 w-full rounded-xl border border-white/20 bg-white/80 py-3 pl-11 pr-4 text-ink outline-none ring-mint/20 transition-all duration-300 focus:border-mint focus:ring-4 focus:shadow-lg focus:shadow-mint/10 dark:border-white/5 dark:bg-white/5 dark:text-paper dark:focus:shadow-mint/5"
              required
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-black/8 bg-black/[0.02] p-4 dark:border-white/8 dark:bg-white/[0.03]">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-mint focus:ring-mint/30"
            required
          />
          <span className="text-xs leading-5 text-ink/70 dark:text-paper/70">
            Akceptuję{" "}
            <Link href="/terms" className="font-medium text-mint underline decoration-mint/30 hover:decoration-mint/70">
              Regulamin
            </Link>{" "}
            i wyrażam zgodę na{" "}
            <Link href="/privacy" className="font-medium text-mint underline decoration-mint/30 hover:decoration-mint/70">
              przetwarzanie danych osobowych
            </Link>
            .
          </span>
        </label>
      </div>

      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-500/10 p-3.5 text-sm font-medium text-red-600 shadow-sm dark:text-red-300">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending || !termsAccepted}
        className="inline-flex h-13 w-full items-center justify-center rounded-xl bg-gradient-to-r from-mint to-river px-5 font-bold text-white shadow-lg shadow-mint/20 transition-all duration-300 hover:shadow-xl hover:shadow-mint/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Rejestrowanie..." : "Załóż konto"}
      </button>

      <p className="text-center text-sm text-ink/55 dark:text-paper/55">
        Masz już konto?{" "}
        <Link href="/login" className="font-semibold text-mint underline decoration-mint/30 hover:decoration-mint/70">
          Zaloguj się
        </Link>
      </p>
    </form>
  );
}
