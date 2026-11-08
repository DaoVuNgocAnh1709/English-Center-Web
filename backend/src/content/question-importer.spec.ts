import { Document, Packer, Paragraph } from "docx";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { existsSync } from "fs";
import {
  createExamTemplate,
  inspectExamSource,
  parseQuestionText,
} from "./question-importer";

describe("question importer", () => {
  it("parses numbered text and answer choices", () => {
    const questions = parseQuestionText(
      "I. Vocabulary\n1. Choose one. A. Cat B. Dog C. Bird D. Fish\n2. Complete the sentence.",
    );
    expect(questions).toHaveLength(2);
    expect(questions[0]).toMatchObject({
      section: "I. Vocabulary",
      kind: "SINGLE_CHOICE",
      options: ["A. Cat", "B. Dog", "C. Bird", "D. Fish"],
    });
    expect(questions[0].recognitionConfidence).toBeGreaterThanOrEqual(0.7);
  });

  it("does not turn a numbered vocabulary entry into a question", () => {
    const questions = parseQuestionText(
      "21. Choose the correct answer. A. go B. goes C. went D. gone\n22. set off / set of / (phr. v.): khởi hành, bắt đầu chuyến đi\n23. Complete the sentence with one word.",
    );
    expect(questions.map((question) => question.sourceLabel)).toEqual(["21", "23"]);
  });

  it("marks ambiguous short-answer items for teacher review", () => {
    const questions = parseQuestionText("Câu 1. Viết lại câu sau sao cho nghĩa không đổi.");
    expect(questions).toHaveLength(1);
    expect(questions[0].reviewFlags).toContain("NO_OPTIONS");
    expect(questions[0].recognitionConfidence).toBeGreaterThan(0.5);
  });

  it("recognizes PDF text where a question number is stuck to its sentence", () => {
    const questions = parseQuestionText("4. Build a complete sentence.\n5You should use the words given.");
    expect(questions.map((question) => question.sourceLabel)).toEqual(["4", "5"]);
  });

  it("imports a DOCX exam", async () => {
    const document = new Document({
      sections: [{
        children: [
          new Paragraph("1. Choose the correct word. A. apple B. table C. blue D. run"),
          new Paragraph("2. Write one sentence about your school."),
        ],
      }],
    });
    const buffer = await Packer.toBuffer(document);
    const imported = await inspectExamSource({
      buffer,
      originalname: "unit-test.docx",
      mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(imported.extension).toBe("docx");
    expect(imported.questions).toHaveLength(2);
  });

  it("imports the structured Excel template with answers", async () => {
    const buffer = await createExamTemplate();
    const imported = await inspectExamSource({
      buffer,
      originalname: "exam-template.xlsx",
      mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(imported.extension).toBe("xlsx");
    expect(imported.questions).toHaveLength(5);
    expect(imported.questions[0]).toMatchObject({ answer: "B", points: 1 });
    expect(imported.questions[4].content).toContain("![Hình minh họa]");
  });

  it("runs local OCR for a PNG exam", async () => {
    const linuxFont = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
    const windowsFont = "C:/Windows/Fonts/arial.ttf";
    const fontPath = existsSync(linuxFont) ? linuxFont : windowsFont;
    if (existsSync(fontPath)) GlobalFonts.registerFromPath(fontPath, "ExamTest");
    const canvas = createCanvas(1400, 500);
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, 1400, 500);
    context.fillStyle = "black";
    context.font = "32px ExamTest";
    context.fillText("1. Choose the correct answer. A. cat B. dog C. bird D. fish", 40, 100);
    context.fillText("2. Complete the sentence about your school.", 40, 190);
    const imported = await inspectExamSource({
      buffer: canvas.toBuffer("image/png"),
      originalname: "scan.png",
      mimetype: "image/png",
    });
    expect(imported.extension).toBe("png");
    expect(imported.questions.length).toBeGreaterThanOrEqual(1);
    expect(imported.warnings.join(" ")).toContain("OCR");
  }, 30_000);
});
