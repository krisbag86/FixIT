"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  FileText,
  Flame,
  TrendingDown,
  Users,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { DashboardData } from "@/lib/types";

// recharts is heavy — load it only after the page is interactive so it stays
// out of the initial JS payload of the admin dashboard.
const DashboardCharts = dynamic(
  () => import("@/components/admin/dashboard-charts").then((mod) => mod.DashboardCharts),
  {
    ssr: false,
    loading: () => <ChartsSkeleton />
  }
);

export function ITDashboard({
  data
}: {
  data: DashboardData;
}) {
  const slaWarnings = data.kpi.criticalTickets + data.kpi.slaBreachedCount;

  return (
    <div>
      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KPICard
          icon={<FileText size={22} />}
          label="Otwarte zgłoszenia"
          value={data.kpi.openTickets}
          color="text-blue-600 dark:text-blue-400"
        />
        <KPICard
          icon={<Flame size={22} />}
          label="Krytyczne"
          value={data.kpi.criticalTickets}
          color="text-red-600 dark:text-red-400"
        />
        <KPICard
          icon={<TrendingDown size={22} />}
          label="Średni czas rozwiązania"
          value={
            data.kpi.avgResolutionHours !== null
              ? `${data.kpi.avgResolutionHours}h`
              : "---"
          }
          color="text-emerald-600 dark:text-emerald-400"
        />
        <KPICard
          icon={<AlertTriangle size={22} />}
          label="Naruszenia SLA"
          value={data.kpi.slaBreachedCount}
          color={slaWarnings > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}
        />
      </div>

      {/* Charts Row (lazy-loaded, keeps recharts out of the initial bundle) */}
      <DashboardCharts data={data} />

      {/* Bottom Row: Agent Workload + Recent Activity */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Agent Workload */}
        <div className="rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
            <Users size={18} className="text-mint" />
            Obciążenie agentów
          </h2>
          {data.agentWorkload.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink/55 dark:text-paper/55">
              Brak przypisanych zgłoszeń.
            </p>
          ) : (
            <div className="space-y-3">
              {data.agentWorkload.map((agent) => {
                const maxCount = data.agentWorkload[0]?.openCount ?? 1;
                const pct = maxCount > 0 ? Math.round((agent.openCount / maxCount) * 100) : 0;
                return (
                  <div key={agent.agentId}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-semibold">{agent.agentName}</span>
                      <span className="font-bold text-ink/70 dark:text-paper/70">
                        {agent.openCount}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-mint transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
            <Clock size={18} className="text-mint" />
            Ostatnia aktywność
          </h2>
          {data.recentEvents.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink/55 dark:text-paper/55">
              Brak zdarzeń.
            </p>
          ) : (
            <div className="space-y-2">
              {data.recentEvents.slice(0, 10).map((event) => {
                return (
                  <Link
                    key={event.id}
                    href={`/admin/tickets/${event.ticketId}`}
                    className="block rounded-md border border-black/10 bg-white/80 p-3 transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-mint">
                        {event.ticketNumber ?? "??"}
                      </span>
                      <span className="rounded bg-black/5 px-1.5 py-0.5 font-semibold text-ink/60 dark:bg-white/10 dark:text-paper/60">
                        {event.type}
                      </span>
                    </div>
                    {event.payload && Object.keys(event.payload).length > 0 && (
                      <div className="mt-1 text-xs text-ink/55 dark:text-paper/55">
                        {Object.entries(event.payload).map(([key, value]) => (
                          <span key={key} className="mr-2">
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-ink/45 dark:text-paper/45">
                        {event.actorName ?? "System"} &middot;{" "}
                      {formatDateTime(event.createdAt)}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-md border border-black/10 bg-white/75 px-4 py-4 transition hover:shadow-md dark:border-white/10 dark:bg-white/10">
      <div className={`mb-2 ${color}`}>{icon}</div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-bold uppercase text-ink/50 dark:text-paper/50">
        {label}
      </div>
    </div>
  );
}

function ChartsSkeleton() {
  return (
    <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
      <div className="h-[340px] animate-pulse rounded-md border border-black/10 bg-white/50 dark:border-white/10 dark:bg-white/5" />
      <div className="h-[340px] animate-pulse rounded-md border border-black/10 bg-white/50 dark:border-white/10 dark:bg-white/5" />
    </div>
  );
}
