import { CalendarDays, ChevronLeft, ChevronRight, Download } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { ScheduleBoard } from "@/components/admin/schedule-board";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getWeeklySchedule } from "@/lib/data-store";
import { formatDateLabel, formatDateOnly } from "@/lib/format";
import { can } from "@/lib/permissions";
import { addScheduleDays, getScheduleWeekDays, getScheduleWeekNumber, resolveScheduleWeekStart } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const user = await requireUser();
  if (!can(user, "schedule:view")) {
    redirect("/tickets");
  }

  const params = await searchParams;
  const weekStart = resolveScheduleWeekStart(params.week);
  const weekNumber = getScheduleWeekNumber(weekStart);
  const days = getScheduleWeekDays(weekStart);
  const previousWeek = addScheduleDays(weekStart, -7);
  const canManage = can(user, "schedule:manage");
  const [data, previousData] = await Promise.all([
    getWeeklySchedule(weekStart),
    canManage ? getWeeklySchedule(previousWeek) : Promise.resolve(undefined)
  ]);
  const nextWeek = addScheduleDays(weekStart, 7);
  const currentWeek = resolveScheduleWeekStart();

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-mint">
          <CalendarDays size={20} />
          <span className="text-sm font-black uppercase">Administracja</span>
        </div>
        <h1 className="text-3xl font-black">Grafik tygodniowy</h1>
        <p className="mt-2 text-ink/65 dark:text-paper/65">Zadania i obsada dyżurów od poniedziałku do niedzieli.</p>
      </div>

      <AdminNav user={user} currentPath="/admin/schedule" />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
        <Link href={`/admin/schedule?week=${previousWeek}`} aria-label="Poprzedni tydzień" className={navButtonClass}>
          <ChevronLeft size={17} /> Poprzedni
        </Link>
        <div className="text-center">
          <div className="text-lg font-black">
            Tydzień {weekNumber} · {formatDateLabel(days[0])} – {formatDateLabel(days[6])}
          </div>
          {weekStart !== currentWeek ? <Link href={`/admin/schedule?week=${currentWeek}`} className="text-xs font-bold text-mint">Bieżący tydzień</Link> : null}
        </div>
        <Link href={`/admin/schedule?week=${nextWeek}`} aria-label="Następny tydzień" className={navButtonClass}>
          Następny <ChevronRight size={17} />
        </Link>
      </div>

      <div className="mb-4 flex justify-end">
        <form action="/admin/schedule/export" method="POST" target="_blank">
          <input type="hidden" name="weekStart" value={weekStart} />
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-black/10 bg-white px-4 text-sm font-bold transition hover:border-mint hover:text-mint dark:border-white/10 dark:bg-white/5"
          >
            <Download size={16} />
            Eksportuj Excel
          </button>
        </form>
      </div>

      <ScheduleBoard
        data={data}
        currentUserId={user.id}
        canManage={canManage}
        canCompleteOwn={can(user, "schedule:complete-own")}
        today={formatDateOnly(new Date())}
        previousWeekHasData={Boolean(previousData && (previousData.tasks.length > 0 || previousData.duties.length > 0))}
      />
    </AppShell>
  );
}

const navButtonClass = "inline-flex h-10 items-center gap-1 rounded-md border border-black/10 bg-white px-3 text-sm font-bold transition hover:border-mint hover:text-mint dark:border-white/10 dark:bg-white/5";
