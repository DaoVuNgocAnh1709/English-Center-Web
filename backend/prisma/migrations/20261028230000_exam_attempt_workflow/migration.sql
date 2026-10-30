-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'GRADED');

-- AlterEnum
ALTER TYPE "SchoolLevel" ADD VALUE 'PRESCHOOL';

-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "gradedAt" TIMESTAMP(3),
ADD COLUMN     "gradedById" TEXT,
ADD COLUMN     "guestTokenHash" TEXT,
ADD COLUMN     "manualEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "manualPossible" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "manualScores" JSONB,
ADD COLUMN     "participantName" TEXT,
ADD COLUMN     "status" "AttemptStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "teacherFeedback" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "earned" SET DEFAULT 0,
ALTER COLUMN "possible" SET DEFAULT 0;

-- Existing attempts were created by the old submit-only flow.
UPDATE "ExamAttempt"
SET "status" = 'SUBMITTED', "submittedAt" = "createdAt";

ALTER TABLE "ExamAttempt" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "ExamAttempt_examId_status_updatedAt_idx" ON "ExamAttempt"("examId", "status", "updatedAt");
