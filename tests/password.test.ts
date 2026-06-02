import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("hashes and verifies a password correctly", () => {
    const stored = hashPassword("admin123");
    expect(stored).toContain(":");
    const [salt, hash] = stored.split(":");
    expect(salt.length).toBe(32); // 16 bytes = 32 hex chars
    expect(hash.length).toBe(128); // 64 bytes = 128 hex chars
  });

  it("verifies correct password", () => {
    const stored = hashPassword("admin123");
    expect(verifyPassword("admin123", stored)).toBe(true);
  });

  it("rejects wrong password", () => {
    const stored = hashPassword("admin123");
    expect(verifyPassword("wrongpass", stored)).toBe(false);
  });

  it("rejects empty password", () => {
    const stored = hashPassword("admin123");
    expect(verifyPassword("", stored)).toBe(false);
  });

  it("rejects malformed stored hash", () => {
    expect(verifyPassword("admin123", "not-a-hash")).toBe(false);
    expect(verifyPassword("admin123", "")).toBe(false);
  });

  it("produces different hashes for same password (random salt)", () => {
    const h1 = hashPassword("admin123");
    const h2 = hashPassword("admin123");
    expect(h1).not.toBe(h2);
  });

  it("verifies the seed password hash", () => {
    // Pre-computed hash for 'admin123'
    const seedHash = "bbee40413ae94dfc2d463f51eb1fc703:6c6e44a5d1b3798fa02baa515a3cd85b5a04d195425c807cc5cc235546d02e4257355007fa1ea67e3a1cf8b6af1495828d23232b12aa63dc97fc3935abd35bbe";
    expect(verifyPassword("admin123", seedHash)).toBe(true);
    expect(verifyPassword("wrong", seedHash)).toBe(false);
  });
});
