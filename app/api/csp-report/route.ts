import { reportError } from "@/lib/sentry";

/**
 * CSP violation report endpoint.
 *
 * Browsers POST violation reports here whenever a resource is blocked
 * by the Content Security Policy. This endpoint logs the violation for
 * monitoring and debugging purposes.
 *
 * The endpoint:
 * - Rejects non-POST requests
 * - Accepts both JSON and application/csp-report content types
 * - Logs to console.warn in development
 * - Reports to Sentry in production
 * - Always returns 204 No Content (browsers don't care about the response)
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const contentType = request.headers.get("content-type") || "";

    let report: unknown;

    if (contentType.includes("application/csp-report")) {
      // Legacy CSP report format (deprecated but still used by some browsers)
      const text = await request.text();
      try {
        report = JSON.parse(text);
      } catch {
        report = { "csp-report": { "unknown": text } };
      }
    } else {
      // Modern JSON format
      report = await request.json();
    }

    // Extract a readable summary from the report
    const summary = extractCspSummary(report);
    console.warn(`[CSP Violation] ${summary}`);

    // Report to Sentry for production monitoring
    reportError(new Error(`CSP violation: ${summary}`), {
      type: "csp-violation",
      report: JSON.stringify(report)
    });
  } catch {
    // Silently ignore malformed reports — don't let CSP reporting become an attack vector
  }

  return new Response(null, { status: 204 });
}

function extractCspSummary(report: unknown): string {
  if (!report || typeof report !== "object") return "Malformed report";

  // Modern format: { "csp-report": { ... } }
  const cspReport = "csp-report" in report
    ? (report as Record<string, unknown>)["csp-report"]
    : report;

  if (!cspReport || typeof cspReport !== "object") return "Malformed report body";

  const r = cspReport as Record<string, string>;

  const blockedUri = r["blocked-uri"] || r["blockedURL"] || "unknown";
  const violatedDirective = r["violated-directive"] || r["effectiveDirective"] || "unknown";
  const documentUri = r["document-uri"] || r["documentURL"] || "unknown";
  const originalPolicy = r["original-policy"] || "";

  let summary = `${violatedDirective} blocked ${blockedUri} on ${documentUri}`;
  if (originalPolicy) {
    // Truncate policy to avoid overly long summary strings
    summary += ` | policy: ${originalPolicy.slice(0, 120)}`;
  }

  return summary;
}
