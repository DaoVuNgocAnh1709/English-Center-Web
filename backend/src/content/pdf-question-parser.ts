import { QuestionKind } from "@prisma/client";

export type SourceBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
};

export type ExtractedQuestion = {
  position: number;
  sourceLabel: string;
  section: string | null;
  content: string;
  options: string[];
  kind: QuestionKind;
  sourcePage: number;
  recognitionConfidence: number;
  reviewFlags: string[];
  sourceBounds: SourceBounds | null;
};

export type PositionedLine = {
  text: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
};

type PdfTextItem = {
  str: string;
  width?: number;
  height?: number;
  transform?: number[];
};
type PdfDocument = {
  getPage(page: number): Promise<{
    getViewport(options: { scale: number }): { width: number; height: number };
    getTextContent(): Promise<{ items: PdfTextItem[] }>;
  }>;
  destroy(): Promise<void>;
};
type PdfJs = {
  getDocument(options: Record<string, unknown>): { promise: Promise<PdfDocument> };
};

const nativeImport = new Function(
  "specifier",
  "return import(specifier)",
) as (specifier: string) => Promise<PdfJs>;

const questionPattern = /^(?:(Câu|Question|Q(?:uestion)?)\s*)?(\d{1,3})\s*[.)\-:]\s*(.*)$/i;
const compactQuestionPattern = /^(\d{1,3})\s*(?=[A-ZÀ-Ỹ])(.{3,})$/;
const sectionPatterns = [
  /^(?:PART|SECTION|EXERCISE|PHẦN|BÀI|BAI)\s+[A-ZÀ-Ỹ0-9IVX]+\s*[.\-:]?\s*(.*)$/i,
  /^(?:[IVX]{1,6})[.)]\s*(.+)$/i,
];
const noisePatterns = [
  /^Ms\s+Helen/i,
  /^\d{1,3}$/,
  /^Cập nhật LỚP MỚI/i,
  /^vui lòng liên hệ qua Zalo/i,
  /^UNIT\s+\d+\s*$/i,
  /^TEST\s+\d+\s*$/i,
  /^(?:page|trang)\s*\d+(?:\s*\/\s*\d+)?$/i,
];
const instructionPattern = /\b(?:choose|circle|select|complete|fill|write|rewrite|read|answer|match|find|underline|give|put|use|mark|decide|listen|look|chọn|khoanh|điền|viết|đọc|trả lời|nối|tìm|gạch chân|chia|sắp xếp|hoàn thành|hãy)\b/i;
const vocabularyPattern = /(?:\b(?:n|v|adj|adv|phr\.?\s*v|prep|conj)\.?\b|\s\/\s|\([^)]{0,20}\)\s*[:：]|\b(?:nghĩa là|có nghĩa|đồng nghĩa|trái nghĩa)\b)/i;
const strongVocabularyPattern = /\/[^/\n]{1,50}\/\s*\((?:n|v|adj|adv|phr\.?\s*v|prep|conj)\.?\)\s*[:：]/i;
const theoryPattern = /^(?:định nghĩa|khái niệm|một số|các loại|cấu trúc|cách dùng|lưu ý|ghi nhớ|ví dụ|definition|concept|grammar|vocabulary|note)\b/i;
const answerKeyPattern = /^(?:answer\s*keys?|keys?|đáp\s*án)(?:\s|[:：-]|$)/i;
const matchingSectionPattern = /\b(?:match|matching|nối|ghép)\b/i;
const answerGridPattern = /^_{3,}\s*(?:\d{1,3}[.)]?\s*_{3,}\s*)+$/;

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function meaningful(line: string) {
  return line.length > 0 && !noisePatterns.some((pattern) => pattern.test(line));
}

function splitOptions(value: string) {
  const markers = [...value.matchAll(/(?:^|\s)([A-H])[.)]\s*/g)];
  if (markers.length < 2) return { prompt: clean(value), options: [] as string[] };
  return {
    prompt: clean(value.slice(0, markers[0].index)),
    options: markers
      .map((marker, index) => {
        const start = (marker.index ?? 0) + marker[0].length;
        const end = markers[index + 1]?.index ?? value.length;
        return `${marker[1].toUpperCase()}. ${clean(value.slice(start, end))}`;
      })
      .filter((option) => option.length > 3),
  };
}

function sectionTitle(value: string) {
  for (const pattern of sectionPatterns) {
    if (pattern.test(value)) return clean(value);
  }
  return null;
}

function matchQuestion(value: string) {
  const strict = value.match(questionPattern);
  if (strict)
    return { marker: strict[1] || "", label: strict[2], content: strict[3] };
  const compact = value.match(compactQuestionPattern);
  if (compact)
    return { marker: "", label: compact[1], content: compact[2] };
  return null;
}

function unionBounds(lines: PositionedLine[]): SourceBounds | null {
  const positioned = lines.filter((line) => line.pageWidth > 0 && line.pageHeight > 0);
  if (!positioned.length) return null;
  const first = positioned[0];
  const left = Math.min(...positioned.map((line) => line.x));
  const bottom = Math.min(...positioned.map((line) => line.y));
  const right = Math.max(...positioned.map((line) => line.x + line.width));
  const top = Math.max(...positioned.map((line) => line.y + line.height));
  return {
    x: Number((left / first.pageWidth).toFixed(4)),
    y: Number(((first.pageHeight - top) / first.pageHeight).toFixed(4)),
    width: Number(((right - left) / first.pageWidth).toFixed(4)),
    height: Number(((top - bottom) / first.pageHeight).toFixed(4)),
    pageWidth: first.pageWidth,
    pageHeight: first.pageHeight,
  };
}

function analyseCandidate(
  label: string,
  explicitMarker: boolean,
  content: string,
  options: string[],
  section: string | null,
  previousLabel: number | null,
) {
  const flags: string[] = [];
  const numericLabel = Number(label);
  const hasInstruction = instructionPattern.test(content);
  const hasBlank = /_{3,}|\.{5,}|\[blank\]/i.test(content);
  const looksVocabulary =
    options.length < 2 &&
    (strongVocabularyPattern.test(content) ||
      (vocabularyPattern.test(content) && (!explicitMarker || !hasInstruction)));
  const looksTheory =
    !explicitMarker && theoryPattern.test(content) && !hasBlank && options.length < 2;
  let confidence = explicitMarker ? 0.62 : 0.34;
  if (options.length >= 2) confidence += 0.24;
  if (hasInstruction || hasBlank || /[?？]$/.test(content)) confidence += 0.14;
  if (section) confidence += 0.05;
  if (content.length >= 18) confidence += 0.05;
  if (previousLabel !== null && numericLabel === previousLabel + 1) confidence += 0.06;
  if (!explicitMarker) flags.push("AMBIGUOUS_NUMBERING");
  if (!options.length) flags.push("NO_OPTIONS");
  if (looksVocabulary) {
    confidence -= 0.48;
    flags.push("POSSIBLE_VOCABULARY");
  }
  if (looksTheory) {
    confidence -= 0.4;
    flags.push("POSSIBLE_THEORY");
  }
  if (!hasInstruction && !options.length && content.length < 24) confidence -= 0.12;
  confidence = Math.max(0.05, Math.min(0.99, confidence));
  if (confidence < 0.68) flags.push("LOW_CONFIDENCE");
  return { confidence: Number(confidence.toFixed(2)), flags, looksVocabulary, looksTheory };
}

function orderPageLines(lines: PositionedLine[]) {
  const candidates = lines.filter((line) => matchQuestion(line.text));
  const width = lines[0]?.pageWidth || 0;
  const left = candidates.filter((line) => line.x < width * 0.42);
  const right = candidates.filter((line) => line.x > width * 0.5);
  const twoColumns = width > 0 && left.length >= 2 && right.length >= 2;
  if (!twoColumns) return [...lines].sort((a, b) => b.y - a.y || a.x - b.x);

  const highestQuestion = Math.max(...candidates.map((item) => item.y));
  const topHeading = lines.filter((line) => line.width > width * 0.58 && line.y > highestQuestion);
  const body = lines.filter((line) => !topHeading.includes(line));
  const leftColumn = body.filter((line) => line.x + line.width / 2 < width * 0.52);
  const rightColumn = body.filter((line) => !leftColumn.includes(line));
  const sort = (items: PositionedLine[]) => items.sort((a, b) => b.y - a.y || a.x - b.x);
  return [...sort(topHeading), ...sort(leftColumn), ...sort(rightColumn)];
}

export function parseQuestionPageLayouts(pages: PositionedLine[][]) {
  return parsePositionedQuestionLines(pages.flatMap((lines) => orderPageLines(lines)));
}

export function parsePositionedQuestionLines(lines: PositionedLine[]) {
  const questions: ExtractedQuestion[] = [];
  const warnings: string[] = [];
  let currentSection: string | null = null;
  let pendingContext: string[] = [];
  let previousLabel: number | null = null;
  let rejectedCandidates = 0;
  let inAnswerKey = false;
  const matchingOptions = new Map<string, string[]>();
  let pending: {
    label: string;
    explicitMarker: boolean;
    text: string;
    section: string | null;
    lines: PositionedLine[];
  } | null = null;

  const flush = () => {
    if (!pending) return;
    const matchingSection = Boolean(pending.section && matchingSectionPattern.test(pending.section));
    if (matchingSection && answerGridPattern.test(clean(pending.text.replace(/<COL>/g, " ")))) {
      rejectedCandidates += 1;
      pending = null;
      return;
    }
    let sourceText = pending.text;
    let matchingOption: string | null = null;
    let complexMatchingLayout = false;
    if (matchingSection && sourceText.includes("<COL>")) {
      const columns = sourceText.split("<COL>").map(clean).filter(Boolean);
      sourceText = columns[0] || sourceText;
      const optionColumn = columns.slice(1).join(" ");
      const optionMatch = optionColumn.match(/^([A-Ha-h])[.,)]\s*(.+)$/);
      if (optionMatch)
        matchingOption = `${optionMatch[1].toUpperCase()}. ${clean(optionMatch[2])}`;
    } else if (matchingSection) {
      const inlineOption = sourceText.match(/^(.*?)\s+([A-Ha-h])[.,)]\s*(.+)$/);
      if (inlineOption) {
        sourceText = clean(inlineOption[1]);
        matchingOption = `${inlineOption[2].toUpperCase()}. ${clean(inlineOption[3])}`;
        complexMatchingLayout = true;
      }
    }
    // `<COL>` is an internal layout delimiter. Outside matching exercises it
    // only means that PDF tokens were visually far apart on the same row and
    // must never leak into a question or one of its choices.
    if (!matchingSection) sourceText = clean(sourceText.replace(/<COL>/g, " "));
    const { prompt, options } = splitOptions(sourceText);
    const content = prompt || pending.section || `Câu ${pending.label}`;
    const analysis = analyseCandidate(
      pending.label,
      pending.explicitMarker,
      content,
      options,
      pending.section,
      previousLabel,
    );
    previousLabel = Number(pending.label);
    if ((analysis.looksVocabulary || analysis.looksTheory) && analysis.confidence < 0.28) {
      rejectedCandidates += 1;
      pending = null;
      return;
    }
    const extractedQuestion: ExtractedQuestion = {
      position: questions.length + 1,
      sourceLabel: pending.label,
      section: pending.section,
      content: content.slice(0, 8000),
      options: options.slice(0, 8).map((option) => option.slice(0, 1000)),
      kind:
        options.length >= 2
          ? QuestionKind.SINGLE_CHOICE
          : /(?:essay|paragraph|write|writing|viết đoạn|bài luận)/i.test(`${pending.section || ""} ${content}`)
            ? QuestionKind.ESSAY
            : QuestionKind.SHORT_TEXT,
      sourcePage: pending.lines[0]?.page || 1,
      recognitionConfidence: analysis.confidence,
      reviewFlags: analysis.flags,
      sourceBounds: unionBounds(pending.lines),
    };
    if (complexMatchingLayout) {
      extractedQuestion.recognitionConfidence = Math.min(extractedQuestion.recognitionConfidence, 0.55);
      extractedQuestion.reviewFlags = [...new Set([...extractedQuestion.reviewFlags, "COMPLEX_LAYOUT", "LOW_CONFIDENCE"])];
    }
    questions.push(extractedQuestion);
    if (matchingOption && pending.section) {
      const group = matchingOptions.get(pending.section) || [];
      group.push(matchingOption);
      matchingOptions.set(pending.section, group);
    }
    pending = null;
  };

  for (const line of lines) {
    if (!meaningful(line.text)) continue;
    if (answerKeyPattern.test(line.text)) {
      flush();
      inAnswerKey = true;
      pendingContext = [];
      continue;
    }
    const heading = sectionTitle(line.text);
    if (heading) {
      flush();
      currentSection = heading;
      pendingContext = [];
      previousLabel = null;
      inAnswerKey = false;
      continue;
    }
    if (inAnswerKey) continue;
    const match = matchQuestion(line.text);
    if (match) {
      flush();
      const context = pendingContext.join(" ").slice(0, 8000);
      if (context) {
        currentSection =
          currentSection && !context.startsWith(currentSection)
            ? `${currentSection}\n${context}`
            : context;
      }
      pending = {
        label: match.label,
        explicitMarker: Boolean(match.marker),
        text: clean(match.content),
        section: currentSection,
        lines: [line],
      };
      pendingContext = [];
      continue;
    }
    if (pending) {
      pending.text = clean(`${pending.text} ${line.text}`);
      pending.lines.push(line);
    } else if (line.text.length > 20 && pendingContext.join(" ").length < 8000) {
      pendingContext.push(line.text);
    }
  }
  flush();

  for (const question of questions) {
    if (!question.section || !matchingSectionPattern.test(question.section)) continue;
    const options = matchingOptions.get(question.section) || [];
    if (options.length < 2) continue;
    question.options = options;
    question.kind = QuestionKind.SINGLE_CHOICE;
    if (!question.reviewFlags.includes("COMPLEX_LAYOUT"))
      question.recognitionConfidence = Math.max(question.recognitionConfidence, 0.72);
    question.reviewFlags = [
      ...question.reviewFlags.filter((flag) => flag !== "NO_OPTIONS" && flag !== "LOW_CONFIDENCE"),
      "MATCHING_CONVERTED",
    ];
    if (question.reviewFlags.includes("COMPLEX_LAYOUT"))
      question.reviewFlags.push("LOW_CONFIDENCE");
  }

  if (rejectedCandidates)
    warnings.push(`Đã loại ${rejectedCandidates} dòng đánh số có dấu hiệu là từ vựng hoặc chú thích, không phải câu hỏi.`);
  const needsReview = questions.filter((question) => question.recognitionConfidence < 0.68).length;
  if (needsReview)
    warnings.push(`${needsReview} câu có độ tin cậy thấp đã được đánh dấu để giáo viên kiểm tra.`);
  if (questions.some((question) => !question.options.length))
    warnings.push("Một số câu không có phương án A–D; hãy kiểm tra loại câu và nội dung.");
  return { questions, warnings };
}

export function parseQuestionTextLayout(text: string, sourcePage = 1) {
  const lines: PositionedLine[] = text
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean)
    .map((value, index) => ({
      text: value,
      page: sourcePage,
      x: 0,
      y: 10000 - index * 20,
      width: 0,
      height: 0,
      pageWidth: 0,
      pageHeight: 0,
    }));
  return parsePositionedQuestionLines(lines);
}

function buildLines(items: PdfTextItem[], page: number, pageWidth: number, pageHeight: number) {
  const tokens = items
    .filter((item) => clean(item.str).length > 0)
    .map((item) => ({
      text: clean(item.str),
      x: Number(item.transform?.[4] || 0),
      y: Number(item.transform?.[5] || 0),
      width: Math.max(0, Number(item.width || 0)),
      height: Math.max(8, Number(item.height || Math.abs(item.transform?.[3] || 10))),
    }));
  const rows: typeof tokens[] = [];
  for (const token of tokens.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((candidate) => Math.abs(candidate[0].y - token.y) <= Math.max(2.5, token.height * 0.35));
    if (row) row.push(token);
    else rows.push([token]);
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    const x = Math.min(...row.map((item) => item.x));
    const y = Math.min(...row.map((item) => item.y));
    const right = Math.max(...row.map((item) => item.x + item.width));
    const height = Math.max(...row.map((item) => item.height));
    const fragments: string[] = [];
    row.forEach((item, index) => {
      if (index > 0) {
        const previous = row[index - 1];
        const gap = item.x - (previous.x + previous.width);
        if (gap > Math.max(28, height * 2.5)) fragments.push("<COL>");
      }
      fragments.push(item.text);
    });
    return {
      text: clean(fragments.join(" ")),
      page,
      x,
      y,
      width: right - x,
      height,
      pageWidth,
      pageHeight,
    };
  });
}

export async function extractQuestionsFromPdf(bytes: Uint8Array, startPage: number, endPage: number) {
  const pdfjs = await nativeImport("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false }).promise;
  const allLines: PositionedLine[] = [];
  try {
    for (let pageNumber = startPage; pageNumber <= endPage; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const text = await page.getTextContent();
      allLines.push(...orderPageLines(buildLines(text.items, pageNumber, viewport.width, viewport.height)));
    }
  } finally {
    await document.destroy();
  }
  const result = parsePositionedQuestionLines(allLines);
  if (!result.questions.length)
    result.warnings.push("Không nhận diện được câu hỏi. PDF có thể là ảnh scan và cần OCR.");
  return result;
}
