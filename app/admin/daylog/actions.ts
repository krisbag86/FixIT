"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createDayLogEntry, deleteDayLogEntry, updateDayLogEntry } from "@/lib/data-store";
import { sanitizeText } from "@/lib/escape-html";
import { parseAppDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";

const dayLogSchema = z.object({
  occurredAt: z.string().min(1, "Podaj datę i godzinę."),
  fromName: z.string().trim().min(1, "Podaj, od kogo było zgłoszenie.").max(160),
  subject: z.string().trim().min(1, "Podaj temat.").max(200),
  description: z.string().trim().min(1, "Podaj opis.").max(10000)
});
const dayLogIdSchema = z.string().min(1, "Brak identyfikatora wpisu.");

async function requireDayLogAccess() {
  const user = await requireUser();

  if (!can(user, "ticket:view-all")) {
    throw new Error("Brak uprawnień do dziennika administratorów.");
  }

  return user;
}

function parseDayLogForm(formData: FormData) {
  const parsed = dayLogSchema.parse({
    occurredAt: String(formData.get("occurredAt") ?? ""),
    fromName: sanitizeText(String(formData.get("fromName") ?? "")),
    subject: sanitizeText(String(formData.get("subject") ?? "")),
    description: sanitizeText(String(formData.get("description") ?? ""))
  });
  const occurredAt = parseAppDateTime(parsed.occurredAt);

  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error("Podana data i godzina są nieprawidłowe.");
  }

  return { ...parsed, occurredAt: occurredAt.toISOString() };
}

export async function createDayLogEntryAction(formData: FormData): Promise<void> {
  const user = await requireDayLogAccess();
  const parsed = parseDayLogForm(formData);

  await createDayLogEntry({
    occurredAt: parsed.occurredAt,
    fromName: parsed.fromName,
    subject: parsed.subject,
    description: parsed.description,
    createdById: user.id
  });

  revalidatePath("/admin/daylog");
}

export async function updateDayLogEntryAction(formData: FormData): Promise<void> {
  await requireDayLogAccess();
  const id = dayLogIdSchema.parse(String(formData.get("id") ?? ""));
  const parsed = parseDayLogForm(formData);
  const updated = await updateDayLogEntry({ id, ...parsed });

  if (!updated) {
    throw new Error("Wpis DayLog nie istnieje.");
  }

  revalidatePath("/admin/daylog");
}

export async function deleteDayLogEntryAction(formData: FormData): Promise<void> {
  await requireDayLogAccess();
  const id = dayLogIdSchema.parse(String(formData.get("id") ?? ""));
  const deleted = await deleteDayLogEntry(id);

  if (!deleted) {
    throw new Error("Wpis DayLog nie istnieje.");
  }

  revalidatePath("/admin/daylog");
}
