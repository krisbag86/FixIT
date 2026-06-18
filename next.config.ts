import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Hide Next.js version from potential attackers
  poweredByHeader: false,
  outputFileTracingRoot: projectRoot,
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
