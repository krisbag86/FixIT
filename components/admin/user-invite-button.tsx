"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { resendUserInviteAdminAction } from "@/app/admin/actions";
import type { ResendUserInviteAdminState } from "@/app/admin/actions";

const initialState: ResendUserInviteAdminState = { status: "idle" };

export function UserInviteButton({
  userId,
  disabled
}: {
  userId: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(resendUserInviteAdminAction, initialState);

  return (
    <div className="grid gap-2">
      <form action={formAction}>
        <input type="hidden" name="id" value={userId} />
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-bold text-ink transition hover:border-mint hover:text-mint disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/10 dark:text-paper"
          type="submit"
          disabled={disabled || pending}
          title={disabled ? "Link jest dostepny tylko dla aktywnych kont bez ustawionego hasla." : "Wyslij link aktywacyjny"}
        >
          <Send size={14} />
          {pending ? "Wysylanie" : "Link"}
        </button>
      </form>

      {state.status !== "idle" ? (
        <div
          className={`rounded-md border p-2 text-xs ${
            state.status === "success"
              ? "border-green-500/20 bg-green-500/10 text-green-800 dark:text-green-200"
              : "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200"
          }`}
        >
          <div className="font-semibold">{state.message}</div>
          {state.inviteError ? <div className="mt-1 opacity-80">SMTP: {state.inviteError}</div> : null}
          {state.activationLink ? (
            <input
              className="mt-2 h-9 w-full min-w-0 rounded-md border border-black/10 bg-white px-2 font-mono text-[11px] text-ink dark:border-white/10 dark:bg-white/10 dark:text-paper"
              readOnly
              value={state.activationLink}
              onFocus={(event) => event.currentTarget.select()}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
