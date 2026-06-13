import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Security headers applied to all responses:
 * - CSP: restricts script/style sources to prevent XSS
 *   - report-uri: sends violation reports to the internal endpoint
 * - HSTS: enforces HTTPS
 * - X-Frame-Options: prevents clickjacking
 * - X-Content-Type-Options: prevents MIME sniffing
 * - Referrer-Policy: limits referrer leakage
 */
const securityHeaders: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "report-uri /api/csp-report"
  ].join("; ")
};

/**
 * CSRF protection: validate Origin / Referer header on state-changing
 * API requests (POST, PUT, PATCH, DELETE) to API routes.
 * Server actions have built-in CSRF protection via Next.js action IDs.
 */
function isCSRFProtected(request: NextRequest): boolean {
  // Only protect API routes (not server actions or page navigations)
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return true; // Not applicable
  }

  // Only protect state-changing methods
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    return true;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // Reject requests with no origin AND no referer for state-changing API methods
  // (browser-initiated requests always include Origin or Referer headers)
  if (!origin && !referer) {
    return false;
  }

  const expectedHost = request.headers.get("host") || "";
  const expectedOrigin = `https://${expectedHost}`;

  // Check Origin header if present
  if (origin && !origin.startsWith(expectedOrigin) && !origin.startsWith(`http://${expectedHost}`)) {
    return false;
  }

  // Check Referer header if present (and Origin wasn't)
  if (!origin && referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.origin !== expectedOrigin && refererUrl.origin !== `http://${expectedHost}`) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

export function middleware(request: NextRequest): NextResponse | undefined {
  // CSRF check for API routes
  if (!isCSRFProtected(request)) {
    const response = NextResponse.json(
      { error: "CSRF validation failed: nieprawidłowe źródło żądania." },
      { status: 403 }
    );

    // Apply security headers even on failed CSRF responses
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  const response = NextResponse.next();

  // Apply security headers to all responses
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: [
    // Apply to all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
