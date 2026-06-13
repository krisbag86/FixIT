"use client";

import { useActionState } from "react";
import { Mail, Plus, UserPlus } from "lucide-react";
import { createUserAdminAction } from "@/app/admin/actions";
import type { CreateUserAdminState } from "@/app/admin/actions";
import { roleLabels } from "@/lib/labels";
import type { Store } from "@/lib/types";

const roleOptions = ["REPORTER", "STORE_MANAGER", "AGENT", "ADMIN"] as const;
const initialState: CreateUserAdminState = { status: "idle" };

export function CreateUserForm({ stores }: { stores: Store[] }) {
  const [state, formAction, pending] = useActionState(createUserAdminAction, initialState);

  return (
    <section className="mb-6 rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
      <div className="mb-4 flex items-center gap-2">
        <UserPlus size={18} className="text-mint" />
        <h2 className="text-lg font-black">Dodaj użytkownika</h2>
      </div>

      <form action={formAction} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem_12rem_minmax(0,0.9fr)_auto_auto_auto]">
        <input name="name" placeholder="Imię i nazwisko" className={fieldClass} required />
        <label className="relative block">
          <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35 dark:text-paper/35" />
          <input
            name="email"
            type="email"
            placeholder="imie.nazwisko@bagietka.pl"
            className={`${fieldClass} pl-9`}
            required
          />
        </label>
        <select name="role" defaultValue="REPORTER" className={fieldClass}>
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </select>
        <select name="storeId" defaultValue="" className={fieldClass}>
          <option value="">Bez sklepu</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.code} - {store.name}
            </option>
          ))}
        </select>
        <input name="department" placeholder="Dział" className={fieldClass} />
        <label className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-bold dark:border-white/10 dark:bg-white/10">
          <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" />
          Aktywny
        </label>
        <label className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-bold dark:border-white/10 dark:bg-white/10">
          <input type="checkbox" name="sendInvite" defaultChecked className="h-4 w-4" />
          Wyślij e-mail
        </label>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-mint px-4 text-sm font-bold text-white transition hover:bg-mint/90 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={pending}
        >
          <Plus size={16} />
          {pending ? "Dodawanie..." : "Dodaj"}
        </button>
      </form>

      {state.status !== "idle" ? (
        <div
          className={`mt-4 rounded-md border p-3 text-sm ${
            state.status === "success"
              ? "border-green-500/20 bg-green-500/10 text-green-800 dark:text-green-200"
              : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
          }`}
        >
          <div className="font-semibold">{state.message}</div>
          {state.status === "success" && state.createdEmail ? (
            <div className="mt-3 rounded-md border border-black/10 bg-white/70 p-3 text-ink dark:border-white/10 dark:bg-white/5 dark:text-paper">
              <div className="text-xs uppercase tracking-wide text-ink/55 dark:text-paper/55">Konto</div>
              <div className="mt-1 font-mono text-base font-bold">{state.createdEmail}</div>
              <div className="mt-1 text-xs text-ink/60 dark:text-paper/60">
                {state.inviteSent
                  ? "Link aktywacyjny został wysłany na adres e-mail."
                  : "Przekaż użytkownikowi instrukcję logowania."}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

const fieldClass =
  "h-10 w-full min-w-0 rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper";
