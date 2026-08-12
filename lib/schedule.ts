import { formatDateOnly, parseDateOnly } from "@/lib/format";

const SCHEDULE_DAYS = 7;

export function addScheduleDays(date: string, days: number): string {
  const parsed = parseDateOnly(date);
  if (!parsed) {
    throw new Error("Nieprawidłowa data grafiku.");
  }

  const value = new Date(`${parsed}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function resolveScheduleWeekStart(value?: string, today: Date = new Date()): string {
  const date = parseDateOnly(value) ?? formatDateOnly(today);
  const parsed = new Date(`${date}T12:00:00Z`);
  const day = parsed.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return addScheduleDays(date, -daysSinceMonday);
}

export function getScheduleWeekDays(weekStart: string): string[] {
  const monday = resolveScheduleWeekStart(weekStart);
  return Array.from({ length: SCHEDULE_DAYS }, (_, index) => addScheduleDays(monday, index));
}

export function isScheduleWeekend(date: string): boolean {
  const parsed = parseDateOnly(date);
  if (!parsed) {
    return false;
  }

  const day = new Date(`${parsed}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function scheduleDateValue(date: string): Date {
  const parsed = parseDateOnly(date);
  if (!parsed) {
    throw new Error("Nieprawidłowa data grafiku.");
  }
  return new Date(`${parsed}T00:00:00.000Z`);
}
