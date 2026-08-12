/**
 * Sentry utility functions for server-side error monitoring.
 *
 * These are lightweight wrappers that work in both development and production.
 * In development without a DSN, Sentry is disabled (see sentry.server.config.ts).
 */
import * as Sentry from "@sentry/nextjs";

/**
 * Report an error to Sentry with optional context.
 * Safe to call even if Sentry is not configured (no-op).
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  if (context) {
    Sentry.withScope((scope) => {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value);
      }
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}
