import { BadRequestException } from "@nestjs/common";
import {
  ExtractionProvider,
  QuestionKind,
  QuestionTaskType,
} from "@prisma/client";
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
  taskType?: QuestionTaskType;
  recognitionProvider?: ExtractionProvider;
  recognitionModel?: string | null;
  extractionBatch?: number | null;
  interactionData?: {
    matchingLeft?: string[];
    matchingRight?: string[];
    orderingItems?: string[];
  } | null;
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

const header = (value: unknown) =>
  clean(String(value ?? ""))
    .toLocaleLowerCase("vi")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const cleanExcelCell = (value: string) =>
  value
    .replace(/_{4,}/g, "_____")
    .replace(/[ \t]+/g, " ")
    .replace(/\r\n/g, "\n")
    .trim();

const cellText = (value: ExcelJS.CellValue) => {
  if (value && typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((item) => {
          const raw = String(item.text ?? "");
          if (item.font?.underline && raw.trim() && !raw.includes("__")) {
            return `__${raw}__`;
          }
          return raw;
        })
        .join("");
    }
    if ("text" in value) return String(value.text ?? "");
    if ("result" in value) return String(value.result ?? "");
  }
  return String(value ?? "");
};

type ParsedSheetData = {
  name: string;
  rows: Map<number, Map<number, string>>;
};

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/_x000D_/gi, "");
}

function getXmlAttr(attrs: string, attrName: string): string | null {
  const escaped = attrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `(?:^|\\s)(?:[\\w.-]+:)?${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    "i",
  );
  const match = attrs.match(regex);
  if (!match) return null;
  return decodeXmlEntities(match[1] ?? match[2] ?? "");
}

function colLettersToNumber(letters: string): number {
  let col = 0;
  const upper = letters.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    col = col * 26 + (upper.charCodeAt(i) - 64);
  }
  return col;
}

function extractXmlTextRuns(xmlFragment: string): string {
  const runRegex = /<(?:[\w.-]+:)?r\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?r>/gi;
  const runs = [...xmlFragment.matchAll(runRegex)];
  if (runs.length > 0) {
    return runs
      .map((runMatch) => {
        const inner = runMatch[1];
        const hasUnderline =
          /<(?:[\w.-]+:)?u\b(?![^>]*\bval\s*=\s*["']none["'])[^>]*\/?>/i.test(inner);
        const textParts = [
          ...inner.matchAll(/<(?:[\w.-]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?t>/gi),
        ].map((m) => decodeXmlEntities(m[1]));
        const combined = textParts.join("");
        if (hasUnderline && combined.trim() && !combined.includes("__")) {
          return `__${combined}__`;
        }
        return combined;
      })
      .join("");
  }
  const tMatches = [
    ...xmlFragment.matchAll(/<(?:[\w.-]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?t>/gi),
  ];
  return tMatches.map((m) => decodeXmlEntities(m[1])).join("");
}

async function readZipEntriesAsText(buffer: Buffer): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, archive) => {
      if (error || !archive) {
        return reject(new BadRequestException("Tệp Excel bị hỏng hoặc không đúng định dạng."));
      }
      const files = new Map<string, string>();
      archive.on("entry", (entry) => {
        const normalizedName = entry.fileName.replace(/\\/g, "/").replace(/^\/+/, "");
        if (/\/$/.test(normalizedName) || !/\.(xml|rels)$/i.test(normalizedName)) {
          archive.readEntry();
          return;
        }
        archive.openReadStream(entry, (streamErr, stream) => {
          if (streamErr || !stream) {
            archive.readEntry();
            return;
          }
          const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("end", () => {
            files.set(normalizedName, Buffer.concat(chunks).toString("utf8"));
            archive.readEntry();
          });
          stream.on("error", () => archive.readEntry());
        });
      });
      archive.on("end", () => resolve(files));
      archive.on("error", reject);
      archive.readEntry();
    });
  });
}

async function extractSheetsFromXlsxArchive(buffer: Buffer): Promise<ParsedSheetData[]> {
  const files = await readZipEntriesAsText(buffer);

  // 1. Parse sharedStrings.xml if present
  const sharedStrings: string[] = [];
  const sharedStringsEntry = [...files.entries()].find(([k]) =>
    /(?:^|\/)sharedStrings\.xml$/i.test(k),
  );
  if (sharedStringsEntry) {
    const siRegex = /<(?:[\w.-]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?si>/gi;
    for (const match of sharedStringsEntry[1].matchAll(siRegex)) {
      sharedStrings.push(extractXmlTextRuns(match[1]));
    }
  }

  // 2. Parse workbook.xml.rels to map rId -> target worksheet path
  const relTargetById = new Map<string, string>();
  const workbookRelsEntry = [...files.entries()].find(([k]) =>
    /(?:^|\/)workbook\.xml\.rels$/i.test(k),
  );
  if (workbookRelsEntry) {
    const relRegex = /<(?:[\w.-]+:)?Relationship\b([^>]*?)\/?>/gi;
    for (const match of workbookRelsEntry[1].matchAll(relRegex)) {
      const id = getXmlAttr(match[1], "Id");
      const target = getXmlAttr(match[1], "Target");
      if (id && target) {
        const cleanTarget = target
          .replace(/\\/g, "/")
          .replace(/^\/+/, "")
          .replace(/^xl\//i, "");
        relTargetById.set(id, `xl/${cleanTarget}`);
      }
    }
  }

  // 3. Parse workbook.xml for ordered sheet names & rIds
  const sheetOrder: Array<{ name: string; path: string }> = [];
  const workbookEntry = [...files.entries()].find(([k]) =>
    /(?:^|\/)workbook\.xml$/i.test(k),
  );
  if (workbookEntry) {
    const sheetTagRegex = /<(?:[\w.-]+:)?sheet\b([^>]*?)\/?>/gi;
    let index = 1;
    for (const match of workbookEntry[1].matchAll(sheetTagRegex)) {
      const attrs = match[1];
      if (/^<(?:[\w.-]+:)?sheets\b/i.test(match[0])) continue;
      const name = getXmlAttr(attrs, "name") || `Sheet${index}`;
      const rId = getXmlAttr(attrs, "id");
      const targetPath =
        (rId && relTargetById.get(rId)) || `xl/worksheets/sheet${index}.xml`;
      sheetOrder.push({ name, path: targetPath });
      index += 1;
    }
  }

  const worksheetFiles = [...files.keys()]
    .filter((k) => /(?:^|\/)worksheets\/sheet\d+\.xml$/i.test(k))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const resolvedSheets: Array<{ name: string; xml: string }> = [];
  for (const item of sheetOrder) {
    const found = [...files.entries()].find(
      ([k]) => k.toLowerCase() === item.path.toLowerCase(),
    );
    if (found) {
      resolvedSheets.push({ name: item.name, xml: found[1] });
    }
  }
  for (const wsKey of worksheetFiles) {
    const alreadyAdded = resolvedSheets.some(
      (s) => s.xml === files.get(wsKey),
    );
    if (!alreadyAdded) {
      resolvedSheets.push({
        name: wsKey.split("/").pop() || "Sheet",
        xml: files.get(wsKey) || "",
      });
    }
  }

  // 4. Parse rows and cells in each worksheet
  const result: ParsedSheetData[] = [];
  for (const ws of resolvedSheets) {
    const rows = new Map<number, Map<number, string>>();
    const rowRegex = /<(?:[\w.-]+:)?row\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?row>/gi;
    let autoRowNum = 0;
    for (const rowMatch of ws.xml.matchAll(rowRegex)) {
      autoRowNum += 1;
      const rAttr = getXmlAttr(rowMatch[1], "r");
      const rowNumber = rAttr && Number(rAttr) > 0 ? Number(rAttr) : autoRowNum;
      autoRowNum = rowNumber;
      const cellMap = rows.get(rowNumber) || new Map<number, string>();
      const cellRegex =
        /<(?:[\w.-]+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[\w.-]+:)?c>)/gi;
      let autoColNum = 0;
      for (const cellMatch of rowMatch[2].matchAll(cellRegex)) {
        const cellAttrs = cellMatch[1] || "";
        const cellInner = cellMatch[2] || "";
        const refAttr = getXmlAttr(cellAttrs, "r");
        const colLetters = refAttr?.match(/^[A-Za-z]+/)?.[0];
        const colNumber = colLetters
          ? colLettersToNumber(colLetters)
          : autoColNum + 1;
        autoColNum = colNumber;
        if (!cellInner) continue;

        const cellType = (getXmlAttr(cellAttrs, "t") || "").toLowerCase();
        let value = "";
        if (cellType === "inlinestr") {
          const isMatch = cellInner.match(
            /<(?:[\w.-]+:)?is\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?is>/i,
          );
          value = extractXmlTextRuns(isMatch ? isMatch[1] : cellInner);
        } else {
          const vMatch = cellInner.match(
            /<(?:[\w.-]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?v>/i,
          );
          const rawV = vMatch ? decodeXmlEntities(vMatch[1].trim()) : "";
          if (cellType === "s") {
            const idx = Number(rawV);
            value =
              Number.isInteger(idx) && idx >= 0 && idx < sharedStrings.length
                ? sharedStrings[idx]
                : rawV;
          } else if (cellType === "b") {
            value = rawV === "1" || rawV.toLowerCase() === "true" ? "TRUE" : "FALSE";
          } else if (rawV) {
            value = rawV;
          } else {
            const isMatch = cellInner.match(
              /<(?:[\w.-]+:)?is\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?is>/i,
            );
            if (isMatch) value = extractXmlTextRuns(isMatch[1]);
          }
        }
        if (value.trim()) {
          cellMap.set(colNumber, value);
        }
      }
      if (cellMap.size > 0) {
        rows.set(rowNumber, cellMap);
      }
    }
    result.push({ name: ws.name, rows });
  }
  return result;
}

async function loadWorkbookSheets(buffer: Buffer): Promise<ParsedSheetData[]> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    if (workbook.worksheets.length > 0) {
      const sheets: ParsedSheetData[] = workbook.worksheets.map((ws) => {
        const rows = new Map<number, Map<number, string>>();
        ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          const cellMap = new Map<number, string>();
          row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const val = cellText(cell.value);
            if (val.trim()) {
              cellMap.set(colNumber, val);
            }
          });
          if (cellMap.size > 0) {
            rows.set(rowNumber, cellMap);
          }
        });
        return { name: ws.name, rows };
      });
      if (sheets.some((s) => s.rows.size > 0)) {
        return sheets;
      }
    }
  } catch {
    // Fallback to direct OpenXML ZIP/XML reader when ExcelJS fails on namespace-prefixed or edited workbooks
  }
  return extractSheetsFromXlsxArchive(buffer);
}

function inferExcelTaskType(
  sectionText: string,
  kindText: string,
  contentText: string,
  kind: QuestionKind,
): QuestionTaskType {
  const combined = `${sectionText} ${kindText} ${contentText}`
    .normalize("NFKC")
    .toLocaleLowerCase("vi");
  if (/pronunciation|phonetic|different sound|underlined part|phát âm|ngữ âm/.test(combined))
    return QuestionTaskType.PRONUNCIATION;
  if (/stress|trọng âm/.test(combined)) return QuestionTaskType.STRESS;
  if (/closest in meaning|synonym|đồng nghĩa/.test(combined)) return QuestionTaskType.SYNONYM;
  if (/opposite in meaning|antonym|trái nghĩa/.test(combined)) return QuestionTaskType.ANTONYM;
  if (/phrasal verb|cụm động từ/.test(combined)) return QuestionTaskType.PHRASAL_VERB;
  if (/word form|dạng đúng của từ/.test(combined)) return QuestionTaskType.WORD_FORM;
  if (/verb form|chia động từ/.test(combined)) return QuestionTaskType.VERB_FORM;
  if (/cloze|complete the passage|điền.{0,20}đoạn văn/.test(combined)) return QuestionTaskType.CLOZE;
  if (/gap fill|fill in the blank|điền từ|điền chỗ trống/.test(combined)) return QuestionTaskType.GAP_FILL;
  if (/reading|read the passage|đọc hiểu/.test(combined)) return QuestionTaskType.READING_COMPREHENSION;
  if (kind === QuestionKind.TRUE_FALSE || /true or false|đúng.{0,5}sai/.test(combined))
    return QuestionTaskType.TRUE_FALSE;
  if (kind === QuestionKind.MULTIPLE_CHOICE || /multiple select|chọn nhiều/.test(combined))
    return QuestionTaskType.MULTIPLE_SELECT;
  if (/match|matching|nối/.test(combined)) return QuestionTaskType.MATCHING;
  if (/order|rearrange|sắp xếp/.test(combined)) return QuestionTaskType.ORDERING;
  if (/mistake|error correction|sửa lỗi/.test(combined)) return QuestionTaskType.ERROR_CORRECTION;
  if (/communication|giao tiếp/.test(combined)) return QuestionTaskType.FUNCTIONAL_COMMUNICATION;
  if (/passive voice|bị động/.test(combined)) return QuestionTaskType.PASSIVE_VOICE;
  if (/reported speech|tường thuật/.test(combined)) return QuestionTaskType.REPORTED_SPEECH;
  if (/conditional|điều kiện/.test(combined)) return QuestionTaskType.CONDITIONAL_SENTENCE;
  if (/relative clause|mệnh đề quan hệ/.test(combined)) return QuestionTaskType.RELATIVE_CLAUSE;
  if (/tag question|câu hỏi đuôi/.test(combined)) return QuestionTaskType.TAG_QUESTION;
  if (/combine|kết hợp câu/.test(combined)) return QuestionTaskType.SENTENCE_COMBINATION;
  if (/rewrite|complete the second sentence|viết lại câu/.test(combined))
    return QuestionTaskType.SENTENCE_REWRITE;
  if (/sentence building|từ gợi ý/.test(combined)) return QuestionTaskType.SENTENCE_BUILDING;
  if (/translate|dịch/.test(combined)) return QuestionTaskType.TRANSLATION;
  if (/dictation|nghe chép/.test(combined)) return QuestionTaskType.DICTATION;
  if (/listen|nghe/.test(combined)) return QuestionTaskType.LISTENING;
  if (kind === QuestionKind.ESSAY || /writing|essay|bài luận|viết đoạn/.test(combined))
    return QuestionTaskType.WRITING;
  if (/vocabulary|từ vựng/.test(combined)) return QuestionTaskType.VOCABULARY;
  if (/grammar|ngữ pháp/.test(combined)) return QuestionTaskType.GRAMMAR;
  return QuestionTaskType.GENERAL;
}

async function parseWorkbook(buffer: Buffer) {
  const sheets = await loadWorkbookSheets(buffer);
  if (sheets.length > maxSheets)
    throw new BadRequestException(`Excel chỉ được tối đa ${maxSheets} trang tính.`);
  const totalRows = sheets.reduce((sum, item) => sum + item.rows.size, 0);
  if (totalRows > maxRows)
    throw new BadRequestException(`Excel chỉ được tối đa ${maxRows.toLocaleString("vi-VN")} dòng.`);

  const contentAliases = [
    "nội dung",
    "noi dung",
    "nội dung câu hỏi",
    "noi dung cau hoi",
    "câu hỏi",
    "cau hoi",
    "đề bài",
    "de bai",
    "question content",
    "question text",
    "content",
    "prompt",
    "stem",
  ];

  // Find sheet & header row containing question content (supporting template with Guide sheet or title rows)
  let selectedSheet: ParsedSheetData | undefined = sheets[0];
  let headerRowNumber = 1;
  let headers = new Map<string, number>();

  for (const ws of sheets) {
    if (/hướng dẫn|huong dan|guide|instruction/i.test(ws.name)) continue;
    const rowNumbers = [...ws.rows.keys()].sort((a, b) => a - b).slice(0, 10);
    const firstRowCells = rowNumbers[0] ? ws.rows.get(rowNumbers[0]) : undefined;
    const firstRowHeaders = new Set(
      firstRowCells ? [...firstRowCells.values()].map((v) => header(v)) : [],
    );
    if (firstRowHeaders.has("quy định") || firstRowHeaders.has("quy dinh")) continue;

    let matched = false;
    for (const rNum of rowNumbers) {
      const rowCells = ws.rows.get(rNum);
      if (!rowCells) continue;
      const wsHeaders = new Map<string, number>();
      for (const [col, val] of rowCells.entries()) {
        const h = header(val);
        if (h && !wsHeaders.has(h)) wsHeaders.set(h, col);
      }
      const hasContentCol = contentAliases.some((alias) => wsHeaders.has(alias));
      const isGuideRow = wsHeaders.has("bắt buộc") || wsHeaders.has("bat buoc");
      if (hasContentCol && !isGuideRow) {
        selectedSheet = ws;
        headerRowNumber = rNum;
        headers = wsHeaders;
        matched = true;
        break;
      }
    }
    if (matched) break;
  }

  if (!selectedSheet) throw new BadRequestException("File Excel không có trang dữ liệu.");
  if (headers.size === 0) {
    const firstRowNum = [...selectedSheet.rows.keys()].sort((a, b) => a - b)[0] || 1;
    headerRowNumber = firstRowNum;
    const firstRow = selectedSheet.rows.get(firstRowNum);
    if (firstRow) {
      for (const [col, val] of firstRow.entries()) {
        const h = header(val);
        if (h && !headers.has(h)) headers.set(h, col);
      }
    }
  }

  const find = (...names: string[]) => {
    for (const name of names) {
      const exact = headers.get(name);
      if (exact) return exact;
    }
    for (const [key, col] of headers.entries()) {
      if (names.some((name) => name.length > 2 && key.startsWith(name))) {
        return col;
      }
    }
    return undefined;
  };

  const optionLetters = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const columns = {
    position: find("câu", "cau", "stt", "số thứ tự", "so thu tu", "question", "no", "no.", "#"),
    kind: find("loại", "loai", "loại câu", "loai cau", "dạng", "dang", "type", "question type"),
    content: find(...contentAliases),
    image: find("hình ảnh", "hinh anh", "ảnh", "anh", "link ảnh", "url ảnh", "image", "image url"),
    answer: find("đáp án", "dap an", "đáp án đúng", "dap an dung", "answer", "correct answer", "key"),
    points: find("điểm", "diem", "điểm số", "diem so", "points", "score", "mark"),
    section: find("phần", "phan", "chuyên đề", "chuyen de", "chủ đề", "chu de", "kỹ năng", "ky nang", "section", "part", "topic"),
    options: optionLetters.map((letter) =>
      headers.get(letter) ||
      headers.get(`đáp án ${letter}`) ||
      headers.get(`dap an ${letter}`) ||
      headers.get(`phương án ${letter}`) ||
      headers.get(`phuong an ${letter}`) ||
      headers.get(`lựa chọn ${letter}`) ||
      headers.get(`option ${letter}`) ||
      headers.get(`choice ${letter}`),
    ),
  };
  if (!columns.content) throw new BadRequestException("Excel cần cột ‘Nội dung’.");
  const questions: ImportedQuestion[] = [];
  const sortedRowNumbers = [...selectedSheet.rows.keys()]
    .filter((r) => r > headerRowNumber)
    .sort((a, b) => a - b);

  for (const rowNumber of sortedRowNumbers) {
    const rowCells = selectedSheet.rows.get(rowNumber);
    if (!rowCells) continue;
    const get = (col?: number) => (col ? cleanExcelCell(rowCells.get(col) || "") : "");
    const rawContent = get(columns.content);
    if (!rawContent) continue;
    const imageUrl = get(columns.image);
    const content =
      imageUrl && /^https?:\/\//i.test(imageUrl) && !rawContent.includes(imageUrl)
        ? `${rawContent}\n\n![Hình minh họa](${imageUrl})`
        : rawContent;
    const options = columns.options
      .map((col, index) => {
        const value = get(col);
        if (!value) return "";
        const prefix = String.fromCharCode(65 + index);
        const stripped = value.replace(new RegExp(`^${prefix}\\s*[.)\\-:]\\s*`, "i"), "").trim();
        return `${prefix}. ${stripped || value}`;
      })
      .filter(Boolean);
    const rawKind = get(columns.kind).toLocaleLowerCase("vi");
    const kind =
      /đúng\s*\/?\s*sai|true\s*\/?\s*false/.test(rawKind)
        ? QuestionKind.TRUE_FALSE
        : /nhiều lựa chọn|multiple\s*(?:choice|select)/.test(rawKind)
          ? QuestionKind.MULTIPLE_CHOICE
          : options.length >= 2 || /trắc|choice/.test(rawKind)
            ? QuestionKind.SINGLE_CHOICE
            : /tự luận|essay/.test(rawKind)
              ? QuestionKind.ESSAY
              : QuestionKind.SHORT_TEXT;
    const sectionVal = get(columns.section) || null;
    const taskType = inferExcelTaskType(sectionVal || "", rawKind, rawContent, kind);
    const rawAnswer = get(columns.answer);
    const normalizedAnswer =
      kind === QuestionKind.SINGLE_CHOICE && rawAnswer
        ? rawAnswer.match(/^([A-H])(?:\s*[.):-]|\s*$)/i)?.[1]?.toUpperCase() || rawAnswer
        : rawAnswer;
    const parsedPoints = Number(get(columns.points).replace(",", "."));
    questions.push({
      position: questions.length + 1,
      sourceLabel: get(columns.position) || String(questions.length + 1),
      section: sectionVal,
      content: content.slice(0, 4000),
      options:
        kind === QuestionKind.TRUE_FALSE && options.length < 2
          ? ["True", "False"]
          : options.slice(0, 8),
      kind,
      taskType,
      sourcePage: 1,
      recognitionConfidence: 1,
      reviewFlags: [],
      sourceBounds: null,
      answer: normalizedAnswer || null,
      points:
        Number.isFinite(parsedPoints) && parsedPoints > 0 && parsedPoints <= 100
          ? parsedPoints
          : 1,
    });
  }
  return questions.slice(0, 500);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

export async function extractDocxFormattedText(buffer: Buffer): Promise<{
  text: string;
  messages: string[];
}> {
  const htmlResult = await mammoth
    .convertToHtml({ buffer }, { styleMap: ["u => u"] })
    .catch(() => null);
  if (htmlResult?.value?.trim()) {
    const converted = decodeHtmlEntities(
      htmlResult.value
        .replace(/<u>\s*([^<]+?)\s*<\/u>/gi, "__$1__")
        .replace(/<\/(?:td|th)>\s*<(?:td|th)[^>]*>/gi, " <COL> ")
        .replace(/<(?:br|\/p|\/div|\/tr|\/li|\/h[1-6])\b[^>]*>/gi, "\n")
        .replace(/<[^>]+>/g, ""),
    );
    if (converted.trim()) {
      return {
        text: converted,
        messages: htmlResult.messages.map((item) => item.message),
      };
    }
  }
  const rawResult = await mammoth.extractRawText({ buffer });
  return {
    text: rawResult.value,
    messages: rawResult.messages.map((item) => item.message),
  };
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
    const result = await extractDocxFormattedText(file.buffer);
    if (Buffer.byteLength(result.text, "utf8") > 2 * 1024 * 1024)
      throw new BadRequestException("Nội dung Word sau giải nén vượt 2 MB.");
    const parsed = parseQuestionTextLayout(result.text);
    const warnings = [...parsed.warnings, ...result.messages];
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
  workbook.creator = "Bright Path English Center";
  workbook.created = new Date();

  // Sheet 1: Hướng Dẫn
  const guideSheet = workbook.addWorksheet("Hướng dẫn sử dụng", {
    views: [{ showGridLines: true }],
  });
  guideSheet.columns = [
    { header: "Cột", key: "col", width: 16 },
    { header: "Quy định", key: "rule", width: 30 },
    { header: "Mô tả chi tiết & Ví dụ", key: "desc", width: 60 },
  ];
  guideSheet.addRow({ col: "Câu", rule: "Số thứ tự hoặc nhãn", desc: "Ví dụ: 1, 2, 3 hoặc Câu 1, Question 1" });
  guideSheet.addRow({ col: "Loại", rule: "Trắc nghiệm / Tự luận / Điền từ", desc: "Trắc nghiệm, Đúng/Sai, Trả lời ngắn, Tự luận" });
  guideSheet.addRow({ col: "Phần", rule: "Tùy chọn (Chủ đề / Kỹ năng)", desc: "Ví dụ: Phonetics, Vocabulary, Reading, Writing" });
  guideSheet.addRow({ col: "Nội dung", rule: "BẮT BUỘC", desc: "Nội dung câu hỏi. Hỗ trợ gạch chân __từ cần gạch__" });
  guideSheet.addRow({ col: "Hình ảnh", rule: "Tùy chọn (Link ảnh)", desc: "Dán link ảnh (https://...) nếu câu hỏi có hình minh họa" });
  guideSheet.addRow({ col: "A, B, C, D", rule: "Phương án trắc nghiệm", desc: "Nội dung phương án (không cần gõ lại tiền tố A., B.)" });
  guideSheet.addRow({ col: "Đáp án", rule: "Đáp án đúng", desc: "Ví dụ: A (với trắc nghiệm) hoặc từ/cụm từ (với điền từ)" });
  guideSheet.addRow({ col: "Điểm", rule: "Số điểm (Mặc định 1)", desc: "Số điểm cho câu hỏi, ví dụ: 1, 0.5, 2" });

  guideSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  guideSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF092B4C" } };
  guideSheet.getRow(1).height = 24;

  // Sheet 2: Câu hỏi (Dữ liệu nhập)
  const sheet = workbook.addWorksheet("Cau hoi", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });
  sheet.columns = [
    { header: "Câu", key: "position", width: 8 },
    { header: "Loại", key: "kind", width: 16 },
    { header: "Phần", key: "section", width: 20 },
    { header: "Nội dung", key: "content", width: 50 },
    { header: "Hình ảnh", key: "image", width: 25 },
    { header: "A", key: "a", width: 22 },
    { header: "B", key: "b", width: 22 },
    { header: "C", key: "c", width: 22 },
    { header: "D", key: "d", width: 22 },
    { header: "Đáp án", key: "answer", width: 12 },
    { header: "Điểm", key: "points", width: 10 },
  ];

  sheet.addRow({ position: 1, kind: "Trắc nghiệm", section: "Phonetics", content: "Choose the word whose underlined part is pronounced differently.", image: "", a: "m__a__p", b: "f__a__ther", c: "c__a__t", d: "h__a__t", answer: "B", points: 1 });
  sheet.addRow({ position: 2, kind: "Trắc nghiệm", section: "Vocabulary", content: "She is very interested _____ learning foreign languages.", image: "", a: "in", b: "at", c: "on", d: "for", answer: "A", points: 1 });
  sheet.addRow({ position: 3, kind: "Trắc nghiệm", section: "Grammar", content: "If it rains tomorrow, we _____ the picnic.", image: "", a: "cancel", b: "will cancel", c: "cancelled", d: "would cancel", answer: "B", points: 1 });
  sheet.addRow({ position: 4, kind: "Trả lời ngắn", section: "Sentence rewrite", content: "Rewrite the sentence: 'He started learning English 5 years ago.' -> He has ____________________", image: "", a: "", b: "", c: "", d: "", answer: "been learning English for 5 years", points: 2 });
  sheet.addRow({ position: 5, kind: "Trắc nghiệm", section: "Signs & Notices", content: "What does this traffic sign mean?", image: "https://images.unsplash.com/photo-1572953109213-3be62398eb95?w=500", a: "No parking", b: "No entry", c: "Speed limit 50", d: "Pedestrian crossing", answer: "B", points: 1 });

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123D68" } };
  sheet.getRow(1).height = 26;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
