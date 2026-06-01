-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN "sentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NotificationLog" ALTER COLUMN "status" SET DEFAULT 'QUEUED';

-- AlterTable
ALTER TABLE "NotificationLog" ALTER COLUMN "status" TYPE "NotificationStatus" USING ("status"::"NotificationStatus");

