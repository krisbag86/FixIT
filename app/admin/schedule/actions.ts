"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  copyPreviousScheduleWeek,
  createScheduleTask,
  deleteScheduleTask,
  findScheduleTask,
  setScheduleDuty,
  toggleScheduleTask,
  updateScheduleTask
} from "@/lib/data-store";
import { sanitizeText } from "@/lib/escape-html";
import { parseDateOnly } from "@/lib/format";
import { can } from "@/lib/permissions";
import { resolveScheduleWeekStart } from "@/lib/schedule";

const dateSchema = z.string().refine((value) => Boolean(parseDateOnly(value)), "Nieprawidłowa data grafiku.");
const scheduleTaskSchema = z.object({
  date: dateSchema,
  assigneeId: z.string().min(1),
  title: z.string().min(2, "Zadanie jest za krótkie.").max(200, "Zadanie jest za długie."),
  description: z.string().max(2000, "Opis jest za długi.").optional()
});
const updateTaskSchema = scheduleTaskSchema.pick({ title: true, description: true }).extend({
  id: z.string().min(1)
});

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function optionalSanitizedText(formData: FormData, name: string): string | undefined {
  const value = sanitizeText(formString(formData, name));
  return value || undefined;
}

async function requireSchedulePermission(permission: "schedule:view" | "schedule:manage") {
  const user = await requireUser();
  if (!can(user, permission)) {
    throw new Error("Brak uprawnień do grafiku.");
  }
  return user;
}

function refreshSchedule(): void {
  revalidatePath("/admin/schedule");
}

export async function createScheduleTaskAction(formData: FormData): Promise<void> {
  const actor = await requireSchedulePermission("schedule:manage");
  const input = scheduleTaskSchema.parse({
    date: formString(formData, "date"),
    assigneeId: formString(formData, "assigneeId"),
    title: sanitizeText(formString(formData, "title")),
    description: optionalSanitizedText(formData, "description")
  });

  await createScheduleTask({ ...input, actorId: actor.id });
  refreshSchedule();
}

export async function updateScheduleTaskAction(formData: FormData): Promise<void> {
  const actor = await requireSchedulePermission("schedule:manage");
  const input = updateTaskSchema.parse({
    id: formString(formData, "id"),
    title: sanitizeText(formString(formData, "title")),
    description: optionalSanitizedText(formData, "description")
  });

  const updated = await updateScheduleTask({ ...input, actorId: actor.id });
  if (!updated) {
    throw new Error("Zadanie grafiku nie istnieje.");
  }
  refreshSchedule();
}

export async function toggleScheduleTaskAction(formData: FormData): Promise<void> {
  const actor = await requireSchedulePermission("schedule:view");
  const id = formString(formData, "id");
  const task = await findScheduleTask(id);
  if (!task) {
    throw new Error("Zadanie grafiku nie istnieje.");
  }
  if (!can(actor, "schedule:manage") && (!can(actor, "schedule:complete-own") || task.assigneeId !== actor.id)) {
    throw new Error("Możesz oznaczać tylko własne zadania.");
  }

  await toggleScheduleTask({ id, actorId: actor.id });
  refreshSchedule();
}

export async function deleteScheduleTaskAction(formData: FormData): Promise<void> {
  await requireSchedulePermission("schedule:manage");
  const deleted = await deleteScheduleTask(formString(formData, "id"));
  if (!deleted) {
    throw new Error("Zadanie grafiku nie istnieje.");
  }
  refreshSchedule();
}

export async function setScheduleDutyAction(formData: FormData): Promise<void> {
  const actor = await requireSchedulePermission("schedule:manage");
  const input = z.object({
    date: dateSchema,
    assigneeId: z.string().min(1),
    isOnCall: z.boolean()
  }).parse({
    date: formString(formData, "date"),
    assigneeId: formString(formData, "assigneeId"),
    isOnCall: formString(formData, "isOnCall") === "true"
  });

  await setScheduleDuty({ ...input, actorId: actor.id });
  refreshSchedule();
}

export async function copyPreviousScheduleWeekAction(formData: FormData): Promise<void> {
  const actor = await requireSchedulePermission("schedule:manage");
  const rawWeekStart = dateSchema.parse(formString(formData, "weekStart"));
  await copyPreviousScheduleWeek({
    targetWeekStart: resolveScheduleWeekStart(rawWeekStart),
    actorId: actor.id
  });
  refreshSchedule();
}
