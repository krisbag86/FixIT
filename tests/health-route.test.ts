import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/prisma");
    vi.unstubAllEnvs();
  });

  async function getHealth(): Promise<Response> {
    const { GET } = await import("@/app/api/health/route");
    return GET();
  }

  it("reports ok with the json provider when FIXIT_DATA_PROVIDER=json", async () => {
    vi.stubEnv("FIXIT_DATA_PROVIDER", "json");

    const res = await getHealth();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok", provider: "json" });
  });

  it("reports ok when the database is reachable", async () => {
    vi.stubEnv("FIXIT_DATA_PROVIDER", "prisma");
    vi.doMock("@/lib/prisma", () => ({
      prisma: { $queryRaw: vi.fn(async () => [{ ok: 1 }]) }
    }));

    const res = await getHealth();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok", provider: "connected" });
  });

  it("reports degraded with 503 when the database is unreachable", async () => {
    vi.stubEnv("FIXIT_DATA_PROVIDER", "prisma");
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        $queryRaw: vi.fn(async () => {
          throw new Error("connection refused");
        })
      }
    }));

    const res = await getHealth();

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ status: "degraded", provider: "disconnected" });
  });

  it("defaults to the json provider outside production even with DATABASE_URL", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/fixit");

    const res = await getHealth();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok", provider: "json" });
  });

  it("probes prisma in production when DATABASE_URL is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/fixit");
    const queryRaw = vi.fn(async () => [{ ok: 1 }]);
    vi.doMock("@/lib/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));

    const res = await getHealth();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok", provider: "connected" });
    expect(queryRaw).toHaveBeenCalled();
  });
});
