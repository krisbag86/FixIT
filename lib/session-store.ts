import "server-only";
import { randomUUID } from "node:crypto";

import { findUserById } from "@/lib/data-store";
import type { Session, User } from "@/lib/types";

const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

async function getPrisma() {
  return (await import("@/lib/prisma")).prisma;
}

function shouldUsePrisma(): boolean {
  if (process.env.FIXIT_DATA_PROVIDER === "json") return false;
  if (process.env.FIXIT_DATA_PROVIDER === "prisma") return true;
  return process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL);
}

/**
 * Create a new session for a user and return the opaque session ID.
 */
export async function createSession(userId: string): Promise<string> {
  const sessionId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    await db.session.create({
      data: {
        id: sessionId,
        userId,
        createdAt: now,
        expiresAt
      }
    });
    return sessionId;
  }

  // JSON store mode
  const { readDatabase, writeDatabase } = await import("@/lib/data-store");
  const database = await readDatabase();
  database.sessions.push({
    id: sessionId,
    userId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  });
  await writeDatabase(database);
  return sessionId;
}

/**
 * Look up a session by its opaque ID. Returns the user if the session
 * is valid and not expired. Automatically cleans up expired sessions.
 */
export async function getSessionUser(sessionId: string): Promise<User | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const session = await db.session.findUnique({ where: { id: sessionId } });

    if (!session) return undefined;
    if (new Date() > session.expiresAt) {
      // Clean up expired session
      await db.session.delete({ where: { id: sessionId } }).catch(() => {});
      return undefined;
    }

    return findUserById(session.userId);
  }

  // JSON store mode
  const { readDatabase, writeDatabase } = await import("@/lib/data-store");
  const database = await readDatabase();
  const idx = database.sessions.findIndex((s) => s.id === sessionId);

  if (idx === -1) return undefined;

  const session = database.sessions[idx];
  if (new Date() > new Date(session.expiresAt)) {
    // Clean up expired session
    database.sessions.splice(idx, 1);
    await writeDatabase(database);
    return undefined;
  }

  return findUserById(session.userId);
}

/**
 * Delete a session (e.g., on logout).
 */
export async function deleteSession(sessionId: string): Promise<void> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    await db.session.delete({ where: { id: sessionId } }).catch(() => {
      // Session may already be deleted — that's fine
    });
    return;
  }

  // JSON store mode
  const { readDatabase, writeDatabase } = await import("@/lib/data-store");
  const database = await readDatabase();
  const idx = database.sessions.findIndex((s) => s.id === sessionId);
  if (idx !== -1) {
    database.sessions.splice(idx, 1);
    await writeDatabase(database);
  }
}

/**
 * Delete all sessions for a given user (e.g., when user is deactivated).
 */
export async function deleteUserSessions(userId: string): Promise<void> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    await db.session.deleteMany({ where: { userId } });
    return;
  }

  const { readDatabase, writeDatabase } = await import("@/lib/data-store");
  const database = await readDatabase();
  database.sessions = database.sessions.filter((s) => s.userId !== userId);
  await writeDatabase(database);
}
