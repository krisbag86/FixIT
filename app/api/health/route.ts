import { NextResponse } from "next/server";
import { shouldUsePrisma } from "@/lib/data-provider";

export const dynamic = "force-dynamic";

export async function GET() {
  // Minimal health check — no operational details exposed to potential attackers
  let database = "unknown";
  let isHealthy = true;

  if (shouldUsePrisma()) {
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$queryRaw`SELECT 1`;
      database = "connected";
      isHealthy = true;
    } catch {
      database = "disconnected";
      isHealthy = false;
    }
  } else {
    // JSON file store is the dev/fallback provider — no database to ping.
    database = "json";
    isHealthy = true;
  }

  return NextResponse.json(
    { status: isHealthy ? "ok" : "degraded", provider: database },
    { status: isHealthy ? 200 : 503 }
  );
}
