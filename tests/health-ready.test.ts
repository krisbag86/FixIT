import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getPrisma: vi.fn(),
  readDatabase: vi.fn(),
  shouldUsePrisma: vi.fn()
}));

vi.mock("@/lib/data-store-core", () => mocks);

describe("readiness health endpoint", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.FIXIT_DATA_PROVIDER = "json";
    mocks.shouldUsePrisma.mockReturnValue(false);
    mocks.readDatabase.mockResolvedValue({});
  });

  it("returns ready when the configured data provider is available", async () => {
    const { GET } = await import("@/app/api/health/ready/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ready",
      checks: { database: "ok", storage: "ok" }
    });
  });

  it("returns 503 when the database check fails", async () => {
    mocks.readDatabase.mockRejectedValue(new Error("database unavailable"));
    const { GET } = await import("@/app/api/health/ready/route");
    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "not_ready",
      checks: { database: "error", storage: "ok" }
    });
  });
});
