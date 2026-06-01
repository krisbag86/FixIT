import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("Prisma client singleton", () => {
  const run = process.env.DATABASE_URL ? it : it.skip;

  run("executes a basic Prisma query", async () => {
    const { prisma } = await import("@/lib/prisma");
    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    expect(result[0]?.ok).toBe(1);
    await prisma.$disconnect();
  });
});
