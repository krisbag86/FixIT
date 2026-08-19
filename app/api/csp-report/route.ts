import { reportError } from "@/lib/sentry";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limiter";
import { readRequestBody } from "@/lib/request-body";

const MAX_CSP_REPORT_BYTES = 16 * 1024;
const MAX_CSP_REPORTS_PER_REQUEST = 10;

export async function POST(request: Request): Promise<Response> {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!["application/csp-report", "application/json", "application/reports+json"].some((type) => contentType.includes(type))) {
      return new Response(null, { status: 204 });
    }

    const body = await readRequestBody(request, MAX_CSP_REPORT_BYTES);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body);

    let report: unknown;
    try {
      report = JSON.parse(text);
    } catch {
      return new Response(null, { status: 204 });
    }

    const summaries = normalizeCspReports(report)
      .map(extractCspSummary)
      .filter((summary): summary is string => summary !== null);
    if (summaries.length === 0) return new Response(null, { status: 204 });

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown";
    const clientRateCheck = await checkRateLimit(
      `csp-report:${clientIp}`,
      RATE_LIMITS.CSP_CLIENT.windowMs,
      RATE_LIMITS.CSP_CLIENT.maxAttempts
    );
    if (!clientRateCheck.allowed) return new Response(null, { status: 204 });

    const globalRateCheck = await checkRateLimit(
      "csp-report:global",
      RATE_LIMITS.CSP_GLOBAL.windowMs,
      RATE_LIMITS.CSP_GLOBAL.maxAttempts
    );
    if (!globalRateCheck.allowed) return new Response(null, { status: 204 });

    for (const summary of summaries) {
      console.warn(`[CSP Violation] ${summary}`);
      reportError(new Error(`CSP violation: ${summary}`), { type: "csp-violation" });
    }
  } catch {
    // Browsers ignore the response; malformed or oversized reports are dropped.
  }

  return new Response(null, { status: 204 });
}

function normalizeCspReports(report: unknown): unknown[] {
  const reports = Array.isArray(report) ? report.slice(0, MAX_CSP_REPORTS_PER_REQUEST) : [report];
  return reports.map((item) => item && typeof item === "object" && "body" in item
    ? (item as Record<string, unknown>).body
    : item);
}

function extractCspSummary(report: unknown): string | null {
  if (!report || typeof report !== "object") return null;

  const cspReport = "csp-report" in report
    ? (report as Record<string, unknown>)["csp-report"]
    : report;
  if (!cspReport || typeof cspReport !== "object") return null;

  const record = cspReport as Record<string, unknown>;
  const blockedUri = safeUrl(field(record, "blocked-uri", "blockedURL"));
  const violatedDirective = safeField(field(record, "violated-directive", "effectiveDirective"), 120);
  const documentUri = safeUrl(field(record, "document-uri", "documentURL"));
  const originalPolicyValue = field(record, "original-policy", "originalPolicy");
  const originalPolicy = typeof originalPolicyValue === "string" ? safeField(originalPolicyValue, 120) : "";

  let summary = `${violatedDirective} blocked ${blockedUri} on ${documentUri}`;
  if (originalPolicy) summary += ` | policy: ${originalPolicy}`;
  return summary;
}

function field(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
}

function safeField(value: unknown, maxLength = 256): string {
  if (typeof value !== "string") return "unknown";
  const printable = [...value]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");
  return printable.slice(0, maxLength) || "unknown";
}

function safeUrl(value: unknown): string {
  const sanitized = safeField(value);
  if (sanitized === "unknown") return sanitized;
  try {
    const parsed = new URL(sanitized);
    return `${parsed.origin}${parsed.pathname}`.slice(0, 256);
  } catch {
    return sanitized.slice(0, 256);
  }
}
