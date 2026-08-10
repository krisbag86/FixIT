ALTER TABLE "User"
ADD COLUMN "isScheduleMember" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "scheduleOrder" INTEGER;

CREATE TABLE "ScheduleTask" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "assigneeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScheduleTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleDuty" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleDuty_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScheduleTask_date_assigneeId_idx" ON "ScheduleTask"("date", "assigneeId");
CREATE INDEX "ScheduleTask_assigneeId_idx" ON "ScheduleTask"("assigneeId");
CREATE INDEX "ScheduleTask_isCompleted_idx" ON "ScheduleTask"("isCompleted");
CREATE UNIQUE INDEX "ScheduleDuty_date_assigneeId_key" ON "ScheduleDuty"("date", "assigneeId");
CREATE INDEX "ScheduleDuty_date_idx" ON "ScheduleDuty"("date");
CREATE INDEX "ScheduleDuty_assigneeId_idx" ON "ScheduleDuty"("assigneeId");

ALTER TABLE "ScheduleTask" ADD CONSTRAINT "ScheduleTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleTask" ADD CONSTRAINT "ScheduleTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleTask" ADD CONSTRAINT "ScheduleTask_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleDuty" ADD CONSTRAINT "ScheduleDuty_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleDuty" ADD CONSTRAINT "ScheduleDuty_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
