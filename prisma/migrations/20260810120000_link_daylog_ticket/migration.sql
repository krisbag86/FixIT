-- Link a DayLog note to at most one ticket created from it.
ALTER TABLE "DayLogEntry" ADD COLUMN "ticketId" TEXT;

CREATE UNIQUE INDEX "DayLogEntry_ticketId_key" ON "DayLogEntry"("ticketId");

ALTER TABLE "DayLogEntry"
ADD CONSTRAINT "DayLogEntry_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
