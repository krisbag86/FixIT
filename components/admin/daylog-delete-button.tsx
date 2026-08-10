"use client";

import { Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { deleteDayLogEntryAction } from "@/app/admin/daylog/actions";

export function DayLogDeleteButton({ id, subject }: { id: string; subject: string }) {
  return (
    <form
      action={deleteDayLogEntryAction}
      className="w-full"
      onSubmit={(event) => {
        if (!confirm(`Usunąć wpis „${subject}”? Tej operacji nie da się cofnąć.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <DeleteSubmitButton />
    </form>
  );
}

function DeleteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-red-500/25 bg-red-500/10 px-3 text-xs font-bold text-red-700 transition hover:border-red-500/45 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-200"
    >
      <Trash2 size={14} />
      {pending ? "Usuwanie" : "Usuń"}
    </button>
  );
}
