"use client";

import { useState } from "react";
import { Check, Circle, ClipboardCopy, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import {
  copyPreviousScheduleWeekAction,
  createScheduleTaskAction,
  deleteScheduleTaskAction,
  setScheduleDutyAction,
  toggleScheduleTaskAction,
  updateScheduleTaskAction
} from "@/app/admin/schedule/actions";
import { getScheduleWeekDays } from "@/lib/schedule";
import type { ScheduleDuty, ScheduleTask, User, WeeklyScheduleData } from "@/lib/types";

const dayFormatter = new Intl.DateTimeFormat("pl-PL", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });

export function ScheduleBoard({
  data,
  currentUserId,
  canManage,
  canCompleteOwn,
  today,
  previousWeekHasData
}: {
  data: WeeklyScheduleData;
  currentUserId: string;
  canManage: boolean;
  canCompleteOwn: boolean;
  today: string;
  previousWeekHasData: boolean;
}) {
  const days = getScheduleWeekDays(data.weekStart);
  const [selectedDay, setSelectedDay] = useState(days.includes(today) ? today : days[0]);
  const hasData = data.tasks.length > 0 || data.duties.length > 0;

  if (data.members.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-black/15 bg-white/60 p-10 text-center dark:border-white/15 dark:bg-white/5">
        <h2 className="text-lg font-black">Brak członków grafiku</h2>
        <p className="mt-2 text-sm text-ink/60 dark:text-paper/60">
          Administrator musi zaznaczyć opcję „Grafik” przy aktywnych kontach agentów lub administratorów.
        </p>
        {canManage ? (
          <a href="/admin/users" className="mt-4 inline-flex h-10 items-center rounded-md bg-mint px-4 text-sm font-bold text-white">
            Przejdź do użytkowników
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <DutyCoverage days={days} duties={data.duties} />
        {canManage ? (
          <form
            action={copyPreviousScheduleWeekAction}
            onSubmit={(event) => {
              if (!confirm("Skopiować zadania i dyżury z poprzedniego tygodnia? Zadania zostaną oznaczone jako niewykonane.")) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="weekStart" value={data.weekStart} />
            <button
              type="submit"
              disabled={hasData || !previousWeekHasData}
              title={hasData ? "Kopiowanie jest dostępne tylko dla pustego tygodnia." : !previousWeekHasData ? "Poprzedni tydzień jest pusty." : undefined}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-black/10 bg-white px-4 text-sm font-bold transition hover:border-mint hover:text-mint disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:bg-white/5"
            >
              <ClipboardCopy size={16} />
              Kopiuj poprzedni tydzień
            </button>
          </form>
        ) : null}
      </div>

      <div className="lg:hidden">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {days.map((day, index) => {
            const selected = selectedDay === day;
            const weekend = index >= 5;
            const covered = data.duties.some((duty) => duty.date === day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`shrink-0 rounded-md border px-3 py-2 text-xs font-bold transition ${
                  selected
                    ? "border-ink bg-ink text-white dark:border-paper dark:bg-paper dark:text-ink"
                    : weekend
                      ? "border-amber-400/30 bg-amber-400/10"
                      : "border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/5"
                }`}
              >
                {formatDay(day)}
                {!covered ? <span className="ml-1 text-red-500">!</span> : null}
              </button>
            );
          })}
        </div>
        <div className="grid gap-3">
          {data.members.map((member) => (
            <div key={member.id} className="rounded-md border border-black/10 bg-white/75 p-3 dark:border-white/10 dark:bg-white/5">
              <div className="mb-3 font-black">{member.name}</div>
              <ScheduleCell
                date={selectedDay}
                member={member}
                tasks={data.tasks.filter((task) => task.date === selectedDay && task.assigneeId === member.id)}
                duty={data.duties.find((duty) => duty.date === selectedDay && duty.assigneeId === member.id)}
                currentUserId={currentUserId}
                canManage={canManage}
                canCompleteOwn={canCompleteOwn}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-md border border-black/10 dark:border-white/10 lg:block">
        <table className="w-full min-w-[112rem] border-collapse text-sm">
          <thead>
            <tr className="bg-white/80 dark:bg-white/10">
              <th className="sticky left-0 z-20 w-44 border-r border-black/10 bg-white px-4 py-3 text-left font-black dark:border-white/10 dark:bg-ink">
                Osoba
              </th>
              {days.map((day, index) => {
                const covered = data.duties.some((duty) => duty.date === day);
                return (
                  <th key={day} className={`min-w-56 border-r border-black/10 px-3 py-3 text-left last:border-r-0 dark:border-white/10 ${index >= 5 ? "bg-amber-400/10" : ""}`}>
                    <div className="font-black capitalize">{formatDay(day)}</div>
                    {!covered ? <div className="mt-1 text-xs font-bold text-red-600 dark:text-red-300">Brak dyżuru</div> : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.members.map((member) => (
              <tr key={member.id} className="border-t border-black/10 align-top dark:border-white/10">
                <th className="sticky left-0 z-10 border-r border-black/10 bg-paper px-4 py-4 text-left dark:border-white/10 dark:bg-ink">
                  <div className="font-black">{member.name}</div>
                  {!isEditableMember(member) ? <div className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Historyczny</div> : null}
                </th>
                {days.map((day, index) => (
                  <td key={day} className={`border-r border-black/10 p-3 last:border-r-0 dark:border-white/10 ${index >= 5 ? "bg-amber-400/5" : "bg-white/45 dark:bg-white/[0.02]"}`}>
                    <ScheduleCell
                      date={day}
                      member={member}
                      tasks={data.tasks.filter((task) => task.date === day && task.assigneeId === member.id)}
                      duty={data.duties.find((duty) => duty.date === day && duty.assigneeId === member.id)}
                      currentUserId={currentUserId}
                      canManage={canManage}
                      canCompleteOwn={canCompleteOwn}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DutyCoverage({ days, duties }: { days: string[]; duties: ScheduleDuty[] }) {
  const missing = days.filter((day) => !duties.some((duty) => duty.date === day));
  return (
    <div className={`rounded-md px-3 py-2 text-sm font-bold ${missing.length === 0 ? "bg-green-500/10 text-green-700 dark:text-green-300" : "bg-red-500/10 text-red-700 dark:text-red-300"}`}>
      {missing.length === 0 ? "Dyżury obsadzone na wszystkie 7 dni" : `Brak dyżuru: ${missing.map(formatDay).join(", ")}`}
    </div>
  );
}

function ScheduleCell({
  date,
  member,
  tasks,
  duty,
  currentUserId,
  canManage,
  canCompleteOwn
}: {
  date: string;
  member: User;
  tasks: ScheduleTask[];
  duty?: ScheduleDuty;
  currentUserId: string;
  canManage: boolean;
  canCompleteOwn: boolean;
}) {
  const editableMember = isEditableMember(member);
  return (
    <div className="grid min-h-36 content-start gap-2">
      <div className="flex items-center justify-between gap-2">
        {duty ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-mint/15 px-2 py-1 text-xs font-black text-mint">
            <ShieldCheck size={13} /> Dyżur
          </span>
        ) : <span />}
        {canManage && editableMember ? (
          <form action={setScheduleDutyAction}>
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="assigneeId" value={member.id} />
            <input type="hidden" name="isOnCall" value={duty ? "false" : "true"} />
            <button type="submit" className="text-xs font-bold text-ink/55 hover:text-mint dark:text-paper/55">
              {duty ? "Usuń dyżur" : "+ Dyżur"}
            </button>
          </form>
        ) : null}
      </div>

      {tasks.map((task) => (
        <ScheduleTaskCard
          key={task.id}
          task={task}
          canManage={canManage}
          canToggle={canManage || (canCompleteOwn && task.assigneeId === currentUserId)}
        />
      ))}

      {tasks.length === 0 ? <div className="py-2 text-xs text-ink/40 dark:text-paper/40">Brak zadań</div> : null}

      {canManage && editableMember ? (
        <details className="mt-auto">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-bold text-mint">
            <Plus size={14} /> Dodaj zadanie
          </summary>
          <form action={createScheduleTaskAction} className="mt-2 grid gap-2 rounded-md border border-black/10 bg-white/80 p-2 dark:border-white/10 dark:bg-white/5">
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="assigneeId" value={member.id} />
            <input name="title" required minLength={2} maxLength={200} placeholder="Krótkie zadanie" className={inputClass} />
            <textarea name="description" maxLength={2000} placeholder="Opis (opcjonalnie)" className={`${inputClass} min-h-16 py-2`} />
            <button type="submit" className="h-8 rounded-md bg-mint px-3 text-xs font-bold text-white">Dodaj</button>
          </form>
        </details>
      ) : null}
    </div>
  );
}

function ScheduleTaskCard({ task, canManage, canToggle }: { task: ScheduleTask; canManage: boolean; canToggle: boolean }) {
  return (
    <div className={`rounded-md border p-2 ${task.isCompleted ? "border-green-500/20 bg-green-500/5" : "border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/5"}`}>
      <div className="flex items-start gap-2">
        {canToggle ? (
          <form action={toggleScheduleTaskAction}>
            <input type="hidden" name="id" value={task.id} />
            <button type="submit" aria-label={task.isCompleted ? "Oznacz jako niewykonane" : "Oznacz jako wykonane"} className="mt-0.5 text-mint">
              {task.isCompleted ? <Check size={16} /> : <Circle size={16} />}
            </button>
          </form>
        ) : <span className="mt-0.5 text-ink/30"><Circle size={16} /></span>}
        <div className="min-w-0 flex-1">
          <div className={`break-words text-xs font-bold ${task.isCompleted ? "line-through opacity-60" : ""}`}>{task.title}</div>
          {task.description ? <p className="mt-1 whitespace-pre-wrap break-words text-xs text-ink/60 dark:text-paper/60">{task.description}</p> : null}
        </div>
      </div>
      {canManage ? (
        <details className="mt-2 border-t border-black/5 pt-2 dark:border-white/5">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[11px] font-bold text-ink/50 hover:text-mint dark:text-paper/50">
            <Pencil size={12} /> Edytuj
          </summary>
          <form action={updateScheduleTaskAction} className="mt-2 grid gap-2">
            <input type="hidden" name="id" value={task.id} />
            <input name="title" defaultValue={task.title} required minLength={2} maxLength={200} className={inputClass} />
            <textarea name="description" defaultValue={task.description ?? ""} maxLength={2000} className={`${inputClass} min-h-16 py-2`} />
            <button type="submit" className="h-8 rounded-md bg-ink px-3 text-xs font-bold text-white dark:bg-paper dark:text-ink">Zapisz</button>
          </form>
          <form
            action={deleteScheduleTaskAction}
            className="mt-2"
            onSubmit={(event) => {
              if (!confirm(`Usunąć zadanie „${task.title}”?`)) event.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={task.id} />
            <button type="submit" className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-md bg-red-500/10 px-2 text-xs font-bold text-red-700 dark:text-red-200">
              <Trash2 size={13} /> Usuń
            </button>
          </form>
        </details>
      ) : null}
    </div>
  );
}

function isEditableMember(member: User): boolean {
  return Boolean(member.isActive && member.isScheduleMember && (member.role === "AGENT" || member.role === "ADMIN"));
}

function formatDay(date: string): string {
  return dayFormatter.format(new Date(`${date}T12:00:00Z`)).replace(",", "");
}

const inputClass = "h-9 w-full min-w-0 rounded-md border border-black/10 bg-white px-2 text-xs text-ink outline-none focus:border-mint dark:border-white/10 dark:bg-white/10 dark:text-paper";
