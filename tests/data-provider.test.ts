import { afterEach, describe, expect, it, vi } from "vitest";
import { shouldUsePrisma } from "@/lib/data-provider";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("shouldUsePrisma", () => {
  it("forces the json store when FIXIT_DATA_PROVIDER=json", () => {
    vi.stubEnv("FIXIT_DATA_PROVIDER", "json");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/fixit");

    expect(shouldUsePrisma()).toBe(false);
  });

  it("forces prisma when FIXIT_DATA_PROVIDER=prisma", () => {
    vi.stubEnv("FIXIT_DATA_PROVIDER", "prisma");
    vi.stubEnv("NODE_ENV", "development");

    expect(shouldUsePrisma()).toBe(true);
  });

  it("defaults to prisma in production with DATABASE_URL set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/fixit");

    expect(shouldUsePrisma()).toBe(true);
  });

  it("defaults to json outside production even with DATABASE_URL set", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/fixit");

    expect(shouldUsePrisma()).toBe(false);
  });

  it("defaults to json in production without DATABASE_URL", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(shouldUsePrisma()).toBe(false);
  });
});
