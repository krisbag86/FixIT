import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { isCSRFProtected } from "@/middleware";

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(headers: Record<string, string>): NextRequest {
  return new NextRequest("https://fixit.example/api/attachments/ticket/ticket-1", {
    method: "POST",
    headers
  });
}

describe("CSRF origin validation", () => {
  it("accepts the configured public origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://fixit.example");

    expect(isCSRFProtected(request({ origin: "https://fixit.example" }))).toBe(true);
  });

  it("rejects origin prefix attacks", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://fixit.example");

    expect(isCSRFProtected(request({ origin: "https://fixit.example.attacker.test" }))).toBe(false);
  });

  it("rejects production requests when the public origin is not configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "");

    expect(isCSRFProtected(request({ origin: "https://fixit.example" }))).toBe(false);
  });

  it("accepts an exact referer origin when Origin is absent", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://fixit.example");

    expect(isCSRFProtected(request({ referer: "https://fixit.example/tickets/1" }))).toBe(true);
  });
});
