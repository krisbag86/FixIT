import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Minimal health check — no operational details exposed to potential attackers
  let database = "unknown";

  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    database = "connected";
  } catch {
    database = "disconnected";
  }

  const isHealthy = database === "connected";

  return NextResponse.json(
    { status: isHealthy ? "ok" : "degraded" },
    { status: isHealthy ? 200 : 503 }
  );
}
