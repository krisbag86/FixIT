import "server-only";

import { mapDayLogEntry } from "@/lib/data-store-mappers";
import { getPrisma, id, nextTimestamp, now, readDatabase, shouldUsePrisma, withDatabase } from "@/lib/data-store-core";
import type { DayLogEntry } from "@/lib/types";

export async function listDayLogEntries(): Promise<DayLogEntry[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const entries = await db.dayLogEntry.findMany({
      include: {
        createdBy: { select: { name: true, email: true } },
        ticket: { select: { id: true, number: true } }
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
    });
    return entries.map(mapDayLogEntry);
  }

  const database = await readDatabase();
  return [...(database.dayLogEntries ?? [])]
    .map((entry) => ({
      ...entry,
      createdByName: database.users.find((user) => user.id === entry.createdById)?.name,
      createdByEmail: database.users.find((user) => user.id === entry.createdById)?.email,
      ticketNumber: database.tickets.find((ticket) => ticket.id === entry.ticketId)?.number
    }))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt));
}

export async function findDayLogEntry(id: string): Promise<DayLogEntry | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const entry = await db.dayLogEntry.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true, email: true } },
        ticket: { select: { id: true, number: true } }
      }
    });
    return entry ? mapDayLogEntry(entry) : undefined;
  }

  const database = await readDatabase();
  const entry = database.dayLogEntries?.find((item) => item.id === id);
  if (!entry) {
    return undefined;
  }

  const author = database.users.find((user) => user.id === entry.createdById);
  return {
    ...entry,
    createdByName: author?.name,
    createdByEmail: author?.email,
    ticketNumber: database.tickets.find((ticket) => ticket.id === entry.ticketId)?.number
  };
}

export async function createDayLogEntry(input: {
  occurredAt: string;
  fromName: string;
  subject: string;
  description: string;
  createdById: string;
}): Promise<DayLogEntry> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const entry = await db.dayLogEntry.create({
      data: {
        occurredAt: new Date(input.occurredAt),
        fromName: input.fromName,
        subject: input.subject,
        description: input.description,
        createdById: input.createdById
      },
      include: {
        createdBy: { select: { name: true, email: true } },
        ticket: { select: { id: true, number: true } }
      }
    });
    return mapDayLogEntry(entry);
  }

  return withDatabase((database) => {
    const timestamp = now();
    const author = database.users.find((user) => user.id === input.createdById);
    const entry: DayLogEntry = {
      id: id("daylog"),
      occurredAt: input.occurredAt,
      fromName: input.fromName,
      subject: input.subject,
      description: input.description,
      createdById: input.createdById,
      createdByName: author?.name,
      createdByEmail: author?.email,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    database.dayLogEntries ??= [];
    database.dayLogEntries.push(entry);
    return entry;
  });
}

export async function updateDayLogEntry(input: {
  id: string;
  occurredAt: string;
  fromName: string;
  subject: string;
  description: string;
}): Promise<DayLogEntry | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const existing = await db.dayLogEntry.findUnique({ where: { id: input.id } });
    if (!existing) {
      return undefined;
    }

    const entry = await db.dayLogEntry.update({
      where: { id: input.id },
      data: {
        occurredAt: new Date(input.occurredAt),
        fromName: input.fromName,
        subject: input.subject,
        description: input.description
      },
      include: {
        createdBy: { select: { name: true, email: true } },
        ticket: { select: { id: true, number: true } }
      }
    });

    return mapDayLogEntry(entry);
  }

  return withDatabase((database) => {
    const entry = database.dayLogEntries?.find((item) => item.id === input.id);
    if (!entry) {
      return undefined;
    }

    entry.occurredAt = input.occurredAt;
    entry.fromName = input.fromName;
    entry.subject = input.subject;
    entry.description = input.description;
    entry.updatedAt = nextTimestamp(entry.updatedAt);
    return entry;
  });
}

export async function deleteDayLogEntry(id: string): Promise<boolean> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const existing = await db.dayLogEntry.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return false;
    }

    await db.dayLogEntry.delete({ where: { id } });
    return true;
  }

  return withDatabase((database) => {
    const entries = database.dayLogEntries ?? [];
    const index = entries.findIndex((entry) => entry.id === id);
    if (index === -1) {
      return false;
    }

    entries.splice(index, 1);
    return true;
  });
}
