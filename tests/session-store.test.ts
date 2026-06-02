import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock server-only for vitest
vi.mock("server-only", () => ({}));

const mockFindUserById = vi.fn();

// Shared mutable sessions array — persists across mock calls to readDatabase
const mockSessions: Array<{ id: string; userId: string; createdAt: string; expiresAt: string }> = [];

vi.mock("@/lib/data-store", () => ({
  findUserById: mockFindUserById,
  readDatabase: () =>
    Promise.resolve({
      meta: { ticketSequences: {} },
      users: [
        { id: "usr_admin", name: "Admin", email: "krzysztofgraczyk@bagietka.pl", role: "ADMIN", isActive: true }
      ],
      stores: [],
      categories: [],
      tickets: [],
      comments: [],
      attachments: [],
      events: [],
      knowledgeArticles: [],
      notificationLogs: [],
      adminAuditLogs: [],
      sessions: mockSessions
    }),
  writeDatabase: () => Promise.resolve()
}));

describe("session store (JSON mode)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessions.length = 0; // Reset sessions between tests
    mockFindUserById.mockImplementation((id: string) =>
      id === "usr_admin"
        ? { id: "usr_admin", name: "Admin", email: "krzysztofgraczyk@bagietka.pl", role: "ADMIN", isActive: true }
        : undefined
    );
  });

  it("creates a session and returns an opaque ID", async () => {
    const { createSession } = await import("@/lib/session-store");
    const sessionId = await createSession("usr_admin");

    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe("string");
    expect(sessionId.length).toBeGreaterThan(0);
    expect(mockSessions).toHaveLength(1);
  });

  it("getSessionUser returns the user for a valid session", async () => {
    const { createSession, getSessionUser } = await import("@/lib/session-store");
    const sessionId = await createSession("usr_admin");
    const user = await getSessionUser(sessionId);

    expect(user).toBeDefined();
    expect(user?.id).toBe("usr_admin");
    expect(user?.email).toBe("krzysztofgraczyk@bagietka.pl");
  });

  it("getSessionUser returns undefined for an invalid session ID", async () => {
    const { getSessionUser } = await import("@/lib/session-store");
    const user = await getSessionUser("nonexistent-session-id");

    expect(user).toBeUndefined();
  });

  it("deleteSession removes the session", async () => {
    const { createSession, getSessionUser, deleteSession } = await import("@/lib/session-store");
    const sessionId = await createSession("usr_admin");

    // Session exists before delete
    expect(await getSessionUser(sessionId)).toBeDefined();

    await deleteSession(sessionId);

    // Session is gone after delete
    expect(await getSessionUser(sessionId)).toBeUndefined();
    expect(mockSessions).toHaveLength(0);
  });

  it("getSessionUser returns undefined for deactivated user", async () => {
    mockFindUserById.mockImplementation(() => undefined); // user deactivated

    const { createSession, getSessionUser } = await import("@/lib/session-store");
    const sessionId = await createSession("usr_admin");

    const user = await getSessionUser(sessionId);
    expect(user).toBeUndefined();
  });

  it("creates different session IDs for subsequent calls", async () => {
    const { createSession } = await import("@/lib/session-store");
    const session1 = await createSession("usr_admin");
    const session2 = await createSession("usr_admin");

    expect(session1).not.toBe(session2);
    expect(mockSessions).toHaveLength(2);
  });
});
