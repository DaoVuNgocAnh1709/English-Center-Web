CREATE TYPE "MaterialType" AS ENUM ('DOCUMENT', 'VIDEO', 'WORKSHEET', 'EXAM');
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED');

ALTER TABLE "Course" ADD COLUMN "level" TEXT;
ALTER TABLE "Course" ADD COLUMN "duration" TEXT;
ALTER TABLE "Course" ADD COLUMN "thumbnailUrl" TEXT;

CREATE TABLE "Lesson" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "youtubeUrl" TEXT,
  "driveUrl" TEXT,
  "isPreview" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Material" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "level" TEXT,
  "type" "MaterialType" NOT NULL,
  "driveUrl" TEXT,
  "youtubeUrl" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Enrollment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Material_slug_key" ON "Material"("slug");
CREATE INDEX "Lesson_courseId_sortOrder_idx" ON "Lesson"("courseId", "sortOrder");
CREATE INDEX "Material_isPublic_sortOrder_idx" ON "Material"("isPublic", "sortOrder");
CREATE INDEX "Material_category_idx" ON "Material"("category");
CREATE UNIQUE INDEX "Enrollment_userId_courseId_key" ON "Enrollment"("userId", "courseId");
CREATE INDEX "Enrollment_userId_status_idx" ON "Enrollment"("userId", "status");
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
