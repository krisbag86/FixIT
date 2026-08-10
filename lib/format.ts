export const APP_TIME_ZONE = "Europe/Warsaw";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

export function parseDateOnly(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    return undefined;
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return undefined;
  }

  return value;
}

export function formatDateOnly(value: string | Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatDateTimeLocal(value: string | Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "long",
    timeZone: APP_TIME_ZONE
  }).format(new Date(`${value}T12:00:00Z`));
}

/**
 * Parses a datetime-local value as a wall-clock time in the application's timezone.
 *
 * `new Date("2026-08-04T12:30")` is interpreted in the server's timezone. Since
 * Railway runs in UTC while the form is shown in Europe/Warsaw, doing that would
 * shift a submitted DayLog entry by two hours during summer time.
 */
export function parseAppDateTime(value: string): Date {
  const match = DATE_TIME_LOCAL_PATTERN.exec(value);
  if (!match) {
    return new Date(value);
  }

  const [, year, month, day, hour, minute, second = "0", fraction = ""] = match;
  const milliseconds = fraction ? Number(fraction.padEnd(3, "0")) : 0;
  const wallClockUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    milliseconds
  );
  const wallClockDate = new Date(wallClockUtc);

  const localParts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    })
      .formatToParts(wallClockDate)
      .map((part) => [part.type, part.value])
  );
  const timezoneWallClockUtc = Date.UTC(
    Number(localParts.year),
    Number(localParts.month) - 1,
    Number(localParts.day),
    Number(localParts.hour) % 24,
    Number(localParts.minute),
    Number(localParts.second)
  );

  return new Date(wallClockUtc - (timezoneWallClockUtc - wallClockUtc));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE
  }).format(new Date(value));
}

export function resolveTemplateVariables(
  template: string,
  context: {
    ticket: {
      title: string;
      number: string;
      description: string;
    };
    user?: {
      name: string;
      email: string;
    };
    assignee?: {
      name: string;
    };
    category?: {
      name: string;
    };
  }
): string {
  let result = template;

  result = result.replace(/\{\{ticket\.title\}\}/g, context.ticket.title);
  result = result.replace(/\{\{ticket\.number\}\}/g, context.ticket.number);
  result = result.replace(/\{\{ticket\.description\}\}/g, context.ticket.description);

  if (context.user) {
    result = result.replace(/\{\{user\.name\}\}/g, context.user.name);
    result = result.replace(/\{\{user\.email\}\}/g, context.user.email);
  } else {
    result = result.replace(/\{\{user\.name\}\}/g, "Nieznany");
    result = result.replace(/\{\{user\.email\}\}/g, "");
  }

  if (context.assignee) {
    result = result.replace(/\{\{assignee\.name\}\}/g, context.assignee.name);
  } else {
    result = result.replace(/\{\{assignee\.name\}\}/g, "nieprzypisany");
  }

  if (context.category) {
    result = result.replace(/\{\{category\.name\}\}/g, context.category.name);
  } else {
    result = result.replace(/\{\{category\.name\}\}/g, "");
  }

  return result;
}
