"use client";

import Link from "next/link";
import { ArrowRight, ListTodo } from "lucide-react";
import { useState } from "react";
import type { KeyboardEvent } from "react";
import { priorityLabels } from "@/lib/labels";
import type { DashboardData, DashboardQueueStage } from "@/lib/types";

const stages: Array<{
  key: DashboardQueueStage;
  label: string;
  allLabel: string;
  emptyLabel: string;
}> = [
  { key: "new", label: "Nowe", allLabel: "Zobacz wszystkie nowe", emptyLabel: "Nie masz nowych zgłoszeń" },
  { key: "waiting", label: "Oczekujące", allLabel: "Zobacz wszystkie oczekujące", emptyLabel: "Nie masz oczekujących zgłoszeń" },
  { key: "in_progress", label: "W realizacji", allLabel: "Zobacz wszystkie w realizacji", emptyLabel: "Nie masz zgłoszeń w realizacji" }
];

export function DashboardMyTickets({ queue }: { queue: DashboardData["myQueue"] }) {
  const [activeStage, setActiveStage] = useState<DashboardQueueStage>("new");
  const activeConfig = stages.find((stage) => stage.key === activeStage) ?? stages[0];
  const activeQueue = queue[activeStage];

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? stages.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + stages.length) % stages.length;
    const next = stages[nextIndex];
    setActiveStage(next.key);
    document.getElementById(`dashboard-tab-${next.key}`)?.focus();
  }

  return (
    <section data-testid="dashboard-my-tickets" className="min-w-0 rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black"><ListTodo size={18} className="text-mint" />Moje zgłoszenia</h2>
        <span className="text-xs font-bold text-ink/50 dark:text-paper/50">Przypisane do mnie</span>
      </div>

      <div role="tablist" aria-label="Etapy moich zgłoszeń" className="mb-4 grid grid-cols-3 gap-1 rounded-md bg-black/5 p-1 dark:bg-white/5">
        {stages.map((stage, index) => {
          const isActive = activeStage === stage.key;
          return (
            <button
              key={stage.key}
              type="button"
              role="tab"
              id={`dashboard-tab-${stage.key}`}
              data-testid={`dashboard-tab-${stage.key}`}
              aria-selected={isActive}
              aria-controls="dashboard-my-panel"
              tabIndex={isActive ? 0 : -1}
              className={`min-w-0 rounded px-2 py-2 text-xs font-black outline-none transition focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink sm:text-sm ${isActive ? "bg-white text-ink shadow-sm dark:bg-white/15 dark:text-paper" : "text-ink/55 hover:text-ink dark:text-paper/55 dark:hover:text-paper"}`}
              onClick={() => setActiveStage(stage.key)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              <span className="block truncate">{stage.label}</span>
              <span className="mt-0.5 block font-mono text-[11px] text-mint">{queue[stage.key].count}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="dashboard-my-panel" data-testid="dashboard-tabpanel" aria-labelledby={`dashboard-tab-${activeStage}`} className="min-h-64">
        {activeQueue.tickets.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink/55 dark:text-paper/55">{activeConfig.emptyLabel}</p>
        ) : (
          <div className="space-y-2">
            {activeQueue.tickets.map((ticket) => (
              <Link key={ticket.id} href={`/admin/tickets/${ticket.id}`} className="block min-w-0 rounded-md border border-black/10 bg-white/80 p-3 transition hover:-translate-y-0.5 hover:border-mint/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint dark:border-white/10 dark:bg-white/5">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-black text-mint">{ticket.number}</div>
                    <div className="mt-1 truncate text-sm font-bold">{ticket.title}</div>
                  </div>
                  <span className="shrink-0 rounded bg-black/5 px-2 py-1 text-[10px] font-black uppercase text-ink/60 dark:bg-white/10 dark:text-paper/60">{priorityLabels[ticket.priority]}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Link href={`/admin/tickets?mine=1&stage=${activeStage}`} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-mint hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint">
        {activeConfig.allLabel}<ArrowRight size={15} />
      </Link>
    </section>
  );
}
