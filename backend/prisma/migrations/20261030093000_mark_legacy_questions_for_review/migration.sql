UPDATE "ExamQuestion"
SET
  "recognitionConfidence" = 0.5,
  "reviewFlags" = '["LEGACY_IMPORT", "LOW_CONFIDENCE"]'::jsonb
WHERE "reviewedAt" IS NULL;
