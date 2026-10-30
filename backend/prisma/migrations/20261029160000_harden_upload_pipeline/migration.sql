CREATE TYPE "SourceImportStatus" AS ENUM ('QUEUED', 'SCANNING', 'PROCESSING', 'READY', 'FAILED', 'QUARANTINED');

ALTER TABLE "Material"
  ADD COLUMN "sizeBytes" INTEGER,
  ADD COLUMN "checksum" TEXT;

ALTER TABLE "ExamSource"
  ADD COLUMN "sizeBytes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "checksum" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "status" "SourceImportStatus" NOT NULL DEFAULT 'READY',
  ADD COLUMN "progress" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "statusMessage" TEXT,
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "processedAt" TIMESTAMP(3);

ALTER TABLE "ExamSource" ALTER COLUMN "status" SET DEFAULT 'QUEUED';

CREATE INDEX "Material_createdById_checksum_idx" ON "Material"("createdById", "checksum");
CREATE INDEX "ExamSource_status_createdAt_idx" ON "ExamSource"("status", "createdAt");
CREATE INDEX "ExamSource_uploadedById_checksum_idx" ON "ExamSource"("uploadedById", "checksum");
