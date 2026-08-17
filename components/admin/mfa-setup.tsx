"use client";

import { useActionState } from "react";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { mfaSetupAction, type MfaSetupState } from "@/app/admin/mfa/actions";

const initialState: MfaSetupState = { status: "idle" };

export function MfaSetup({ enabled }: { enabled: boolean }) {
  const [state, formAction, pending] = useActionState(mfaSetupAction, initialState);
  const active = state.enabled ?? enabled;

  return (
    <section className="mb-5 rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 text-mint" size={20} />
        <div className="min-w-0 flex-1">
          <h2 className="font-black">MFA administratora</h2>
          <p className="mt-1 text-sm text-ink/65 dark:text-paper/65">
            {active ? "Logowanie administratora wymaga kodu z aplikacji uwierzytelniającej." : "Włącz kod TOTP, aby chronić konto administratora drugim składnikiem."}
          </p>

          {state.message ? <p className="mt-3 text-sm font-semibold text-mint">{state.message}</p> : null}
          {state.status === "error" ? (
            <div className="mt-3 flex items-start gap-2 text-sm text-red-600 dark:text-red-300">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <span>{state.message}</span>
            </div>
          ) : null}

          {state.secret ? (
            <div className="mt-4 space-y-3 rounded-md border border-mint/20 bg-mint/5 p-3 text-sm">
              <p className="font-semibold">Sekret konfiguracyjny:</p>
              <code className="block break-all rounded bg-black/5 p-2 font-mono text-xs dark:bg-white/10">{state.secret}</code>
              <p className="break-all text-xs text-ink/60 dark:text-paper/60">URI: {state.otpauthUrl}</p>
              <form action={formAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="intent" value="verify" />
                <input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="Kod 6-cyfrowy" required className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/10" />
                <button type="submit" disabled={pending} className="h-10 rounded-md bg-mint px-4 text-sm font-bold text-white disabled:opacity-60">Potwierdź MFA</button>
              </form>
            </div>
          ) : null}

          {!active && !state.secret ? (
            <form action={formAction} className="mt-3">
              <input type="hidden" name="intent" value="start" />
              <button type="submit" disabled={pending} className="h-10 rounded-md bg-mint px-4 text-sm font-bold text-white disabled:opacity-60">Rozpocznij konfigurację MFA</button>
            </form>
          ) : null}

          {active ? (
            <form action={formAction} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="intent" value="disable" />
              <input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="Kod, aby wyłączyć" required className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/10" />
              <button type="submit" disabled={pending} className="h-10 rounded-md border border-red-500/30 px-4 text-sm font-bold text-red-600 disabled:opacity-60 dark:text-red-300">Wyłącz MFA</button>
            </form>
          ) : null}
        </div>
      </div>
    </section>
  );
}
