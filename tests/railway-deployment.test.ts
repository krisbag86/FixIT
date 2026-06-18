import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(fileName: string) {
  return readFileSync(path.join(root, fileName));
}

describe("Railway deployment guardrails", () => {
  it("keeps Prisma CLI available in the production image", () => {
    const packageJson = JSON.parse(readProjectFile("package.json").toString("utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.prisma).toBeDefined();
    expect(packageJson.devDependencies?.prisma).toBeUndefined();
  });

  it("installs dev dependencies for the Next.js build before pruning the runtime image", () => {
    const dockerfile = readProjectFile("Dockerfile").toString("utf8");

    expect(dockerfile).toContain("npm ci");
    expect(dockerfile).toContain("npm run db:generate && npm run build");
    expect(dockerfile).toContain("npm prune --omit=dev");
    expect(dockerfile.indexOf("npm run db:generate && npm run build")).toBeLessThan(
      dockerfile.indexOf("npm prune --omit=dev")
    );
    expect(dockerfile).not.toContain("npm ci --omit=dev");
  });

  it("keeps Railway build context files LF-only", () => {
    for (const fileName of [".dockerignore", ".gitignore", ".gitattributes", "Dockerfile", "railway.json"]) {
      expect(readProjectFile(fileName).includes(0x0d), `${fileName} contains CRLF line endings`).toBe(false);
    }
  });
});
