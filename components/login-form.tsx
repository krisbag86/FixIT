"use client";

import { useActionState } from "react";
import { LogIn, MailCheck } from "lucide-react";
import { loginAction, type LoginState } from "@/app/login/actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, undefined);

  if (state?.status === "sent") {
    return (
      <div className="rounded-md border border-mint/30 bg-mint/10 p-4 text-sm leading-6 text-ink dark:text-paper">
        <div className="mb-2 flex items-center gap-2 font-bold text-mint">
          <MailCheck size={18} />
          Sprawdz skrzynke
        </div>
        <p>
          Wyslalismy link do logowania na <strong>{state.email}</strong>. Kliknij go, aby potwierdzic konto i wejsc do
          FixIT. Link jest wazny 15 minut.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
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
      {state?.status === "error" ? (
        <p className="rounded-md bg-red-500/10 p-3 text-sm font-medium text-red-700 dark:text-red-200">{state.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-mint px-4 font-bold text-white transition hover:bg-mint/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <LogIn size={18} />
        {pending ? "Wysylanie linku..." : "Wyslij link do logowania"}
      </button>
    </form>
  );
}
