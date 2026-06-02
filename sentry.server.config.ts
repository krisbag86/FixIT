// Sentry server-side configuration
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring sample rate
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Capture IP addresses for context
  sendDefaultPii: true,

  // Only enable integration if DSN is configured
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),

  // Set environment
  environment: process.env.NODE_ENV ?? "development"
});
