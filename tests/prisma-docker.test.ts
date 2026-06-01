import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Prisma Docker workflow", () => {
  const root = process.cwd();

  it("defines package scripts for deploy migrations and seed", () => {
    const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      prisma?: { seed?: string };
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["db:migrate:deploy"]).toBe("prisma migrate deploy");
    expect(packageJson.scripts?.["db:seed"]).toBe("prisma db seed");
    expect(packageJson.prisma?.seed).toBe("node prisma/seed.mjs");
  });

  it("runs Prisma migration and seed jobs from Docker Compose", () => {
    const compose = readFileSync(path.join(root, "docker-compose.yml"), "utf8");

    expect(compose).toContain("migrate:");
    expect(compose).toContain("npm run db:migrate:deploy");
    expect(compose).toContain("seed:");
    expect(compose).toContain("npm run db:seed");
  });

  it("contains an initial Prisma migration", () => {
    const migrationsDir = path.join(root, "prisma", "migrations");

    expect(existsSync(migrationsDir)).toBe(true);
  });
});
