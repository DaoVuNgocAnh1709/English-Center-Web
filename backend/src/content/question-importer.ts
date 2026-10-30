import { BadRequestException } from "@nestjs/common";
import { QuestionKind } from "@prisma/client";
import { createCanvas } from "@napi-rs/canvas";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import engData from "@tesseract.js-data/eng";
import vieData from "@tesseract.js-data/vie";
import yauzl from "yauzl";
import { copyFile, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  ExtractedQuestion,
  extractQuestionsFromPdf,
  parseQuestionTextLayout,
} from "./pdf-question-parser";

export type ImportedQuestion = ExtractedQuestion & {
  answer?: string | null;
  points?: number;
};

export type ImportedSource = {
  extension: "pdf" | "docx" | "xlsx" | "png" | "jpg";
  mimeType: string;
  pageCount: number;
  questions: ImportedQuestion[];
  warnings: string[];
};

type Upload = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

const maxPdfPages = Number(process.env.UPLOAD_MAX_PDF_PAGES || 300);
const maxArchiveEntries = Number(process.env.UPLOAD_MAX_ARCHIVE_ENTRIES || 2000);
const maxUncompressedBytes = Number(process.env.UPLOAD_MAX_UNCOMPRESSED_MB || 100) * 1024 * 1024;
const maxImagePixels = Number(process.env.UPLOAD_MAX_IMAGE_PIXELS || 25000000);
const maxSheets = Number(process.env.UPLOAD_MAX_SHEETS || 10);
const maxRows = Number(process.env.UPLOAD_MAX_ROWS || 10000);

async function inspectArchive(buffer: Buffer) {
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, archive) => {
      if (error || !archive) return reject(new BadRequestException("Tệp Word/Excel bị hỏng hoặc không đúng định dạng."));
      let entries = 0;
      let total = 0;
      archive.on("entry", (entry) => {
        entries += 1;
        total += entry.uncompressedSize;
        if (entries > maxArchiveEntries || total > maxUncompressedBytes || entry.uncompressedSize > maxUncompressedBytes) {
          archive.close();
          reject(new BadRequestException("Tệp nén mở rộng quá lớn; vui lòng giảm ảnh hoặc dữ liệu trong tệp."));
          return;
        }
        archive.readEntry();
      });
      archive.on("end", resolve);
      archive.on("error", reject);
      archive.readEntry();
    });
  });
}

const clean = (value: string) => value.replace(/_{4,}/g, " ").replace(/\s+/g, " ").trim();

export function parseQuestionText(text: string, sourcePage = 1): ImportedQuestion[] {
  return parseQuestionTextLayout(text, sourcePage).questions;
}

function markOcrQuestions(questions: ImportedQuestion[]) {
  return questions.map((question) => ({
    ...question,
    recognitionConfidence: Number(Math.max(0.05, question.recognitionConfidence - 0.08).toFixed(2)),
    reviewFlags: [...new Set([...question.reviewFlags, "OCR_REVIEW"])],
  }));
}

let tessdataPath: Promise<string> | null = null;
function prepareOcrLanguages() {
  if (!tessdataPath) tessdataPath = (async () => {
    const target = join(tmpdir(), "bright-path-tessdata");
    await mkdir(target, { recursive: true });
    await Promise.all([
      copyFile(join(engData.langPath, "eng.traineddata.gz"), join(target, "eng.traineddata.gz")),
      copyFile(join(vieData.langPath, "vie.traineddata.gz"), join(target, "vie.traineddata.gz")),
    ]);
    return target;
  })();
  return tessdataPath;
}

const createOcrWorker = async () => createWorker(["eng", "vie"], undefined, {
  langPath: await prepareOcrLanguages(),
  gzip: true,
});

async function recognizeImage(buffer: Buffer) {
  const worker = await createOcrWorker();
  try {
    return (await worker.recognize(buffer)).data.text;
  } finally {
    await worker.terminate();
  }
}

const header = (value: unknown) => clean(String(value ?? "")).toLocaleLowerCase("vi");
const cellText = (value: ExcelJS.CellValue) => {
  if (value && typeof value === "object") {
    if ("text" in value) return String(value.text);
    if ("result" in value) return String(value.result ?? "");
    if ("richText" in value) return value.richText.map((item) => item.text).join("");
  }
  return String(value ?? "");
};

async function parseWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  if (workbook.worksheets.length > maxSheets)
    throw new BadRequestException(`Excel chỉ được tối đa ${maxSheets} trang tính.`);
  const totalRows = workbook.worksheets.reduce((sum, item) => sum + item.rowCount, 0);
  if (totalRows > maxRows)
    throw new BadRequestException(`Excel chỉ được tối đa ${maxRows.toLocaleString("vi-VN")} dòng.`);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new BadRequestException("File Excel không có trang dữ liệu.");
  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => headers.set(header(cellText(cell.value)), col));
  const find = (...names: string[]) => names.map((name) => headers.get(name)).find(Boolean);
  const columns = {
    position: find("câu", "cau", "stt", "question"),
    kind: find("loại", "loai", "type"),
    content: find("nội dung", "noi dung", "question content", "content"),
    answer: find("đáp án", "dap an", "answer"),
    points: find("điểm", "diem", "points"),
    section: find("phần", "phan", "section"),
    options: ["a", "b", "c", "d", "e", "f", "g", "h"].map((name) => headers.get(name)),
  };
  if (!columns.content) throw new BadRequestException("Excel cần cột ‘Nội dung’.");
  const questions: ImportedQuestion[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (col?: number) => col ? clean(cellText(row.getCell(col).value)) : "";
    const content = get(columns.content);
    if (!content) return;
    const options = columns.options.map((col, index) => {
      const value = get(col);
      return value ? `${String.fromCharCode(65 + index)}. ${value}` : "";
    }).filter(Boolean);
    const rawKind = get(columns.kind).toLocaleLowerCase("vi");
    const kind = options.length >= 2 || /trắc|choice/.test(rawKind)
      ? QuestionKind.SINGLE_CHOICE
      : /tự luận|essay/.test(rawKind) ? QuestionKind.ESSAY : QuestionKind.SHORT_TEXT;
    const parsedPoints = Number(get(columns.points));
    questions.push({
      position: questions.length + 1,
      sourceLabel: get(columns.position) || String(questions.length + 1),
      section: get(columns.section) || null,
      content: content.slice(0, 4000),
      options: options.slice(0, 8),
      kind,
      sourcePage: 1,
      recognitionConfidence: 1,
      reviewFlags: [],
      sourceBounds: null,
      answer: get(columns.answer) || null,
      points: Number.isFinite(parsedPoints) && parsedPoints > 0 && parsedPoints <= 100 ? parsedPoints : 1,
    });
  });
  return questions.slice(0, 200);
}

export async function inspectExamSource(file: Upload): Promise<ImportedSource> {
  const name = file.originalname.toLowerCase();
  const pdf = file.buffer.subarray(0, 5).toString() === "%PDF-";
  const zip = file.buffer.subarray(0, 2).toString() === "PK";
  const png = file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpg = file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
  if (pdf) {
    const { PDFDocument } = await import("pdf-lib");
    let document: import("pdf-lib").PDFDocument;
    try { document = await PDFDocument.load(file.buffer, { ignoreEncryption: false }); }
    catch { throw new BadRequestException("Không đọc được PDF hoặc PDF đã được khóa."); }
    const pageCount = document.getPageCount();
    if (pageCount > maxPdfPages) throw new BadRequestException(`PDF chỉ được tối đa ${maxPdfPages} trang.`);
    return { extension: "pdf", mimeType: "application/pdf", pageCount, questions: [], warnings: [] };
  }
  if (zip && name.endsWith(".docx")) {
    await inspectArchive(file.buffer);
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    if (Buffer.byteLength(result.value, "utf8") > 2 * 1024 * 1024)
      throw new BadRequestException("Nội dung Word sau giải nén vượt 2 MB.");
    const parsed = parseQuestionTextLayout(result.value);
    const warnings = [...parsed.warnings, ...result.messages.map((item) => item.message)];
    return { extension: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pageCount: 1, questions: parsed.questions, warnings: parsed.questions.length ? warnings : ["Không nhận diện được câu hỏi trong DOCX; hãy kiểm tra cách đánh số câu."] };
  }
  if (zip && name.endsWith(".xlsx")) {
    await inspectArchive(file.buffer);
    const questions = await parseWorkbook(file.buffer);
    return { extension: "xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pageCount: 1, questions, warnings: questions.length ? [] : ["Excel chưa có câu hỏi hợp lệ."] };
  }
  if ((png && name.endsWith(".png")) || (jpg && /\.jpe?g$/i.test(name))) {
    const metadata = await sharp(file.buffer, { limitInputPixels: maxImagePixels }).metadata().catch(() => null);
    if (!metadata?.width || !metadata.height || metadata.width * metadata.height > maxImagePixels)
      throw new BadRequestException(`Ảnh không hợp lệ hoặc vượt ${(maxImagePixels / 1000000).toFixed(0)} megapixel.`);
    const text = await recognizeImage(file.buffer);
    const parsed = parseQuestionTextLayout(text);
    const questions = markOcrQuestions(parsed.questions);
    return { extension: png ? "png" : "jpg", mimeType: png ? "image/png" : "image/jpeg", pageCount: 1, questions, warnings: questions.length ? [...parsed.warnings, "Câu hỏi được OCR từ ảnh; giáo viên cần rà soát lại nội dung."] : ["OCR không nhận diện được cấu trúc câu hỏi trong ảnh."] };
  }
  throw new BadRequestException("Chỉ chấp nhận PDF, DOCX, XLSX, JPG hoặc PNG.");
}

export async function probeExamSource(file: Upload) {
  const name = file.originalname.toLowerCase();
  const pdf = file.buffer.subarray(0, 5).toString() === "%PDF-";
  const zip = file.buffer.subarray(0, 2).toString() === "PK";
  const png = file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpg = file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
  if (pdf) {
    const { PDFDocument } = await import("pdf-lib");
    const document = await PDFDocument.load(file.buffer, { ignoreEncryption: false }).catch(() => null);
    if (!document) throw new BadRequestException("Không đọc được PDF hoặc PDF đã được khóa.");
    const pageCount = document.getPageCount();
    if (pageCount > maxPdfPages) throw new BadRequestException(`PDF chỉ được tối đa ${maxPdfPages} trang.`);
    return { extension: "pdf" as const, mimeType: "application/pdf", pageCount };
  }
  if (zip && name.endsWith(".docx")) {
    await inspectArchive(file.buffer);
    return { extension: "docx" as const, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pageCount: 1 };
  }
  if (zip && name.endsWith(".xlsx")) {
    await inspectArchive(file.buffer);
    return { extension: "xlsx" as const, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pageCount: 1 };
  }
  if ((png && name.endsWith(".png")) || (jpg && /\.jpe?g$/i.test(name))) {
    const metadata = await sharp(file.buffer, { limitInputPixels: maxImagePixels }).metadata().catch(() => null);
    if (!metadata?.width || !metadata.height || metadata.width * metadata.height > maxImagePixels)
      throw new BadRequestException(`Ảnh không hợp lệ hoặc vượt ${(maxImagePixels / 1000000).toFixed(0)} megapixel.`);
    return { extension: png ? "png" as const : "jpg" as const, mimeType: png ? "image/png" : "image/jpeg", pageCount: 1 };
  }
  throw new BadRequestException("Chỉ chấp nhận PDF, DOCX, XLSX, JPG hoặc PNG đúng định dạng thực tế.");
}

export async function extractPdfWithOcr(
  bytes: Uint8Array,
  startPage: number,
  endPage: number,
): Promise<{ questions: ImportedQuestion[]; warnings: string[] }> {
  const extracted = await extractQuestionsFromPdf(bytes, startPage, endPage);
  if (extracted.questions.length || endPage - startPage + 1 > 20) {
    if (!extracted.questions.length && endPage - startPage + 1 > 20)
      extracted.warnings.push("PDF scan chỉ OCR tối đa 20 trang mỗi đề; hãy chọn khoảng trang nhỏ hơn.");
    return extracted;
  }
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false }).promise;
  const questions: ImportedQuestion[] = [];
  const worker = await createOcrWorker();
  try {
    for (let pageNumber = startPage; pageNumber <= endPage; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvas: canvas as never, canvasContext: canvas.getContext("2d") as never, viewport }).promise;
      const pageQuestions = markOcrQuestions(parseQuestionText((await worker.recognize(canvas.toBuffer("image/png"))).data.text, pageNumber));
      for (const question of pageQuestions) questions.push({ ...question, position: questions.length + 1 });
    }
  } finally {
    await worker.terminate();
    await document.destroy();
  }
  return {
    questions,
    warnings: questions.length ? ["Đã dùng OCR cho PDF scan; giáo viên cần rà soát toàn bộ câu hỏi."] : ["OCR không nhận diện được cấu trúc câu hỏi trong PDF scan."],
  };
}

export async function createExamTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cau hoi");
  sheet.columns = [
    { header: "Câu", key: "position", width: 8 },
    { header: "Loại", key: "kind", width: 18 },
    { header: "Nội dung", key: "content", width: 52 },
    { header: "A", key: "a", width: 24 },
    { header: "B", key: "b", width: 24 },
    { header: "C", key: "c", width: 24 },
    { header: "D", key: "d", width: 24 },
    { header: "Đáp án", key: "answer", width: 12 },
    { header: "Điểm", key: "points", width: 10 },
    { header: "Phần", key: "section", width: 24 },
  ];
  sheet.addRow({ position: 1, kind: "Trắc nghiệm", content: "Choose the correct answer.", a: "Option one", b: "Option two", c: "Option three", d: "Option four", answer: "B", points: 1, section: "Vocabulary" });
  sheet.addRow({ position: 2, kind: "Trả lời ngắn", content: "Complete the sentence.", answer: "sample answer", points: 1, section: "Writing" });
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123D68" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
