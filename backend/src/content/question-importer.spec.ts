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
    expect(imported.questions[0]).toMatchObject({ answer: "B", points: 1, taskType: "PRONUNCIATION" });
    expect(imported.questions[1].content).toContain("_____");
    expect(imported.questions[4].content).toContain("![Hình minh họa]");
  });

  it("imports edited Excel files with namespace-prefixed OpenXML (x:workbook / x:sheets) without crashing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const JSZip = require("jszip") as {
      new (): {
        file: (name: string, content: string) => void;
        generateAsync: (opts: { type: "nodebuffer" }) => Promise<Buffer>;
      };
    };
    const zip = new JSZip();
    zip.file(
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
      <x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <x:sheets>
          <x:sheet name="Hướng dẫn sử dụng" sheetId="1" r:id="rId1"/>
          <x:sheet name="Cau hoi" sheetId="2" r:id="rId2"/>
        </x:sheets>
      </x:workbook>`,
    );
    zip.file(
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet2.xml"/>
      </Relationships>`,
    );
    zip.file(
      "xl/sharedStrings.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
      <x:sst xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="9" uniqueCount="9">
        <x:si><x:t>Câu</x:t></x:si>
        <x:si><x:t>Loại</x:t></x:si>
        <x:si><x:t>Phần</x:t></x:si>
        <x:si><x:t>Nội dung</x:t></x:si>
        <x:si><x:t>A</x:t></x:si>
        <x:si><x:t>B</x:t></x:si>
        <x:si><x:t>C</x:t></x:si>
        <x:si><x:t>D</x:t></x:si>
        <x:si><x:t>Đáp án</x:t></x:si>
      </x:sst>`,
    );
    zip.file(
      "xl/worksheets/sheet1.xml",
      `<?xml version="1.0" encoding="UTF-8"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData><x:row r="1"><x:c r="A1" t="inlineStr"><x:is><x:t>Cột</x:t></x:is></x:c><x:c r="B1" t="inlineStr"><x:is><x:t>Quy định</x:t></x:is></x:c></x:row></x:sheetData></x:worksheet>`,
    );
    zip.file(
      "xl/worksheets/sheet2.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
      <x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <x:sheetData>
          <x:row r="1">
            <x:c r="A1" t="s"><x:v>0</x:v></x:c>
            <x:c r="B1" t="s"><x:v>1</x:v></x:c>
            <x:c r="C1" t="s"><x:v>2</x:v></x:c>
            <x:c r="D1" t="s"><x:v>3</x:v></x:c>
            <x:c r="E1" t="s"><x:v>4</x:v></x:c>
            <x:c r="F1" t="s"><x:v>5</x:v></x:c>
            <x:c r="G1" t="s"><x:v>6</x:v></x:c>
            <x:c r="H1" t="s"><x:v>7</x:v></x:c>
            <x:c r="I1" t="s"><x:v>8</x:v></x:c>
          </x:row>
          <x:row r="2">
            <x:c r="A2"><x:v>1</x:v></x:c>
            <x:c r="B2" t="inlineStr"><x:is><x:t>Trắc nghiệm</x:t></x:is></x:c>
            <x:c r="C2" t="inlineStr"><x:is><x:t>Grammar</x:t></x:is></x:c>
            <x:c r="D2" t="inlineStr"><x:is><x:t>She _____ to school every day.</x:t></x:is></x:c>
            <x:c r="E2" t="inlineStr"><x:is><x:t>go</x:t></x:is></x:c>
            <x:c r="F2" t="inlineStr"><x:is><x:t>goes</x:t></x:is></x:c>
            <x:c r="G2" t="inlineStr"><x:is><x:t>going</x:t></x:is></x:c>
            <x:c r="H2" t="inlineStr"><x:is><x:t>went</x:t></x:is></x:c>
            <x:c r="I2" t="inlineStr"><x:is><x:t>B. goes</x:t></x:is></x:c>
          </x:row>
        </x:sheetData>
      </x:worksheet>`,
    );
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const imported = await inspectExamSource({
      buffer,
      originalname: "bright-path-exam-1116-completed.xlsx",
      mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(imported.extension).toBe("xlsx");
    expect(imported.questions).toHaveLength(1);
    expect(imported.questions[0]).toMatchObject({
      content: "She _____ to school every day.",
      options: ["A. go", "B. goes", "C. going", "D. went"],
      answer: "B",
      taskType: "GRAMMAR",
    });
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
