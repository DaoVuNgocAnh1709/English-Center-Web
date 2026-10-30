CREATE TABLE "RecognitionCorrection" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "questionPosition" INTEGER NOT NULL,
    "signature" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "originalData" JSONB NOT NULL,
    "correctedData" JSONB,
    "correctedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecognitionCorrection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecognitionCorrection_sourceChecksum_signature_idx"
ON "RecognitionCorrection"("sourceChecksum", "signature");

CREATE INDEX "RecognitionCorrection_examId_questionPosition_idx"
ON "RecognitionCorrection"("examId", "questionPosition");

CREATE INDEX "RecognitionCorrection_correctedById_createdAt_idx"
ON "RecognitionCorrection"("correctedById", "createdAt");
