import "server-only";

import { addScheduleDays, isScheduleWeekend, resolveScheduleWeekStart, scheduleDateValue } from "@/lib/schedule";
import { mapScheduleDuty, mapScheduleTask, mapStoredUser, mapUser } from "@/lib/data-store-mappers";
import { getPrisma, id, now, readDatabase, shouldUsePrisma, withDatabase } from "@/lib/data-store-core";
import type { ScheduleDuty, ScheduleTask, User, WeeklyScheduleData } from "@/lib/types";

function sortScheduleMembers(members: User[]): User[] {
  const collator = new Intl.Collator("pl", { sensitivity: "base" });
  return [...members].sort((left, right) => {
    const orderDifference = (left.scheduleOrder ?? Number.MAX_SAFE_INTEGER) - (right.scheduleOrder ?? Number.MAX_SAFE_INTEGER);
    return orderDifference || collator.compare(left.name || left.email, right.name || right.email);
  });
}

function scheduleRange(weekStart: string): { weekStart: string; start: Date; end: Date } {
  const normalized = resolveScheduleWeekStart(weekStart);
  return {
    weekStart: normalized,
    start: scheduleDateValue(normalized),
    end: scheduleDateValue(addScheduleDays(normalized, 7))
  };
}

function isEligibleScheduleMember(user: User | undefined): boolean {
  return Boolean(user?.isActive && user.isScheduleMember && (user.role === "AGENT" || user.role === "ADMIN"));
}

export async function getWeeklySchedule(weekStart: string): Promise<WeeklyScheduleData> {
  const range = scheduleRange(weekStart);

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const [activeMembers, tasks, duties] = await Promise.all([
      db.user.findMany({
        where: { isActive: true, isScheduleMember: true, role: { in: ["AGENT", "ADMIN"] } }
      }),
      db.scheduleTask.findMany({
        where: { date: { gte: range.start, lt: range.end } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }]
      }),
      db.scheduleDuty.findMany({
        where: { date: { gte: range.start, lt: range.end } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }]
      })
    ]);

    const activeIds = new Set(activeMembers.map((member) => member.id));
    const historicalIds = [...new Set([...tasks.map((task) => task.assigneeId), ...duties.map((duty) => duty.assigneeId)])]
      .filter((id) => !activeIds.has(id));
    const historicalMembers = historicalIds.length > 0
      ? await db.user.findMany({ where: { id: { in: historicalIds } } })
      : [];

    return {
      weekStart: range.weekStart,
      members: sortScheduleMembers([...activeMembers, ...historicalMembers].map((user) => mapUser(user))),
      tasks: tasks.map(mapScheduleTask),
      duties: duties.map(mapScheduleDuty)
    };
  }

  const database = await readDatabase();
  const tasks = (database.scheduleTasks ?? [])
    .filter((task) => task.date >= range.weekStart && task.date < addScheduleDays(range.weekStart, 7))
    .sort((left, right) => left.date.localeCompare(right.date) || left.createdAt.localeCompare(right.createdAt));
  const duties = (database.scheduleDuties ?? [])
    .filter((duty) => duty.date >= range.weekStart && duty.date < addScheduleDays(range.weekStart, 7))
    .sort((left, right) => left.date.localeCompare(right.date) || left.createdAt.localeCompare(right.createdAt));
  const referencedIds = new Set([...tasks.map((task) => task.assigneeId), ...duties.map((duty) => duty.assigneeId)]);
  const members = database.users
    .filter((user) => isEligibleScheduleMember(user) || referencedIds.has(user.id))
    .map((user) => mapStoredUser(user));

  return { weekStart: range.weekStart, members: sortScheduleMembers(members), tasks, duties };
}

export async function findScheduleTask(id: string): Promise<ScheduleTask | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const task = await db.scheduleTask.findUnique({ where: { id } });
    return task ? mapScheduleTask(task) : undefined;
  }

  const database = await readDatabase();
  return database.scheduleTasks?.find((task) => task.id === id);
}

export async function createScheduleTask(input: {
  date: string;
  title: string;
  description?: string;
  assigneeId: string;
  actorId: string;
}): Promise<ScheduleTask> {
  const date = scheduleDateValue(input.date);

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const assignee = await db.user.findFirst({
      where: { id: input.assigneeId, isActive: true, isScheduleMember: true, role: { in: ["AGENT", "ADMIN"] } },
      select: { id: true }
    });
    if (!assignee) {
      throw new Error("Wybrany użytkownik nie jest aktywnym członkiem grafiku.");
    }

    const task = await db.scheduleTask.create({
      data: {
        date,
        title: input.title,
        description: input.description,
        assigneeId: input.assigneeId,
        createdById: input.actorId,
        updatedById: input.actorId
      }
    });
    return mapScheduleTask(task);
  }

  return withDatabase((database) => {
    const assignee = database.users.find((user) => user.id === input.assigneeId);
    if (!isEligibleScheduleMember(assignee)) {
      throw new Error("Wybrany użytkownik nie jest aktywnym członkiem grafiku.");
    }

    const timestamp = now();
    const task: ScheduleTask = {
      id: id("schedule-task"),
      date: input.date,
      title: input.title,
      description: input.description,
      isCompleted: false,
      assigneeId: input.assigneeId,
      createdById: input.actorId,
      updatedById: input.actorId,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    database.scheduleTasks ??= [];
    database.scheduleTasks.push(task);
    return task;
  });
}

export async function updateScheduleTask(input: {
  id: string;
  title: string;
  description?: string;
  actorId: string;
}): Promise<ScheduleTask | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const existing = await db.scheduleTask.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!existing) return undefined;
    return mapScheduleTask(await db.scheduleTask.update({
      where: { id: input.id },
      data: { title: input.title, description: input.description, updatedById: input.actorId }
    }));
  }

  return withDatabase((database) => {
    const task = database.scheduleTasks?.find((item) => item.id === input.id);
    if (!task) return undefined;
    task.title = input.title;
    task.description = input.description;
    task.updatedById = input.actorId;
    task.updatedAt = now();
    return task;
  });
}

export async function toggleScheduleTask(input: { id: string; actorId: string }): Promise<ScheduleTask | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const existing = await db.scheduleTask.findUnique({ where: { id: input.id } });
    if (!existing) return undefined;
    return mapScheduleTask(await db.scheduleTask.update({
      where: { id: input.id },
      data: { isCompleted: !existing.isCompleted, updatedById: input.actorId }
    }));
  }

  return withDatabase((database) => {
    const task = database.scheduleTasks?.find((item) => item.id === input.id);
    if (!task) return undefined;
    task.isCompleted = !task.isCompleted;
    task.updatedById = input.actorId;
    task.updatedAt = now();
    return task;
  });
}

export async function deleteScheduleTask(id: string): Promise<boolean> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const deleted = await db.scheduleTask.deleteMany({ where: { id } });
    return deleted.count > 0;
  }

  return withDatabase((database) => {
    const tasks = database.scheduleTasks ?? [];
    const index = tasks.findIndex((task) => task.id === id);
    if (index === -1) return false;
    tasks.splice(index, 1);
    return true;
  });
}

export async function setScheduleDuty(input: {
  date: string;
  assigneeId: string;
  isOnCall: boolean;
  actorId: string;
}): Promise<ScheduleDuty | undefined> {
  const date = scheduleDateValue(input.date);

  if (input.isOnCall && !isScheduleWeekend(input.date)) {
    throw new Error("Dyżur można ustawić tylko w sobotę lub niedzielę.");
  }

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    if (!input.isOnCall) {
      await db.scheduleDuty.deleteMany({ where: { date, assigneeId: input.assigneeId } });
      return undefined;
    }

    const assignee = await db.user.findFirst({
      where: { id: input.assigneeId, isActive: true, isScheduleMember: true, role: { in: ["AGENT", "ADMIN"] } },
      select: { id: true }
    });
    if (!assignee) {
      throw new Error("Wybrany użytkownik nie jest aktywnym członkiem grafiku.");
    }

    return mapScheduleDuty(await db.scheduleDuty.upsert({
      where: { date_assigneeId: { date, assigneeId: input.assigneeId } },
      create: { date, assigneeId: input.assigneeId, createdById: input.actorId },
      update: {}
    }));
  }

  return withDatabase((database) => {
    database.scheduleDuties ??= [];
    const existingIndex = database.scheduleDuties.findIndex(
      (duty) => duty.date === input.date && duty.assigneeId === input.assigneeId
    );
    if (!input.isOnCall) {
      if (existingIndex >= 0) database.scheduleDuties.splice(existingIndex, 1);
      return undefined;
    }

    const assignee = database.users.find((user) => user.id === input.assigneeId);
    if (!isEligibleScheduleMember(assignee)) {
      throw new Error("Wybrany użytkownik nie jest aktywnym członkiem grafiku.");
    }
    if (existingIndex >= 0) return database.scheduleDuties[existingIndex];

    const duty: ScheduleDuty = {
      id: id("schedule-duty"),
      date: input.date,
      assigneeId: input.assigneeId,
      createdById: input.actorId,
      createdAt: now()
    };
    database.scheduleDuties.push(duty);
    return duty;
  });
}

export async function copyPreviousScheduleWeek(input: {
  targetWeekStart: string;
  actorId: string;
}): Promise<{ taskCount: number; dutyCount: number }> {
  const target = scheduleRange(input.targetWeekStart);
  const sourceWeekStart = addScheduleDays(target.weekStart, -7);
  const source = scheduleRange(sourceWeekStart);

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    try {
      return await db.$transaction(async (tx) => {
        const [targetTasks, targetDuties] = await Promise.all([
          tx.scheduleTask.count({ where: { date: { gte: target.start, lt: target.end } } }),
          tx.scheduleDuty.count({ where: { date: { gte: target.start, lt: target.end } } })
        ]);
        if (targetTasks > 0 || targetDuties > 0) {
          throw new Error("Docelowy tydzień nie jest pusty.");
        }

        const activeMembers = await tx.user.findMany({
          where: { isActive: true, isScheduleMember: true, role: { in: ["AGENT", "ADMIN"] } },
          select: { id: true }
        });
        const memberIds = activeMembers.map((member) => member.id);
        const [tasks, sourceDuties] = await Promise.all([
          tx.scheduleTask.findMany({ where: { date: { gte: source.start, lt: source.end }, assigneeId: { in: memberIds } } }),
          tx.scheduleDuty.findMany({ where: { date: { gte: source.start, lt: source.end }, assigneeId: { in: memberIds } } })
        ]);
        const duties = sourceDuties.filter((duty) => isScheduleWeekend(duty.date.toISOString().slice(0, 10)));
        if (tasks.length === 0 && duties.length === 0) {
          throw new Error("Poprzedni tydzień nie zawiera danych do skopiowania.");
        }

        if (tasks.length > 0) {
          await tx.scheduleTask.createMany({
            data: tasks.map((task) => ({
              date: scheduleDateValue(addScheduleDays(task.date.toISOString().slice(0, 10), 7)),
              title: task.title,
              description: task.description,
              isCompleted: false,
              assigneeId: task.assigneeId,
              createdById: input.actorId,
              updatedById: input.actorId
            }))
          });
        }
        if (duties.length > 0) {
          await tx.scheduleDuty.createMany({
            data: duties.map((duty) => ({
              date: scheduleDateValue(addScheduleDays(duty.date.toISOString().slice(0, 10), 7)),
              assigneeId: duty.assigneeId,
              createdById: input.actorId
            }))
          });
        }

        return { taskCount: tasks.length, dutyCount: duties.length };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
        throw new Error("Grafik został równocześnie zmieniony. Odśwież stronę i spróbuj ponownie.");
      }
      throw error;
    }
  }

  return withDatabase((database) => {
    database.scheduleTasks ??= [];
    database.scheduleDuties ??= [];
    const targetEnd = addScheduleDays(target.weekStart, 7);
    if (
      database.scheduleTasks.some((task) => task.date >= target.weekStart && task.date < targetEnd) ||
      database.scheduleDuties.some((duty) => duty.date >= target.weekStart && duty.date < targetEnd)
    ) {
      throw new Error("Docelowy tydzień nie jest pusty.");
    }

    const activeMemberIds = new Set(database.users.filter(isEligibleScheduleMember).map((user) => user.id));
    const sourceEnd = addScheduleDays(source.weekStart, 7);
    const tasks = database.scheduleTasks.filter(
      (task) => task.date >= source.weekStart && task.date < sourceEnd && activeMemberIds.has(task.assigneeId)
    );
    const duties = database.scheduleDuties.filter(
      (duty) => duty.date >= source.weekStart && duty.date < sourceEnd && activeMemberIds.has(duty.assigneeId) && isScheduleWeekend(duty.date)
    );
    if (tasks.length === 0 && duties.length === 0) {
      throw new Error("Poprzedni tydzień nie zawiera danych do skopiowania.");
    }

    const timestamp = now();
    database.scheduleTasks.push(...tasks.map((task) => ({
      ...task,
      id: id("schedule-task"),
      date: addScheduleDays(task.date, 7),
      isCompleted: false,
      createdById: input.actorId,
      updatedById: input.actorId,
      createdAt: timestamp,
      updatedAt: timestamp
    })));
    database.scheduleDuties.push(...duties.map((duty) => ({
      ...duty,
      id: id("schedule-duty"),
      date: addScheduleDays(duty.date, 7),
      createdById: input.actorId,
      createdAt: timestamp
    })));
    return { taskCount: tasks.length, dutyCount: duties.length };
  });
}
