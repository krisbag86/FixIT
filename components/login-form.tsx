"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { loginAction } from "@/app/login/actions";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="space-y-4" data-testid="login-form">
      <div>
        <label className="mb-2 block text-sm font-semibold" htmlFor="email">
          Email sluzbowy
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="imie.nazwisko@bagietka.pl"
          className="h-12 w-full rounded-md border border-black/10 bg-white px-3 text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper"
          required
        />
      </div>
      {error ? <p data-testid="login-error" className="rounded-md bg-red-500/10 p-3 text-sm font-medium text-red-700 dark:text-red-200">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-mint px-4 font-bold text-white transition hover:bg-mint/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <LogIn size={18} />
        {pending ? "Logowanie..." : "Wejdz do FixIT"}
      </button>
    </form>
  );
}
