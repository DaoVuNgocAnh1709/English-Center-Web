import { QuestionKind } from "@prisma/client";
import {
  applyCorrectionMemory,
  questionSignature,
  snapshotQuestion,
} from "./recognition-learning";

const extracted = {
  position: 1,
  sourceLabel: "1",
  section: "Vocabulary",
  content: "Choose teh correct answer.",
  options: ["A. cat", "B. dog"],
  kind: QuestionKind.SINGLE_CHOICE,
  answer: null,
  points: 1,
  sourcePage: 1,
  recognitionConfidence: 0.6,
  reviewFlags: ["LOW_CONFIDENCE"],
  sourceBounds: null,
};

describe("teacher correction memory", () => {
  it("reuses an exact teacher-confirmed correction", () => {
    const corrected = snapshotQuestion({
      ...extracted,
      content: "Choose the correct answer.",
      answer: "A",
    });
    const result = applyCorrectionMemory([extracted], [{
      signature: questionSignature(extracted),
      action: "UPDATED",
      correctedData: corrected,
    }]);
    expect(result).toMatchObject({ applied: 1, suppressed: 0 });
    expect(result.questions[0]).toMatchObject({
      content: "Choose the correct answer.",
      answer: "A",
      recognitionConfidence: 1,
      reviewFlags: ["LEARNED_CORRECTION"],
    });
  });

  it("suppresses an exact false positive deleted by a teacher", () => {
    const result = applyCorrectionMemory([extracted], [{
      signature: questionSignature(extracted),
      action: "DELETED",
      correctedData: null,
    }]);
    expect(result.questions).toHaveLength(0);
    expect(result.suppressed).toBe(1);
  });

  it("does not apply a correction to merely similar content", () => {
    const result = applyCorrectionMemory(
      [{ ...extracted, content: "Choose the best answer." }],
      [{
        signature: questionSignature(extracted),
        action: "DELETED",
        correctedData: null,
      }],
    );
    expect(result.questions).toHaveLength(1);
    expect(result.suppressed).toBe(0);
  });
});
