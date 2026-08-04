ALTER TABLE "Ticket" ADD COLUMN "submissionId" TEXT;

CREATE UNIQUE INDEX "Ticket_reporterId_submissionId_key" ON "Ticket"("reporterId", "submissionId");
