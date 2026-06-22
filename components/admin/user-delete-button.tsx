"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteUserAdminAction } from "@/app/admin/actions";
import type { DeleteUserAdminState } from "@/app/admin/actions";

const initialState: DeleteUserAdminState = { status: "idle" };

export function UserDeleteButton({
  userId,
  userEmail,
  disabled,
  disabledReason
}: {
  userId: string;
  userEmail: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, formAction, pending] = useActionState(deleteUserAdminAction, initialState);

  return (
    <div className="grid gap-2">
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!confirm(`Usunąć konto ${userEmail}? Tej operacji nie da się cofnąć.`)) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={userId} />
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-500/25 bg-red-500/10 px-3 text-xs font-bold text-red-700 transition hover:border-red-500/45 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-200"
          type="submit"
          disabled={disabled || pending}
          title={disabled ? disabledReason : "Usuń użytkownika"}
        >
          <Trash2 size={14} />
          {pending ? "Usuwanie" : "Usuń"}
        </button>
      </form>

      {state.status !== "idle" ? (
        <div
          className={`rounded-md border p-2 text-xs ${
            state.status === "success"
              ? "border-green-500/20 bg-green-500/10 text-green-800 dark:text-green-200"
              : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-200"
          }`}
        >
          {state.message}
        </div>
      ) : null}
    </div>
  );
}
