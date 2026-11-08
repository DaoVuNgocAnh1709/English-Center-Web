import {
  parseQuestionPageLayouts,
  parseQuestionTextLayout,
  PositionedLine,
} from "./pdf-question-parser";

function line(text: string, x: number, y: number, width = 240): PositionedLine {
  return {
    text,
    page: 1,
    x,
    y,
    width,
    height: 12,
    pageWidth: 595,
    pageHeight: 842,
  };
}

describe("layout-aware question parser", () => {
  it("removes a vocabulary list before the actual exercise", () => {
    const result = parseQuestionTextLayout(
      "VOCABULARY\n1. artisan /a:tizan/ (n.): craft worker\n2. workshop /w3:kshop/ (n.): place of work\nBài 1. Choose the correct answer\n1. Choose one. A.cat B.dog C.bird D.fish\n2. Complete the sentence: I live in ________.",
    );
    expect(result.questions.map((question) => question.sourceLabel)).toEqual(["1", "2"]);
    expect(result.questions[0].options).toEqual(["A. cat", "B. dog", "C. bird", "D. fish"]);
    expect(result.questions.some((question) => /artisan|workshop/i.test(question.content))).toBe(false);
  });

  it("keeps reading order on a two-column test", () => {
    const result = parseQuestionPageLayouts([[
      line("1. Choose one. A.one B.two C.three D.four", 40, 740),
      line("2. Complete this ________.", 40, 700),
      line("3. Choose one. A.red B.blue C.green D.black", 310, 740),
      line("4. Write one sentence about school.", 310, 700),
    ]]);
    expect(result.questions.map((question) => question.sourceLabel)).toEqual(["1", "2", "3", "4"]);
    expect(result.questions.every((question) => question.sourceBounds)).toBe(true);
  });

  it("does not expose internal column delimiters in ordinary choices", () => {
    const result = parseQuestionTextLayout(
      "Bai 1. Choose the correct answer\n1. I stayed home. A.because <COL> B.although <COL> C.when",
    );
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].options).toEqual([
      "A. because",
      "B. although",
      "C. when",
    ]);
    expect(JSON.stringify(result.questions)).not.toContain("<COL>");
  });

  it("attaches a reading passage to its questions instead of creating a fake question", () => {
    const result = parseQuestionTextLayout(
      "PART III. READING\nRead the passage and choose the best answer.\nLan lives in Hanoi. She walks to school every day.\nQuestion 1. Where does Lan live? A.Hanoi B.Hue C.Danang D.HCM City\nQuestion 2. How does she go to school? A.By bus B.On foot C.By bike D.By car",
    );
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].section).toContain("Lan lives in Hanoi");
    expect(result.questions[0].content).toBe("Where does Lan live?");
  });

  it("does not turn an answer-key block into more questions", () => {
    const result = parseQuestionTextLayout(
      "Bài 1. Choose the answer\n1. Choose one. A. cat B. dog C. bird D. fish\n2. Complete this ________.\nANSWER KEY\n1. A\n2. sample",
    );
    expect(result.questions.map((question) => question.sourceLabel)).toEqual(["1", "2"]);
  });

  it("removes numbered theory headings but keeps a following exercise", () => {
    const result = parseQuestionTextLayout(
      "1. Định nghĩa: Câu phức gồm mệnh đề chính và mệnh đề phụ.\n2. Một số liên từ phụ thuộc phổ biến.\n3. Các loại mệnh đề thường gặp.\nBài 1. Chọn đáp án đúng\n1. Choose the correct answer. A. because B. although C. when D. before",
    );
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].options).toHaveLength(4);
  });

  it("keeps legitimate short-answer, rewrite and essay questions", () => {
    const result = parseQuestionTextLayout(
      "PHẦN II. TỰ LUẬN\nCâu 1. Điền một từ vào chỗ trống: My name is ________.\nCâu 2. Viết lại câu sau sao cho nghĩa không đổi.\nQuestion 3. Write a paragraph about your family.",
    );
    expect(result.questions).toHaveLength(3);
    expect(result.questions.map((question) => question.kind)).toEqual([
      "SHORT_TEXT",
      "SHORT_TEXT",
      "ESSAY",
    ]);
  });

  it("converts a matching table to shared choices and removes its answer grid", () => {
    const result = parseQuestionTextLayout(
      "Bài 3. Nối cột A với cột B\n1. Jane did not notice <COL> a. until her teacher told her\n2. They played outside <COL> b. although it was raining\n1. ______ 2. ______",
    );
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].content).toBe("Jane did not notice");
    expect(result.questions[0].options).toEqual([
      "A. until her teacher told her",
      "B. although it was raining",
    ]);
    expect(result.questions[0].reviewFlags).toContain("MATCHING_CONVERTED");
  });

  it("extracts and matches answer keys onto corresponding questions", () => {
    const result = parseQuestionTextLayout(
      "Bài 1. Chọn đáp án đúng\n1. She likes music. A.yes B.no C.maybe D.never\n2. I am a student. A.is B.am C.are D.be\nĐÁP ÁN\n1. A  2. B",
    );
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].answer).toBe("A");
    expect(result.questions[1].answer).toBe("B");
    expect(result.questions[0].reviewFlags).toContain("ANSWER_KEY_MATCHED");
    expect(result.warnings.some((w) => w.includes("bảng đáp án"))).toBe(true);
  });
});
