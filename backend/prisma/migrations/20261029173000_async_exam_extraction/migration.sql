ALTER TABLE "Exam"
  ADD COLUMN "extractionStatus" "SourceImportStatus" NOT NULL DEFAULT 'READY',
  ADD COLUMN "extractionProgress" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "extractionError" TEXT;

CREATE INDEX "Exam_extractionStatus_createdAt_idx" ON "Exam"("extractionStatus", "createdAt");
