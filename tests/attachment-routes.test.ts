import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/auth");
  vi.doUnmock("@/lib/data-store");
  vi.doUnmock("@/lib/permissions");
  vi.doUnmock("@/lib/storage");
});

describe("attachment password-change gate", () => {
  it("blocks downloads before a temporary password is changed", async () => {
    vi.doMock("@/lib/auth", () => ({
      getCurrentUser: vi.fn(async () => ({ id: "usr_temp", role: "REPORTER", isActive: true, mustChangePassword: true }))
    }));
    vi.doMock("@/lib/data-store", () => ({
      findAttachment: vi.fn(),
      findTicket: vi.fn(),
      listComments: vi.fn()
    }));

    const { GET } = await import("@/app/api/attachments/[id]/route");
    const response = await GET(new Request("http://fixit.test/api/attachments/att-1"), { params: Promise.resolve({ id: "att-1" }) });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Najpierw ustaw nowe hasło." });
  });

  it("blocks uploads before a temporary password is changed", async () => {
    vi.doMock("@/lib/auth", () => ({
      getCurrentUser: vi.fn(async () => ({ id: "usr_temp", role: "REPORTER", isActive: true, mustChangePassword: true }))
    }));
    vi.doMock("@/lib/data-store", () => ({ findTicket: vi.fn() }));

    const { POST } = await import("@/app/api/attachments/ticket/[ticketId]/route");
    const response = await POST(new Request("http://fixit.test/api/attachments/ticket/tkt-1", { method: "POST" }), { params: Promise.resolve({ ticketId: "tkt-1" }) });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Najpierw ustaw nowe hasło." });
  });

  it("rejects an oversized upload before parsing multipart data", async () => {
    vi.doMock("@/lib/auth", () => ({
      getCurrentUser: vi.fn(async () => ({ id: "usr_reporter", role: "REPORTER", isActive: true, mustChangePassword: false }))
    }));
    vi.doMock("@/lib/data-store", () => ({
      findTicket: vi.fn(async () => ({ id: "tkt-1", reporterId: "usr_reporter" })),
      createAttachment: vi.fn(),
      listComments: vi.fn(async () => [])
    }));
    vi.doMock("@/lib/permissions", () => ({
      can: vi.fn(() => true),
      canViewTicket: vi.fn(() => true)
    }));

    const { POST } = await import("@/app/api/attachments/ticket/[ticketId]/route");
    const request = new Request("http://fixit.test/api/attachments/ticket/tkt-1", {
      method: "POST",
      headers: { "content-length": String(20 * 1024 * 1024) },
      body: "small"
    });
    const response = await POST(request, { params: Promise.resolve({ ticketId: "tkt-1" }) });

    expect(response.status).toBe(413);
  });
});
