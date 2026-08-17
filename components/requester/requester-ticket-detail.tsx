import Link from "next/link";
import { ArrowLeft, CheckCircle, MessageSquare } from "lucide-react";
import { confirmTicketResolutionAction } from "@/app/actions";
import { PublicTicketProgress } from "@/components/requester/public-ticket-progress";
import { RequesterReplyForm } from "@/components/requester/requester-reply-form";
import { formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { Ticket, TicketComment, User } from "@/lib/types";

export function RequesterTicketDetail({
  currentUser,
  ticket,
  comments,
  users
}: {
  currentUser: User;
  ticket: Ticket;
  comments: TicketComment[];
  users: User[];
}) {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const canConfirmResolution = ticket.status === "RESOLVED" && can(currentUser, "ticket:confirm-resolution");

  return (
    <div data-testid="requester-ticket-detail" className="mx-auto max-w-3xl space-y-5">
      <Link href="/tickets" className="inline-flex items-center gap-2 text-sm font-bold text-mint hover:underline">
        <ArrowLeft size={16} />
        Wróć do moich zgłoszeń
      </Link>

      <section className="rounded-2xl border border-black/10 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/10 sm:p-7">
        <div className="text-sm font-black uppercase tracking-wider text-mint">{ticket.number}</div>
        <h1 className="mt-2 text-3xl font-black leading-tight">{ticket.title}</h1>
        <p className="mt-5 whitespace-pre-wrap leading-7 text-ink/80 dark:text-paper/80">{ticket.description}</p>
        <div className="mt-7 border-t border-black/10 pt-6 dark:border-white/10">
          <PublicTicketProgress status={ticket.status} />
        </div>
        <div className="mt-5 text-xs text-ink/50 dark:text-paper/50">Ostatnia aktualizacja: {formatDateTime(ticket.updatedAt)}</div>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/10 sm:p-7">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare size={20} className="text-mint" />
          <h2 className="text-xl font-black">Rozmowa z IT</h2>
        </div>
        <div className="space-y-3">
          {comments.map((comment) => (
            <article key={comment.id} data-testid="requester-comment" className="rounded-xl border border-black/8 bg-paper/70 p-4 dark:border-white/8 dark:bg-white/5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="font-bold">{comment.authorId === currentUser.id ? "Ty" : usersById.get(comment.authorId)?.name ?? "IT"}</div>
                <time className="text-xs text-ink/50 dark:text-paper/50">{formatDateTime(comment.createdAt)}</time>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-ink/80 dark:text-paper/80">{comment.body}</p>
            </article>
          ))}
          {comments.length === 0 ? <p className="text-sm text-ink/60 dark:text-paper/60">Brak odpowiedzi. Możesz dopisać szczegóły poniżej.</p> : null}
        </div>
        <RequesterReplyForm ticketId={ticket.id} />
      </section>

      {canConfirmResolution ? (
        <form action={confirmTicketResolutionAction} className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 dark:border-emerald-400/25 dark:bg-emerald-400/5">
          <input type="hidden" name="ticketId" value={ticket.id} />
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" size={20} />
            <div>
              <h2 className="font-black">Czy problem został rozwiązany?</h2>
              <p className="mt-1 text-sm text-ink/65 dark:text-paper/65">Potwierdzenie zamknie zgłoszenie. Jeśli problem nadal występuje, dopisz odpowiedź powyżej.</p>
              <button type="submit" className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700">
                Potwierdź i zamknij zgłoszenie
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
