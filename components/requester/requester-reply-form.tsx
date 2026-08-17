import { MessageSquare } from "lucide-react";
import { addCommentAction } from "@/app/actions";

export function RequesterReplyForm({ ticketId }: { ticketId: string }) {
  return (
    <form action={addCommentAction} data-testid="requester-reply-form" className="mt-5 space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="visibility" value="PUBLIC" />
      <textarea
        name="body"
        className="min-h-28 w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper"
        placeholder="Napisz krótką odpowiedź..."
        minLength={2}
        maxLength={5000}
        required
      />
      <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-xl bg-mint px-4 text-sm font-black text-white hover:bg-mint/90">
        <MessageSquare size={16} />
        Wyślij odpowiedź
      </button>
    </form>
  );
}
