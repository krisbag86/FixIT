import { NextResponse } from "next/server";
import { getPrisma, readDatabase, shouldUsePrisma } from "@/lib/data-store-core";

export const dynamic = "force-dynamic";

type CheckStatus = "ok" | "error";

function storageIsConfigured(): boolean {
  const s3Requested = process.env.FIXIT_STORAGE_PROVIDER === "s3";
  const s3Configured = Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY &&
      process.env.S3_BUCKET
  );
  return !s3Requested || s3Configured;
}

export async function GET() {
  let database: CheckStatus = "ok";

  try {
    if (shouldUsePrisma()) {
      const prisma = await getPrisma();
      await prisma.$queryRaw`SELECT 1`;
    } else {
      await readDatabase();
    }
  } catch {
    database = "error";
  }

  const storage: CheckStatus = storageIsConfigured() ? "ok" : "error";
  const ready = database === "ok" && storage === "ok";

  return NextResponse.json(
    { status: ready ? "ready" : "not_ready", checks: { database, storage } },
    { status: ready ? 200 : 503 }
  );
}
