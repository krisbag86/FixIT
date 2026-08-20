"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, BarChart3, FileText, Users } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardMyTickets } from "@/components/admin/dashboard-my-tickets";
import { APP_TIME_ZONE } from "@/lib/format";
import type { DashboardAlertItem, DashboardData } from "@/lib/types";

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "numeric", timeZone: APP_TIME_ZONE }).format(new Date(iso));
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || !label) return null;
  return (
    <div className="rounded-md border border-black/10 bg-white px-3 py-2 shadow-md dark:border-white/10 dark:bg-ink">
      <div className="mb-1 text-xs font-bold">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-ink/60 dark:text-paper/60">{entry.name}:</span>
          <span className="font-bold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ITDashboard({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,1fr)]">
        <DashboardAlerts alerts={data.alerts} />
        <DashboardMyTickets queue={data.myQueue} />
      </div>
      <DashboardAnalytics analytics={data.analytics} />
    </div>
  );
}

function DashboardAlerts({ alerts }: { alerts: DashboardData["alerts"] }) {
  return (
    <section data-testid="dashboard-alerts" className="min-w-0 rounded-md border border-red-500/20 bg-white/75 p-4 dark:border-red-400/20 dark:bg-white/10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black"><AlertTriangle size={18} className="text-red-600 dark:text-red-400" />Wymaga reakcji</h2>
        <span className="text-xs font-bold text-ink/50 dark:text-paper/50">Cały zespół</span>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Link href="/admin/tickets?attention=critical" className="rounded-md border border-red-500/20 bg-red-500/5 p-3 transition hover:border-red-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
          <span className="text-xs font-black uppercase text-red-700 dark:text-red-300">Krytyczne</span>
          <strong className="block text-2xl">{alerts.criticalCount}</strong>
        </Link>
        <Link href="/admin/tickets?attention=overdue" className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3 transition hover:border-amber-500/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
          <span className="text-xs font-black uppercase text-amber-700 dark:text-amber-300">SLA przekroczone</span>
          <strong className="block text-2xl">{alerts.slaBreachedCount}</strong>
        </Link>
      </div>
      {alerts.tickets.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink/55 dark:text-paper/55">Brak krytycznych zgłoszeń i naruszeń SLA</p>
      ) : (
        <div className="space-y-2">{alerts.tickets.map((ticket) => <DashboardAlertRow key={ticket.id} ticket={ticket} />)}</div>
      )}
      <Link href="/admin/tickets?attention=all" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-mint hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint">
        Zobacz wszystkie wymagające reakcji<ArrowRight size={15} />
      </Link>
    </section>
  );
}

function DashboardAlertRow({ ticket }: { ticket: DashboardAlertItem }) {
  const reasons = [
    ticket.isCritical ? "Krytyczne" : null,
    ticket.isSlaBreached && ticket.hoursOverdue !== null ? `SLA +${ticket.hoursOverdue} h` : null
  ].filter(Boolean).join(" · ");

  return (
    <Link href={`/admin/tickets/${ticket.id}`} className="block min-w-0 rounded-md border border-black/10 bg-white/80 p-3 transition hover:-translate-y-0.5 hover:border-red-500/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-white/10 dark:bg-white/5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-xs font-black text-mint">{ticket.number}</div>
          <div className="mt-1 truncate text-sm font-bold">{ticket.title}</div>
          {ticket.storeCode ? <div className="mt-1 text-xs text-ink/50 dark:text-paper/50">Sklep {ticket.storeCode}</div> : null}
        </div>
        <span className="shrink-0 text-right text-xs font-black text-red-700 dark:text-red-300">{reasons}</span>
      </div>
    </Link>
  );
}

function DashboardAnalytics({ analytics }: { analytics: DashboardData["analytics"] }) {
  return (
    <section data-testid="dashboard-analytics" className="rounded-md border border-black/10 bg-white/50 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-mint">Ostatnie 30 dni</div>
          <h2 className="mt-1 text-xl font-black">Sytuacja i obciążenie zespołu</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Otwarte" value={analytics.openTickets} />
          <Metric label="Średni czas rozwiązania" value={analytics.avgResolutionHours === null ? "---" : `${analytics.avgResolutionHours}h`} />
        </div>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(14rem,1fr)_minmax(14rem,1fr)]">
        <div className="min-w-0 rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
          <h3 className="mb-4 flex items-center gap-2 text-base font-black"><BarChart3 size={18} className="text-mint" />Utworzone i rozwiązane</h3>
          {analytics.dailyTicketCounts.every((day) => day.created === 0 && day.resolved === 0) ? (
            <p className="py-12 text-center text-sm text-ink/55 dark:text-paper/55">Brak danych do wyświetlenia wykresu.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={analytics.dailyTicketCounts} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-black/10 dark:stroke-white/10" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="created" name="Utworzone" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="resolved" name="Rozwiązane" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="min-w-0 rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
          <h3 className="mb-4 flex items-center gap-2 text-base font-black"><FileText size={18} className="text-mint" />Top kategorie</h3>
          {analytics.topCategories.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink/55 dark:text-paper/55">Brak danych.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.topCategories} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-black/10 dark:stroke-white/10" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="categoryName" type="category" width={92} tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Zgłoszenia" fill="#06b6a2" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="min-w-0 rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
          <h3 className="mb-4 flex items-center gap-2 text-base font-black"><Users size={18} className="text-mint" />Obciążenie agentów</h3>
          {analytics.agentWorkload.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink/55 dark:text-paper/55">Brak przypisanych zgłoszeń.</p>
          ) : (
            <div className="space-y-3">
              {analytics.agentWorkload.map((agent) => {
                const maxCount = analytics.agentWorkload[0]?.openCount ?? 1;
                const width = maxCount > 0 ? Math.round((agent.openCount / maxCount) * 100) : 0;
                return (
                  <div key={agent.agentId}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm"><span className="truncate font-semibold">{agent.agentName}</span><span className="font-bold text-ink/70 dark:text-paper/70">{agent.openCount}</span></div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full rounded-full bg-mint" style={{ width: `${width}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-md border border-black/10 bg-white/75 px-3 py-2 dark:border-white/10 dark:bg-white/10">
      <div className="text-xl font-black">{value}</div>
      <div className="text-[10px] font-black uppercase leading-tight text-ink/50 dark:text-paper/50">{label}</div>
    </div>
  );
}
