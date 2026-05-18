-- AlterTable
ALTER TABLE "CompanyLink" ADD COLUMN "lastMonitorErrorAt" TIMESTAMP(3),
ADD COLUMN "lastMonitorErrorMessage" TEXT,
ADD COLUMN "lastMonitorErrorDetail" TEXT;

-- CreateTable
CREATE TABLE "MonitorVerificationLog" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "userFacingMessage" TEXT NOT NULL,
    "technicalDetail" TEXT,
    "patternId" TEXT,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitorVerificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonitorVerificationLog_linkId_idx" ON "MonitorVerificationLog"("linkId");

-- CreateIndex
CREATE INDEX "MonitorVerificationLog_batchId_idx" ON "MonitorVerificationLog"("batchId");

-- AddForeignKey
ALTER TABLE "MonitorVerificationLog" ADD CONSTRAINT "MonitorVerificationLog_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "CompanyLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
