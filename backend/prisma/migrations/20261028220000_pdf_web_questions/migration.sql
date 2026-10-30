-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "extractedAt" TIMESTAMP(3),
ADD COLUMN     "extractionWarnings" JSONB;

-- AlterTable
ALTER TABLE "ExamQuestion" ADD COLUMN     "content" TEXT,
ADD COLUMN     "options" JSONB,
ADD COLUMN     "section" TEXT,
ADD COLUMN     "sourceLabel" TEXT,
ADD COLUMN     "sourcePage" INTEGER;
