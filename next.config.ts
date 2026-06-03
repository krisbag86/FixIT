import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide Next.js version from potential attackers
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  }
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "fixit-helpdesk",
  project: process.env.SENTRY_PROJECT ?? "fixit-helpdesk",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  webpack: {
    treeshake: {
      removeDebugLogging: true
    }
  },
  // Upload source maps for readable stack traces in Sentry
  sourcemaps: {
    disable: false
  }
});
