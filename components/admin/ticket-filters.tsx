"use client";

import { ChevronDown, Filter } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { activeTicketStatuses, priorityLabels, statusLabels, ticketPriorities } from "@/lib/labels";
import type { Category, Store, User } from "@/lib/types";
import type { TicketListFilters } from "@/lib/ticket-filters";

type TicketFiltersProps = {
  filters: TicketListFilters;
  users: User[];
  stores: Store[];
  categories: Category[];
};

export function TicketFilters({ filters, users, stores, categories }: TicketFiltersProps) {
  const activeFilterCount = Object.keys(filters).length;
  const [isExpanded, setIsExpanded] = useState(activeFilterCount > 0);

  return (
    <form method="get" className="control-panel mb-5 rounded-md p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={18} className="text-ink/50 dark:text-paper/50" />
        <input
          name="q"
          type="search"
          defaultValue={filters.query ?? ""}
          placeholder="Szukaj numeru, tytułu lub opisu"
          className={`${filterClass} min-w-64 flex-1`}
          aria-label="Szukaj ticketów"
        />
        <button
          type="button"
          data-testid="ticket-filters-toggle"
          aria-expanded={isExpanded}
          aria-controls="ticket-filters-panel"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-black/10 px-3 text-sm font-bold text-ink/70 transition hover:border-mint hover:text-ink dark:border-white/10 dark:text-paper/70 dark:hover:text-paper"
          onClick={() => setIsExpanded((current) => !current)}
        >
          <ChevronDown size={16} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          {isExpanded ? "Ukryj filtry" : "Pokaż filtry"}
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-mint/15 px-2 py-0.5 text-xs text-mint">{activeFilterCount}</span>
          ) : null}
        </button>
      </div>

      <div
        id="ticket-filters-panel"
        data-testid="ticket-filters-panel"
        hidden={!isExpanded}
        className={`${isExpanded ? "flex" : "hidden"} mt-3 flex-wrap items-center gap-2 border-t border-black/10 pt-3 dark:border-white/10`}
      >
        <select name="status" aria-label="Filtruj po statusie" defaultValue={filters.status ?? ""} className={filterClass}>
          <option value="">Status</option>
          {activeTicketStatuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
        <select name="priority" aria-label="Filtruj po priorytecie" defaultValue={filters.priority ?? ""} className={filterClass}>
          <option value="">Priorytet</option>
          {ticketPriorities.map((priority) => (
            <option key={priority} value={priority}>
              {priorityLabels[priority]}
            </option>
          ))}
        </select>
        <select name="assignee" aria-label="Filtruj po wykonawcy" defaultValue={filters.assigneeId ?? ""} className={filterClass}>
          <option value="">Wykonawca</option>
          {users
            .filter((item) => item.isActive && (item.role === "AGENT" || item.role === "ADMIN"))
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
        <select name="store" aria-label="Filtruj po sklepie" defaultValue={filters.storeId ?? ""} className={filterClass}>
          <option value="">Sklep</option>
          {stores
            .filter((item) => item.isActive)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} — {item.name}
              </option>
            ))}
        </select>
        <select name="category" aria-label="Filtruj po kategorii" defaultValue={filters.categoryId ?? ""} className={filterClass}>
          <option value="">Kategoria</option>
          {categories
            .filter((item) => item.isActive)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
        <label className={checkLabelClass}>
          <input type="checkbox" name="mine" value="1" defaultChecked={filters.mine} />
          Moje
        </label>
        <label className={checkLabelClass}>
          <input type="checkbox" name="unassigned" value="1" defaultChecked={filters.unassigned} />
          Nieprzypisane
        </label>
        <label className={checkLabelClass}>
          <input type="checkbox" name="overdue" value="1" defaultChecked={filters.overdue} />
          Po SLA
        </label>
        <button className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-bold text-white dark:bg-paper dark:text-ink" type="submit">
          Filtruj
        </button>
        <Link href="/admin/tickets" className="inline-flex h-10 items-center justify-center rounded-md px-3 text-sm font-bold text-ink/65 hover:text-ink dark:text-paper/65 dark:hover:text-paper">
          Wyczyść
        </Link>
      </div>
    </form>
  );
}

const filterClass =
  "h-10 min-w-40 rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper";

const checkLabelClass =
  "inline-flex h-10 items-center gap-2 rounded-md border border-black/10 px-3 text-sm font-semibold text-ink/70 dark:border-white/10 dark:text-paper/70";
