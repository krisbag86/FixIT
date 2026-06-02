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

export default nextConfig;
