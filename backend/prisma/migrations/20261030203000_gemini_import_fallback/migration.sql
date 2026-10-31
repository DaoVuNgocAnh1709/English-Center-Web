CREATE TYPE "ExtractionProvider" AS ENUM ('LOCAL', 'GEMINI', 'LOCAL_FALLBACK');

ALTER TABLE "Exam"
ADD COLUMN "extractionProvider" "ExtractionProvider" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN "aiModel" TEXT,
ADD COLUMN "aiInputTokens" INTEGER,
ADD COLUMN "aiOutputTokens" INTEGER,
ADD COLUMN "aiFallbackReason" TEXT;
