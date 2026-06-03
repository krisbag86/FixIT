import { redirect } from "next/navigation";
import { BarChart3, Clock, Download, FileText, Flame, TrendingDown } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AppShell } from "@/components/app-shell";
import { PriorityBadge } from "@/components/badges";
import { requireUser } from "@/lib/auth";
import { getDashboardMetrics, readDatabase, slaRules } from "@/lib/data-store";
import { formatDateTime } from "@/lib/format";
import { priorityLabels } from "@/lib/labels";
import { can } from "@/lib/permissions";
import type { TicketPriority } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const user = await requireUser();

  if (!can(user, "ticket:view-all")) {
    redirect("/tickets");
  }

  const [metrics, database] = await Promise.all([getDashboardMetrics(), readDatabase()]);

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-mint">
          <BarChart3 size={20} />
          <span className="text-sm font-black uppercase">Raporty</span>
        </div>
        <h1 className="text-3xl font-black">Raport IT</h1>
        <p className="mt-2 text-ink/65 dark:text-paper/65">Metryki, SLA i eksport danych.</p>
      </div>

      <AdminNav user={user} currentPath="/admin/reports" />

      {/* Metrics grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          icon={<FileText size={22} />}
          label="Wszystkie zgłoszenia"
          value={metrics.totalTickets}
          color="text-blue-600 dark:text-blue-400"
        />
        <MetricCard
          icon={<Clock size={22} />}
          label="Otwarte"
          value={metrics.openTickets}
          color="text-amber-600 dark:text-amber-400"
        />
        <MetricCard
          icon={<Flame size={22} />}
          label="Krytyczne"
          value={metrics.criticalTickets}
          color="text-red-600 dark:text-red-400"
        />
        <MetricCard
          icon={<TrendingDown size={22} />}
          label="Średni czas rozwiązania"
          value={metrics.avgResolutionHours !== null ? `${metrics.avgResolutionHours}h` : "---"}
          color="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      {/* Top Categories + SLA Breaches */}
      <div className="mb-8 grid gap-6 xl:grid-cols-2">
        {/* Top Categories */}
        <div className="rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
            <FileText size={18} className="text-mint" />
            Top kategorie
          </h2>
          {metrics.topCategories.length === 0 ? (
            <p className="text-sm text-ink/55 dark:text-paper/55">Brak danych.</p>
          ) : (
            <div className="space-y-3">
              {metrics.topCategories.map((cat, idx) => {
                const maxCount = metrics.topCategories[0].count;
                const pct = maxCount > 0 ? Math.round((cat.count / maxCount) * 100) : 0;

                return (
                  <div key={cat.categoryId}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-semibold">
                        <span className="mr-2 text-xs text-ink/50 dark:text-paper/50">{idx + 1}.</span>
                        {cat.categoryName}
                      </span>
                      <span className="font-bold text-ink/70 dark:text-paper/70">{cat.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
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

        {/* SLA Breaches */}
        <div className="rounded-md border border-red-500/20 bg-red-500/5 p-4 dark:border-red-400/20 dark:bg-red-400/5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-red-700 dark:text-red-400">
            <Flame size={18} />
            Naruszenia SLA ({metrics.slaBreached.length})
          </h2>
          {metrics.slaBreached.length === 0 ? (
            <p className="text-sm text-ink/55 dark:text-paper/55">Brak naruszeń SLA. Wszystkie otwarte zgłoszenia mieszczą się w terminie.</p>
          ) : (
            <div className="space-y-3">
              {metrics.slaBreached.slice(0, 10).map((item) => {
                const assignee = database.users.find((u) => u.id === item.ticket.assigneeId);
                const store = database.stores.find((s) => s.id === item.ticket.storeId);
                return (
                  <div
                    key={item.ticket.id}
                    className="rounded-md border border-red-500/20 bg-white/80 p-3 dark:border-red-400/20 dark:bg-white/5"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ink/50 dark:text-paper/50">
                        {item.ticket.number}
                      </span>
                      <PriorityBadge priority={item.ticket.priority} />
                    </div>
                    <div className="text-sm font-semibold">{item.ticket.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/60 dark:text-paper/60">
                      <span>
                        Termin: {formatDateTime(item.slaDeadline)}
                      </span>
                      <span className="font-bold text-red-600 dark:text-red-400">
                        {item.hoursOverdue}h po terminie
                      </span>
                      {assignee ? <span>Wykonawca: {assignee.name}</span> : null}
                      {store ? <span>{store.code}</span> : null}
                    </div>
                  </div>
                );
              })}
              {metrics.slaBreached.length > 10 && (
                <p className="text-sm text-ink/55 dark:text-paper/55">
                  + {metrics.slaBreached.length - 10} więcej naruszeń...
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SLA Rules Reference */}
      <div className="mb-8 rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-black">
          <Clock size={18} className="text-mint" />
          Reguły SLA
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.entries(priorityLabels) as [TicketPriority, string][]).map(([priority, label]) => (
            <div
              key={priority}
              className="rounded-md border border-black/10 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/5"
            >
              <div className="text-xs font-bold uppercase text-ink/45 dark:text-paper/45">{label}</div>
              <div className="mt-1 text-lg font-black">{slaRules[priority]}h</div>
            </div>
          ))}
        </div>
      </div>

      {/* CSV Export */}
      <div className="rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-black">
          <Download size={18} className="text-mint" />
          Eksport danych
        </h2>
        <p className="mb-4 text-sm text-ink/65 dark:text-paper/65">
          Pobierz listę wszystkich zgłoszeń w formacie CSV. Plik otworzysz w arkuszu kalkulacyjnym (Excel, Google Sheets, LibreOffice).
        </p>
        <form action="/admin/reports/export" method="POST" target="_blank">
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-mint px-5 text-sm font-bold text-white transition hover:bg-mint/90"
          >
            <Download size={16} />
            Pobierz CSV
          </button>
        </form>
      </div>
    </AppShell>
  );
}

function MetricCard({
  icon,
  label,
  value,
  color
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-md border border-black/10 bg-white/75 px-4 py-4 dark:border-white/10 dark:bg-white/10">
      <div className={`mb-2 ${color}`}>{icon}</div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-bold uppercase text-ink/50 dark:text-paper/50">{label}</div>
    </div>
  );
}
