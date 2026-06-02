import { MessageSquare, Save } from "lucide-react";
import { addCommentAction, updateTicketAction } from "@/app/actions";
import { PriorityBadge, StatusBadge, VisibilityBadge } from "@/components/badges";
import { AttachmentUpload } from "@/components/tickets/attachment-upload";
import { formatDateTime } from "@/lib/format";
import { priorityLabels, statusLabels, ticketPriorities, ticketStatuses } from "@/lib/labels";
import { can, isAgent } from "@/lib/permissions";
import type { Category, Store, Ticket, TicketAttachment, TicketComment, TicketEvent, User } from "@/lib/types";

export function TicketDetail({
  currentUser,
  ticket,
  comments,
  events,
  attachments = [],
  users,
  categories,
  stores,
  adminMode = false
}: {
  currentUser: User;
  ticket: Ticket;
  comments: TicketComment[];
  events: TicketEvent[];
  attachments?: TicketAttachment[];
  users: User[];
  categories: Category[];
  stores: Store[];
  adminMode?: boolean;
}) {
  const reporter = users.find((user) => user.id === ticket.reporterId);
  const assignee = users.find((user) => user.id === ticket.assigneeId);
  const category = categories.find((item) => item.id === ticket.categoryId);
  const store = stores.find((item) => item.id === ticket.storeId);
  const canEdit = can(currentUser, "ticket:update");
  const canAddInternal = can(currentUser, "comment:internal");

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="space-y-5">
        <div className="rounded-md border border-black/10 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div data-testid="ticket-number" className="text-sm font-black uppercase text-mint">{ticket.number}</div>
              <h1 className="mt-1 text-3xl font-black leading-tight">{ticket.title}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
          </div>
          <p className="whitespace-pre-wrap leading-7 text-ink/80 dark:text-paper/80">{ticket.description}</p>
          <div className="mt-4">
            <AttachmentUpload ticketId={ticket.id} initialAttachments={attachments} />
          </div>
        </div>

        <div className="rounded-md border border-black/10 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare size={20} className="text-mint" />
            <h2 className="text-xl font-black">Komentarze</h2>
          </div>
          <div className="space-y-3">
            {comments.map((comment) => {
              const author = users.find((user) => user.id === comment.authorId);
              return (
                <article key={comment.id} data-testid="comment-item" className="rounded-md border border-black/10 bg-paper/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-bold">{author?.name ?? "Nieznany"}</div>
                      <div className="text-xs text-ink/55 dark:text-paper/55">{formatDateTime(comment.createdAt)}</div>
                    </div>
                    <VisibilityBadge visibility={comment.visibility} />
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-ink/80 dark:text-paper/80">{comment.body}</p>
                </article>
              );
            })}
            {comments.length === 0 ? <p className="text-sm text-ink/60 dark:text-paper/60">Brak komentarzy.</p> : null}
          </div>

          <form action={addCommentAction} className="mt-5 space-y-3" data-testid="comment-form">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <textarea
              name="body"
              className="min-h-28 w-full rounded-md border border-black/10 bg-white px-3 py-3 text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper"
              placeholder="Dodaj odpowiedź..."
              minLength={2}
              required
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <select
                name="visibility"
                className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/10"
                disabled={!canAddInternal}
                data-testid="visibility-select"
              >
                <option value="PUBLIC">Komentarz publiczny</option>
                {canAddInternal ?                <option value="INTERNAL">Notatka wewnętrzna</option> : null}
              </select>
              <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-md bg-mint px-4 text-sm font-black text-white hover:bg-mint/90">
                <MessageSquare size={16} />
                Dodaj
              </button>
            </div>
          </form>
        </div>
      </section>

      <aside className="space-y-5">
        <div className="rounded-md border border-black/10 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
          <h2 className="mb-4 text-lg font-black">Informacje</h2>
          <Info label="Kategoria" value={category?.name ?? "Brak"} />
          <Info label="Lokalizacja" value={store?.name ?? ticket.department ?? "Brak"} />            <Info label="Zgłaszający" value={reporter?.name ?? "Nieznany"} />
          <Info label="Prowadzi" value={assignee?.name ?? "Nieprzypisane"} />
          <Info label="Kontakt" value={ticket.contact} />
          <Info label="Utworzono" value={formatDateTime(ticket.createdAt)} />
          <Info label="Aktualizacja" value={formatDateTime(ticket.updatedAt)} />
          <Info label="Blokuje prace" value={ticket.blocksWork ? "Tak" : "Nie"} />
        </div>

        {canEdit ? (
          <form action={updateTicketAction} data-testid="admin-actions" className="rounded-md border border-black/10 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <h2 className="mb-4 text-lg font-black">Akcje IT</h2>
            <AdminField label="Status">
              <select name="status" defaultValue={ticket.status} className={sideInputClass}>
                {ticketStatuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Priorytet">
              <select name="priority" defaultValue={ticket.priority} className={sideInputClass}>
                {ticketPriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priorityLabels[priority]}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Wykonawca">
              <select name="assigneeId" defaultValue={ticket.assigneeId ?? ""} className={sideInputClass}>
                <option value="">Nieprzypisane</option>
                {users.filter(isAgent).map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </AdminField>
            <button type="submit" className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-black text-white hover:bg-ink/90 dark:bg-paper dark:text-ink">
              <Save size={16} />
              Zapisz zmiany
            </button>
          </form>
        ) : null}

        <div className="rounded-md border border-black/10 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
          <h2 className="mb-4 text-lg font-black">{adminMode ? "Audit log" : "Historia"}</h2>
          <div className="space-y-3">
            {events.map((event) => {
              const actor = users.find((user) => user.id === event.actorId);
              return (
                <div key={event.id} className="border-l-2 border-mint/50 pl-3">
                  <div className="text-sm font-bold">{event.type}</div>
                  <div className="text-xs text-ink/55 dark:text-paper/55">
                    {formatDateTime(event.createdAt)}{actor ? `, ${actor.name}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}

const sideInputClass =
  "h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper";

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-black/10 py-3 last:border-b-0 dark:border-white/10">
      <div className="text-xs font-black uppercase text-ink/45 dark:text-paper/45">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function AdminField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      {children}
    </label>
  );
}
