import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/types";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_noStore: () => {}
}));

let database: Database;

function mockDataStore() {
  vi.doMock("@/lib/data-store", () => ({
    readDatabase: async () => database,
    writeDatabase: async (nextDatabase: Database) => {
      database = nextDatabase;
    },
    withDatabase: async <T>(mutator: (database: Database) => T | Promise<T>): Promise<T> => mutator(database)
  }));
}

describe("setup tokens", () => {
  beforeEach(async () => {
    vi.resetModules();
    process.env.FIXIT_DATA_PROVIDER = "json";
    const { createSeedDatabase } = await import("@/lib/seed");
    database = createSeedDatabase();
    mockDataStore();
  });

  afterEach(async () => {
    vi.doUnmock("@/lib/data-store");
    delete process.env.FIXIT_DATA_PROVIDER;
  });

  it("creates an opaque token that can be consumed only once", async () => {
    const { createSetupToken, consumeSetupToken, verifySetupToken } = await import("@/lib/setup-token");

    const token = await createSetupToken("jan.kowalski@bagietka.pl");

    expect(token).toBeTruthy();
    expect(token).not.toContain("jan.kowalski@bagietka.pl");
    expect(await verifySetupToken(token)).toBe("jan.kowalski@bagietka.pl");
    expect(await consumeSetupToken(token)).toBe("jan.kowalski@bagietka.pl");
    expect(await verifySetupToken(token)).toBeNull();
    expect(await consumeSetupToken(token)).toBeNull();
  });

  it("rejects expired setup tokens", async () => {
    const { createSetupToken, verifySetupToken } = await import("@/lib/setup-token");
    const { readDatabase, writeDatabase } = await import("@/lib/data-store");

    const token = await createSetupToken("jan.kowalski@bagietka.pl");
    const database = await readDatabase();
    database.setupTokens[0].expiresAt = new Date(Date.now() - 1_000).toISOString();
    await writeDatabase(database);

    expect(await verifySetupToken(token)).toBeNull();
  });
});
