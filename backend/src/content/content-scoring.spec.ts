import { QuestionKind, QuestionTaskType } from "@prisma/client";
import { isScoringAnswerMatch, normalizedScoringAnswer } from "./content.service";

describe("interactive question scoring", () => {
  it("normalizes matching answers independently of object key insertion order", () => {
    const first = normalizedScoringAnswer(
      JSON.stringify({ 0: "a skilled worker", 1: "objects made from clay" }),
      QuestionKind.SHORT_TEXT,
      QuestionTaskType.MATCHING,
    );
    const second = normalizedScoringAnswer(
      JSON.stringify({ 1: "objects made from clay", 0: "A SKILLED WORKER" }),
      QuestionKind.SHORT_TEXT,
      QuestionTaskType.MATCHING,
    );
    expect(first).toBe(second);
  });

  it("preserves sequence when scoring ordering questions", () => {
    const correct = normalizedScoringAnswer(
      JSON.stringify(["first", "second", "third"]),
      QuestionKind.SHORT_TEXT,
      QuestionTaskType.ORDERING,
    );
    const wrong = normalizedScoringAnswer(
      JSON.stringify(["second", "first", "third"]),
      QuestionKind.SHORT_TEXT,
      QuestionTaskType.ORDERING,
    );
    expect(correct).not.toBe(wrong);
  });

  it("matches English contractions, trailing punctuation, and multiple variants for short text", () => {
    expect(
      isScoringAnswerMatch(
        "She doesn't like coffee.",
        "She does not like coffee",
        QuestionKind.SHORT_TEXT,
        QuestionTaskType.SENTENCE_REWRITE,
      ),
    ).toBe(true);
    expect(
      isScoringAnswerMatch(
        "due to the heavy rain",
        "because of the heavy rain / due to the heavy rain",
        QuestionKind.SHORT_TEXT,
        QuestionTaskType.SENTENCE_REWRITE,
      ),
    ).toBe(true);
  });
});
