import { createHash } from "node:crypto";
import { QuestionKind } from "@prisma/client";
import { ImportedQuestion } from "./question-importer";

export type QuestionSnapshot = {
  kind: QuestionKind;
  answer: string | null;
  points: number;
  section: string | null;
  content: string;
  options: string[];
};

export type CorrectionMemory = {
  signature: string;
  action: string;
  correctedData: unknown;
};

function normalized(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ")
    .trim();
}

function stringOptions(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

export function snapshotQuestion(question: {
  kind?: QuestionKind | null;
  answer?: string | null;
  points?: number | null;
  section?: string | null;
  content?: string | null;
  options?: unknown;
}): QuestionSnapshot {
  return {
    kind: question.kind || QuestionKind.SHORT_TEXT,
    answer: question.answer?.trim() || null,
    points: Number(question.points || 1),
    section: question.section?.trim() || null,
    content: question.content?.trim() || "",
    options: stringOptions(question.options),
  };
}

export function questionSignature(question: Parameters<typeof snapshotQuestion>[0]) {
  const snapshot = snapshotQuestion(question);
  // The answer and score are teacher-owned data, not recognition input. They
  // deliberately do not participate in the signature.
  const recognitionShape = {
    kind: snapshot.kind,
    section: normalized(snapshot.section),
    content: normalized(snapshot.content),
    options: snapshot.options.map(normalized),
  };
  return createHash("sha256").update(JSON.stringify(recognitionShape)).digest("hex");
}

function isSnapshot(value: unknown): value is QuestionSnapshot {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    Object.values(QuestionKind).includes(item.kind as QuestionKind) &&
    typeof item.content === "string" &&
    Array.isArray(item.options)
  );
}

export function applyCorrectionMemory(
  questions: ImportedQuestion[],
  memories: CorrectionMemory[],
) {
  const newestBySignature = new Map<string, CorrectionMemory>();
  // Callers return newest rows first. Keep only the first correction for an
  // extraction signature so an obsolete edit can never overwrite a new one.
  for (const memory of memories)
    if (!newestBySignature.has(memory.signature))
      newestBySignature.set(memory.signature, memory);

  let applied = 0;
  let suppressed = 0;
  const learned = questions.flatMap((question) => {
    const memory = newestBySignature.get(questionSignature(question));
    if (!memory) return [question];
    if (memory.action === "DELETED") {
      suppressed += 1;
      return [];
    }
    if (memory.action !== "UPDATED" || !isSnapshot(memory.correctedData))
      return [question];
    applied += 1;
    const corrected = memory.correctedData;
    return [{
      ...question,
      kind: corrected.kind,
      answer: corrected.answer,
      points: corrected.points,
      section: corrected.section,
      content: corrected.content,
      options: corrected.options,
      recognitionConfidence: 1,
      reviewFlags: ["LEARNED_CORRECTION"],
    }];
  });
  return { questions: learned, applied, suppressed };
}
