ALTER TABLE "ExamSource"
ADD COLUMN "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
ADD COLUMN "importDraft" JSONB,
ADD COLUMN "importWarnings" JSONB;
