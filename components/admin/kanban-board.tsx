"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, GripVertical, X } from "lucide-react";
import { PriorityBadge } from "@/components/badges";
import type { Ticket, TicketPriority, TicketStatus, User } from "@/lib/types";

const KANBAN_COLUMNS: { status: TicketStatus; label: string }[] = [
  { status: "NEW", label: "Nowe" },
  { status: "TRIAGED", label: "Zweryfikowane" },
  { status: "IN_PROGRESS", label: "W trakcie" },
  { status: "WAITING_FOR_USER", label: "Czeka na uzytk." },
  { status: "WAITING_FOR_VENDOR", label: "Czeka na dostawce" },
  { status: "RESOLVED", label: "Rozwiazane" },
  { status: "CLOSED", label: "Zamkniete" },
  { status: "CANCELLED", label: "Anulowane" }
];

const priorityOrder: Record<TicketPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3
};

function sortByPriority(a: Ticket, b: Ticket): number {
  return (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
}

export function KanbanBoard({
  tickets,
  users
}: {
  tickets: Ticket[];
  users: User[];
}) {
  const router = useRouter();
  const [localTickets, setLocalTickets] = useState<Ticket[]>(tickets);
  const [error, setError] = useState<string | null>(null);
  const [movingIds, setMovingIds] = useState<Set<string>>(new Set());
  const [mobileColumn, setMobileColumn] = useState<string | null>(null);

  // Sync with server data after refresh
  useEffect(() => {
    setLocalTickets(tickets);
    setError(null);
    setMovingIds(new Set());
  }, [tickets]);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  const columns = KANBAN_COLUMNS.map(({ status, label }) => ({
    status,
    label,
    tickets: localTickets.filter((t) => t.status === status).sort(sortByPriority)
  }));

  async function handleDrop(ticketId: string, newStatus: TicketStatus) {
    setError(null);

    // Find the ticket
    const ticket = localTickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.status === newStatus) return;

    const oldStatus = ticket.status;

    // Mark as moving for visual feedback
    setMovingIds((prev) => new Set(prev).add(ticketId));

    // Optimistic update: immediately move the card
    setLocalTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
    );

    try {
      const fd = new FormData();
      fd.set("ticketId", ticketId);
      fd.set("status", newStatus);

      const res = await fetch("/admin/kanban/move", {
        method: "POST",
        body: fd
      });

      if (!res.ok) {
        const text = await res.text();
        // Rollback on server error
        setLocalTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, status: oldStatus } : t))
        );
        setMovingIds((prev) => {
          const next = new Set(prev);
          next.delete(ticketId);
          return next;
        });
        setError(text || "Nie udalo sie zmienic statusu.");
        return;
      }

      // Clear moving state before refresh
      setMovingIds((prev) => {
        const next = new Set(prev);
        next.delete(ticketId);
        return next;
      });

      // Background refresh to sync with server
      router.refresh();
    } catch (err) {
      // Rollback on network error
      setLocalTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: oldStatus } : t))
      );
      setMovingIds((prev) => {
        const next = new Set(prev);
        next.delete(ticketId);
        return next;
      });
      setError("Blad sieci. Sprobuj ponownie.");
      console.error("Kanban move network error:", err);
    }
  }

  const isEmpty = localTickets.length === 0;

  // On mobile, show column selector tabs + single column view
  const visibleColumns = mobileColumn
    ? columns.filter((col) => col.status === mobileColumn)
    : columns;

  return (
    <div>
      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="shrink-0 rounded p-1 transition hover:bg-red-500/20"
            aria-label="Zamknij"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Mobile column selector */}
      <div className="mb-4 flex gap-1 overflow-x-auto pb-2 md:hidden scrollbar-none">
        <button
          onClick={() => setMobileColumn(null)}
          className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-bold transition ${
            !mobileColumn
              ? "bg-ink text-white dark:bg-paper dark:text-ink"
              : "bg-black/5 text-ink/60 hover:bg-black/10 dark:bg-white/10 dark:text-paper/60 dark:hover:bg-white/15"
          }`}
        >
          Wszystkie
        </button>
        {columns.map((col) => (
          <button
            key={col.status}
            onClick={() => setMobileColumn(col.status)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-bold transition ${
              mobileColumn === col.status
                ? "bg-ink text-white dark:bg-paper dark:text-ink"
                : "bg-black/5 text-ink/60 hover:bg-black/10 dark:bg-white/10 dark:text-paper/60 dark:hover:bg-white/15"
            }`}
          >
            {col.label} ({col.tickets.length})
          </button>
        ))}
      </div>

      <div className={`${mobileColumn ? "w-full" : "flex gap-4 overflow-x-auto pb-4"}`}>
        {visibleColumns.map((col) => (
          <div
            key={col.status}
            data-kanban-column={col.status}
            className={`${mobileColumn ? "w-full" : "min-w-[14rem] flex-1"} rounded-md border border-black/10 bg-white/60 p-3 transition-colors dark:border-white/10 dark:bg-white/5`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/ticket-id");
              if (id) handleDrop(id, col.status);
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">{col.label}</h3>
              <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-bold dark:bg-white/10">
                {col.tickets.length}
              </span>
            </div>

            <div className="space-y-2">
              {col.tickets.map((ticket) => (
                <KanbanCard
                  key={ticket.id}
                  ticket={ticket}
                  assignee={users.find((u) => u.id === ticket.assigneeId)}
                  isMoving={movingIds.has(ticket.id)}
                />
              ))}
              {col.tickets.length === 0 && !isEmpty && (
                <div className="py-8 text-center text-xs text-ink/40 dark:text-paper/40">
                  Brak
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KanbanCard({
  ticket,
  assignee,
  isMoving
}: {
  ticket: Ticket;
  assignee?: User;
  isMoving?: boolean;
}) {
  const hoursAgo = Math.round(
    (Date.now() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60)
  );

  return (
    <div
      draggable
      data-testid="kanban-card"
      onDragStart={(e) => {
        e.dataTransfer.setData("text/ticket-id", ticket.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`cursor-grab rounded-md border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing dark:bg-white/10 ${
        isMoving
          ? "border-mint/50 opacity-60"
          : "border-black/10 dark:border-white/10"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs font-bold text-mint">
          <GripVertical size={12} className="text-ink/30 dark:text-paper/30" />
          {ticket.number}
        </span>
        <PriorityBadge priority={ticket.priority} />
      </div>
      <p className="text-sm font-semibold leading-snug line-clamp-2">{ticket.title}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-ink/55 dark:text-paper/55">
        <span>{assignee?.name ?? "Nieprzypisany"}</span>
        <span>{hoursAgo}h</span>
      </div>
      {ticket.blocksWork && (
        <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
          Blokuje sprzedaz
        </div>
      )}
    </div>
  );
}
