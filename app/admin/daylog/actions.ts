"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createDayLogEntry } from "@/lib/data-store";
import { sanitizeText } from "@/lib/escape-html";
import { parseAppDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";

const dayLogSchema = z.object({
  occurredAt: z.string().min(1, "Podaj datę i godzinę."),
  fromName: z.string().trim().min(1, "Podaj, od kogo było zgłoszenie.").max(160),
  subject: z.string().trim().min(1, "Podaj temat.").max(200),
  description: z.string().trim().min(1, "Podaj opis.").max(10000)
});

export async function createDayLogEntryAction(formData: FormData): Promise<void> {
  const user = await requireUser();

  if (!can(user, "ticket:view-all")) {
    throw new Error("Brak uprawnień do dziennika administratorów.");
  }

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

  await createDayLogEntry({
    occurredAt: occurredAt.toISOString(),
    fromName: parsed.fromName,
    subject: parsed.subject,
    description: parsed.description,
    createdById: user.id
  });

  revalidatePath("/admin/daylog");
}
