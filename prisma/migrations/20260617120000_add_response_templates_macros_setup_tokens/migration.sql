-- CreateTable
CREATE TABLE "ResponseTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponseTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseMacro" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT,
    "body" TEXT,
    "newStatus" "TicketStatus",
    "newPriority" "TicketPriority",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponseMacro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetupToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetupToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResponseTemplate_isActive_idx" ON "ResponseTemplate"("isActive");

-- CreateIndex
CREATE INDEX "ResponseMacro_isActive_idx" ON "ResponseMacro"("isActive");

-- CreateIndex
CREATE INDEX "ResponseMacro_templateId_idx" ON "ResponseMacro"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "SetupToken_tokenHash_key" ON "SetupToken"("tokenHash");

-- CreateIndex
CREATE INDEX "SetupToken_email_idx" ON "SetupToken"("email");

-- CreateIndex
CREATE INDEX "SetupToken_expiresAt_idx" ON "SetupToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "ResponseTemplate" ADD CONSTRAINT "ResponseTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseMacro" ADD CONSTRAINT "ResponseMacro_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseMacro" ADD CONSTRAINT "ResponseMacro_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ResponseTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupToken" ADD CONSTRAINT "SetupToken_email_fkey" FOREIGN KEY ("email") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;
