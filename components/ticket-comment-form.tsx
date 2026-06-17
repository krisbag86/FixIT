"use client";

import { MessageSquare } from "lucide-react";
import { addCommentAction } from "@/app/actions";
import { TemplatePicker } from "@/components/templates/template-picker";
import type { Category, ResponseMacro, ResponseTemplate, Ticket, User } from "@/lib/types";

export function TicketCommentForm({
  ticket,
  reporter,
  assignee,
  category,
  canAddInternal,
  templates,
  macros,
  currentUserId
}: {
  ticket: Ticket;
  reporter?: User;
  assignee?: User;
  category?: Category;
  canAddInternal: boolean;
  templates: ResponseTemplate[];
  macros: ResponseMacro[];
  currentUserId: string;
}) {
  const userInfo = reporter ?? {
    id: currentUserId,
    name: "Nieznany",
    email: ""
  };

  return (
    <div>
      <TemplatePicker
        templates={templates}
        macros={macros}
        ticket={ticket}
        user={userInfo}
        assignee={assignee}
        category={category}
        onInsert={(body) => {
          const textarea = document.querySelector('textarea[name="body"]') as HTMLTextAreaElement | null;
          if (textarea) {
            textarea.value = body;
            textarea.focus();
          }
        }}
      />
      <form action={addCommentAction} className="mt-5 space-y-3" data-testid="comment-form">
        <input type="hidden" name="ticketId" value={ticket.id} />
        <textarea
          name="body"
          className="min-h-28 w-full rounded-md border border-black/10 bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper"
          placeholder="Dodaj odpowiedź..."
          minLength={2}
          required
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <select
            name="visibility"
            className={commentSelectClass}
            disabled={!canAddInternal}
            data-testid="visibility-select"
          >
            <option value="PUBLIC">Komentarz publiczny</option>
            {canAddInternal ? <option value="INTERNAL">Notatka wewnętrzna</option> : null}
          </select>
          <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-md bg-mint px-4 text-sm font-black text-white hover:bg-mint/90">
            <MessageSquare size={16} />
            Dodaj
          </button>
        </div>
      </form>
    </div>
  );
}

const commentSelectClass =
  "h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper sm:w-auto sm:min-w-56";
