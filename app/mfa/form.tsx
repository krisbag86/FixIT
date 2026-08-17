"use client";

import { useActionState } from "react";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { verifyMfaAction } from "./actions";

export function MfaForm() {
  const [error, formAction, pending] = useActionState(verifyMfaAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <label className="grid gap-2 text-sm font-semibold" htmlFor="code">
        Kod MFA
        <input id="code" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" className="h-12 rounded-md border border-black/10 bg-white px-3 text-center text-xl tracking-[0.35em] dark:border-white/10 dark:bg-white/10 dark:text-paper" required autoFocus />
      </label>
      {error ? <div className="flex items-start gap-2 rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</div> : null}
      <button type="submit" disabled={pending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-mint px-4 font-bold text-white disabled:opacity-60">
        <ShieldCheck size={18} />
        {pending ? "Sprawdzanie..." : "Potwierdź"}
      </button>
    </form>
  );
}
