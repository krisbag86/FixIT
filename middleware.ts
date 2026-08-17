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
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    // Next.js requires 'unsafe-inline' for client-side hydration scripts.
    // In a future upgrade, migrate to nonce-based CSP for stricter control.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "script-src-attr 'none'",
    // Google Fonts (Inter/JetBrains Mono) referenced by globals.css
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
    "report-uri /api/csp-report"
  ].join("; ")
};

/**
 * CSRF protection: validate Origin / Referer header on state-changing
 * API requests (POST, PUT, PATCH, DELETE) to API routes.
 * Server actions have built-in CSRF protection via Next.js action IDs.
 */
export function isCSRFProtected(request: NextRequest): boolean {
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

  const expectedOrigin = getExpectedOrigin(request);

  // Production must use the configured public origin. Deriving it from the
  // Host header would let a caller choose the origin used for validation.
  if (!expectedOrigin) {
    return false;
  }

  // Check Origin header if present
  if (origin && !isSameOrigin(origin, expectedOrigin)) {
    return false;
  }

  // Check Referer header if present (and Origin wasn't)
  if (!origin && referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.origin !== expectedOrigin) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

function getExpectedOrigin(request: NextRequest): string | undefined {
  const configuredUrl = process.env.APP_URL?.trim();

  if (configuredUrl) {
    try {
      return new URL(configuredUrl).origin;
    } catch {
      return undefined;
    }
  }

  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  return request.nextUrl.origin;
}

function isSameOrigin(candidate: string, expectedOrigin: string): boolean {
  try {
    return new URL(candidate).origin === expectedOrigin;
  } catch {
    return false;
  }
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
