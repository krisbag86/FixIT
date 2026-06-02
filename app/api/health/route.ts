import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "connected";
  } catch (error) {
    checks.database = "disconnected";
    checks.status = "degraded";
    const message = error instanceof Error ? error.message : "Unknown database error";
    checks.databaseError = message;
  }

  const statusCode = checks.status === "ok" ? 200 : 503;

  return NextResponse.json(checks, { status: statusCode });
}
