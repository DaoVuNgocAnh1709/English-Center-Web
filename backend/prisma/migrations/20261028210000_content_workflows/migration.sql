-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "SchoolLevel" AS ENUM ('PRIMARY', 'MIDDLE', 'HIGH');

-- CreateEnum
CREATE TYPE "ExamAccess" AS ENUM ('PUBLIC', 'STUDENT_ONLY');

-- CreateEnum
CREATE TYPE "QuestionKind" AS ENUM ('SINGLE_CHOICE', 'SHORT_TEXT', 'ESSAY');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('NEW', 'CONTACTED', 'INTERVIEW', 'HIRED', 'REJECTED');

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "fileKey" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "grade" INTEGER,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "schoolLevel" "SchoolLevel",
ADD COLUMN     "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "ExamSource" (
    "id" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "schoolLevel" "SchoolLevel" NOT NULL,
    "grade" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 45,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "access" "ExamAccess" NOT NULL DEFAULT 'PUBLIC',
    "sourceId" TEXT NOT NULL,
    "startPage" INTEGER NOT NULL,
    "endPage" INTEGER NOT NULL,
    "fileKey" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "QuestionKind" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "answer" TEXT,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamAttempt" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "userId" TEXT,
    "answers" JSONB NOT NULL,
    "earned" DOUBLE PRECISION NOT NULL,
    "possible" DOUBLE PRECISION NOT NULL,
    "pending" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherApplication" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "experience" TEXT NOT NULL,
    "message" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exam_slug_key" ON "Exam"("slug");

-- CreateIndex
CREATE INDEX "Exam_status_schoolLevel_grade_idx" ON "Exam"("status", "schoolLevel", "grade");

-- CreateIndex
CREATE UNIQUE INDEX "ExamQuestion_examId_position_key" ON "ExamQuestion"("examId", "position");

-- CreateIndex
CREATE INDEX "ExamAttempt_userId_createdAt_idx" ON "ExamAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherApplication_status_createdAt_idx" ON "TeacherApplication"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSource" ADD CONSTRAINT "ExamSource_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ExamSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
