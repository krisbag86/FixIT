-- CreateTable
CREATE TABLE "DayLogEntry" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DayLogEntry_occurredAt_idx" ON "DayLogEntry"("occurredAt");

-- CreateIndex
CREATE INDEX "DayLogEntry_createdById_idx" ON "DayLogEntry"("createdById");

-- AddForeignKey
ALTER TABLE "DayLogEntry" ADD CONSTRAINT "DayLogEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
