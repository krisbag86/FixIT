import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  reportError: vi.fn()
}));

vi.mock("@/lib/sentry", () => ({
  reportError: mocks.reportError
}));

function cspRequest(clientIp: string, body: unknown, contentType = "application/csp-report"): Request {
  return new Request("https://fixit.example/api/csp-report", {
    method: "POST",
    headers: {
      "content-type": contentType,
      "x-forwarded-for": clientIp
    },
    body: JSON.stringify(body)
  });
}

const legacyReport = {
  "csp-report": {
    "blocked-uri": "https://cdn.example/blocked.js?secret=discarded",
    "document-uri": "https://fixit.example/tickets/1?private=discarded",
    "violated-directive": "script-src"
  }
};

describe("CSP report route", () => {
  beforeEach(async () => {
    process.env.FIXIT_DATA_PROVIDER = "json";
    mocks.reportError.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { resetRateLimits } = await import("@/lib/rate-limiter");
    await resetRateLimits();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FIXIT_DATA_PROVIDER;
  });

  it("does not let one client exhaust another client's CSP report quota", async () => {
    const { POST } = await import("@/app/api/csp-report/route");

    for (let requestNumber = 0; requestNumber < 20; requestNumber += 1) {
      await POST(cspRequest("198.51.100.10", legacyReport));
    }
    await POST(cspRequest("198.51.100.11", legacyReport));

    expect(mocks.reportError).toHaveBeenCalledTimes(21);
  });

  it("forwards every CSP violation from a Reporting API batch and removes URL queries", async () => {
    const { POST } = await import("@/app/api/csp-report/route");
    const reports = [
      {
        type: "csp-violation",
        body: {
          blockedURL: "https://cdn.example/first.js?secret=discarded",
          documentURL: "https://fixit.example/first?private=discarded",
          effectiveDirective: "script-src"
        }
      },
      {
        type: "csp-violation",
        body: {
          blockedURL: "https://cdn.example/second.css?secret=discarded",
          documentURL: "https://fixit.example/second?private=discarded",
          effectiveDirective: "style-src"
        }
      }
    ];

    await POST(cspRequest("198.51.100.12", reports, "application/reports+json"));

    expect(mocks.reportError).toHaveBeenCalledTimes(2);
    expect(mocks.reportError.mock.calls[0]?.[0]).toHaveProperty(
      "message",
      "CSP violation: script-src blocked https://cdn.example/first.js on https://fixit.example/first"
    );
    expect(mocks.reportError.mock.calls[1]?.[0]).toHaveProperty(
      "message",
      "CSP violation: style-src blocked https://cdn.example/second.css on https://fixit.example/second"
    );
  });
});
