import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AttemptStatus,
  ContentStatus,
  ExamAccess,
  ExtractionProvider,
  Prisma,
  QuestionKind,
  QuestionTaskType,
  Role,
  SchoolLevel,
  SourceImportStatus,
} from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import { join } from "path";
import { PrismaService } from "../prisma/prisma.service";
import {
  ImportedQuestion,
  createExamTemplate,
  extractPdfWithOcr,
  inspectExamSource,
  probeExamSource,
} from "./question-importer";
import { AntivirusService, MalwareDetectedError } from "./antivirus.service";
import {
  GeminiImportResult,
  GeminiImportService,
} from "./gemini-import.service";
import {
  applyCorrectionMemory,
  questionSignature,
  snapshotQuestion,
} from "./recognition-learning";

export type Upload = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};
const root = process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
const slug = (text: string) =>
  `${
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 65) || "noi-dung"
  }-${randomUUID().slice(0, 8)}`;
function safeFile(file: Upload, pdfOnly = false) {
  const maxMb = Number(process.env.UPLOAD_MAX_FILE_MB || 15);
  if (!file || !file.buffer || file.size > maxMb * 1024 * 1024 || file.size < 8)
    throw new BadRequestException(`Tệp không hợp lệ hoặc vượt ${maxMb} MB.`);
  const pdf = file.buffer.subarray(0, 5).toString() === "%PDF-";
  const docx =
    file.buffer.subarray(0, 2).toString() === "PK" &&
    /\.docx$/i.test(file.originalname);
  if (pdfOnly ? !pdf : !pdf && !docx)
    throw new BadRequestException(
      pdfOnly ? "Chỉ chấp nhận PDF." : "Chỉ chấp nhận PDF/DOCX.",
    );
  return pdf
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}
async function save(
  buffer: Uint8Array,
  extension: "pdf" | "docx" | "xlsx" | "png" | "jpg",
  folder = "sources",
) {
  await mkdir(join(root, folder), { recursive: true });
  const key = `${folder}/${randomUUID()}.${extension}`;
  await writeFile(join(root, key), buffer);
  return key;
}

const numberSetting = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

async function withTimeout<T>(task: Promise<T>, milliseconds: number) {
  let timer: NodeJS.Timeout;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("IMPORT_TIMEOUT")), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
function assertLevel(level: string, grade: number) {
  if (
    !Object.values(SchoolLevel).includes(level as SchoolLevel) ||
    !Number.isInteger(grade) ||
    grade < 0 ||
    grade > 12 ||
    (level === "PRESCHOOL" && grade !== 0) ||
    (level === "PRIMARY" && grade > 5) ||
    (level === "PRIMARY" && grade < 1) ||
    (level === "MIDDLE" && (grade < 6 || grade > 9)) ||
    (level === "HIGH" && grade < 10)
  )
    throw new BadRequestException("Cấp học/lớp không hợp lệ.");
}

function cleanAnswers(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BadRequestException("Phiếu trả lời không hợp lệ.");
  const entries = Object.entries(value);
  if (entries.length > 200)
    throw new BadRequestException("Phiếu trả lời không hợp lệ.");
  const answers: Record<string, string> = {};
  for (const [key, answer] of entries) {
    const position = Number(key);
    if (
      !Number.isInteger(position) ||
      position < 1 ||
      position > 200 ||
      typeof answer !== "string" ||
      answer.length > 10000
    )
      throw new BadRequestException("Phiếu trả lời không hợp lệ.");
    answers[String(position)] = answer.trim();
  }
  return answers;
}

function manualScoresRecord(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, score]) => Number.isFinite(Number(score))),
  ) as Record<string, number>;
}

function cleanInteractionData(value: unknown): Prisma.InputJsonObject | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  const list = (candidate: unknown) =>
    Array.isArray(candidate)
      ? candidate.map(String).map((entry) => entry.trim().slice(0, 1_000)).filter(Boolean).slice(0, 40)
      : [];
  return {
    matchingLeft: list(item.matchingLeft),
    matchingRight: list(item.matchingRight),
    orderingItems: list(item.orderingItems),
  };
}

const hashGuestToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function normalizedScoringAnswer(
  value: string,
  kind: QuestionKind,
  taskType: QuestionTaskType = QuestionTaskType.GENERAL,
) {
  const normalized = value.trim().normalize("NFC");
  if (taskType === QuestionTaskType.MATCHING) {
    try {
      const parsed = JSON.parse(normalized) as unknown;
      if (Array.isArray(parsed))
        return parsed.map((item) => String(item).trim().toLocaleLowerCase("vi")).join("|");
      if (parsed && typeof parsed === "object")
        return Object.entries(parsed as Record<string, unknown>)
          .sort(([left], [right]) => Number(left) - Number(right))
          .map(([, item]) => String(item).trim().toLocaleLowerCase("vi"))
          .join("|");
    } catch {}
  }
  if (taskType === QuestionTaskType.ORDERING) {
    try {
      const parsed = JSON.parse(normalized) as unknown;
      if (Array.isArray(parsed))
        return parsed.map((item) => String(item).trim().toLocaleLowerCase("vi")).join("|");
    } catch {}
  }
  if (kind === QuestionKind.SINGLE_CHOICE) {
    const letter = normalized.match(/^([A-H])(?:[.)]|\s|$)/i)?.[1];
    if (letter) return letter.toUpperCase();
  }
  if (kind === QuestionKind.TRUE_FALSE) {
    if (/^(true|t|đúng|yes|y)$/i.test(normalized)) return "TRUE";
    if (/^(false|f|sai|no|n)$/i.test(normalized)) return "FALSE";
  }
  if (kind === QuestionKind.MULTIPLE_CHOICE) {
    let values: string[] = [];
    try {
      const parsed = JSON.parse(normalized) as unknown;
      if (Array.isArray(parsed)) values = parsed.map(String);
    } catch {
      values = normalized.split(/[;,|]+/);
    }
    return values
      .map((item) => {
        const clean = item.trim();
        return clean.match(/^([A-H])(?:[.)]|\s|$)/i)?.[1]?.toUpperCase() || clean.toLocaleLowerCase();
      })
      .filter(Boolean)
      .sort()
      .join("|");
  }
  return normalized.toLocaleLowerCase();
}
function parseKeys(text: string) {
  const result = new Map<number, string>();
  if (!text.trim()) return result;
  for (const entry of text.split(/[\n;,]+/)) {
    if (!entry.trim()) continue;
    const match = entry.trim().match(/^(\d{1,3})\s*[:.-]\s*(.{1,100})$/);
    if (!match)
      throw new BadRequestException(
        `Đáp án không đúng định dạng: ${entry.trim()}`,
      );
    const index = Number(match[1]);
    if (index < 1 || result.has(index))
      throw new BadRequestException("Số câu trùng hoặc không hợp lệ.");
    result.set(index, match[2].trim());
  }
  if (result.size > 200) throw new BadRequestException("Tối đa 200 câu/đề.");
  return result;
}

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly antivirus: AntivirusService,
    private readonly geminiImport: GeminiImportService,
  ) {}

  private async extractPdfWithGemini(
    buffer: Buffer,
    onProgress?: (completed: number, total: number) => Promise<void>,
  ): Promise<GeminiImportResult> {
    const pagesPerRequest = Math.max(
      1,
      Math.min(10, numberSetting("AI_IMPORT_PAGES_PER_REQUEST", 2)),
    );
    const overlap = Math.max(
      0,
      Math.min(pagesPerRequest - 1, numberSetting("AI_IMPORT_PAGE_OVERLAP", 1)),
    );
    try {
      const source = await PDFDocument.load(buffer);
      if (source.getPageCount() <= pagesPerRequest)
        return this.geminiImport.extractPdf(buffer);

      const successful: Extract<GeminiImportResult, { status: "SUCCESS" }>[] = [];
      const fallbackReasons: string[] = [];
      const offsets: number[] = [];
      const step = Math.max(1, pagesPerRequest - overlap);
      for (let offset = 0; offset < source.getPageCount(); offset += step) {
        offsets.push(offset);
        if (offset + pagesPerRequest >= source.getPageCount()) break;
      }
      for (const [batchIndex, offset] of offsets.entries()) {
        const chunk = await PDFDocument.create();
        const indices = Array.from(
          { length: Math.min(pagesPerRequest, source.getPageCount() - offset) },
          (_, index) => offset + index,
        );
        const pages = await chunk.copyPages(source, indices);
        pages.forEach((page) => chunk.addPage(page));
        const chunkBytes = Buffer.from(await chunk.save());
        let result = await this.geminiImport.extractPdf(chunkBytes);
        if (result.status !== "SUCCESS") {
          try {
            const local = await extractPdfWithOcr(chunkBytes, 1, indices.length);
            fallbackReasons.push(`Cụm ${batchIndex + 1}: ${result.reason}`);
            successful.push({
              status: "SUCCESS",
              model: result.model || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
              questions: local.questions.map((question) => ({
                ...question,
                sourcePage: (question.sourcePage || 1) + offset,
                extractionBatch: batchIndex + 1,
                recognitionProvider: ExtractionProvider.LOCAL_FALLBACK,
                recognitionModel: null,
              })),
              warnings: [
                `Cụm ${batchIndex + 1} dùng nhận diện nội bộ vì Gemini không khả dụng.`,
                ...local.warnings,
              ],
              usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            });
            await onProgress?.(batchIndex + 1, offsets.length);
            continue;
          } catch {
            return result;
          }
        }
        const suspicious = result.questions.some(
          (question) =>
            (question.recognitionConfidence ?? 0) < 0.78 ||
            question.reviewFlags?.includes("NO_OPTIONS"),
        );
        if (
          suspicious &&
          process.env.AI_IMPORT_REVIEW_ENABLED === "true"
        ) {
          const reviewed = await this.geminiImport.extractPdf(
            chunkBytes,
            {
              model:
                process.env.GEMINI_REVIEW_MODEL ||
                process.env.GEMINI_MODEL ||
                "gemini-3.5-flash-lite",
            },
          );
          if (reviewed.status === "SUCCESS") {
            const quality = (questions: ImportedQuestion[]) =>
              questions.reduce(
                (score, question) =>
                  score +
                  (question.recognitionConfidence ?? 0) -
                  (question.reviewFlags?.includes("NO_OPTIONS") ? 1 : 0),
                0,
              );
            if (quality(reviewed.questions) > quality(result.questions))
              result = {
                ...reviewed,
                warnings: [
                  ...reviewed.warnings,
                  `Cụm ${batchIndex + 1} đã được kiểm tra lần hai vì có câu chưa chắc chắn.`,
                ],
              };
          }
        }
        successful.push({
          ...result,
          questions: result.questions.map((question) => ({
            ...question,
            sourcePage: (question.sourcePage || 1) + offset,
            extractionBatch: batchIndex + 1,
          })),
        });
        await onProgress?.(batchIndex + 1, offsets.length);
      }

      const seen = new Set<string>();
      const questions = successful
        .flatMap((result) => result.questions)
        .filter((question) => {
          const key = `${question.sourcePage || 0}|${question.sourceLabel || ""}|${questionSignature(question)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 200)
        .map((question, index) => ({ ...question, position: index + 1 }));
      return {
        status: "SUCCESS",
        model: successful[0]?.model || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
        questions,
        warnings: [...new Set(successful.flatMap((result) => result.warnings))],
        usage: {
          inputTokens: successful.reduce((sum, result) => sum + result.usage.inputTokens, 0),
          outputTokens: successful.reduce((sum, result) => sum + result.usage.outputTokens, 0),
          totalTokens: successful.reduce((sum, result) => sum + result.usage.totalTokens, 0),
        },
        ...(fallbackReasons.length
          ? { warnings: [...new Set([
              ...successful.flatMap((result) => result.warnings),
              ...fallbackReasons,
            ])] }
          : {}),
      };
    } catch {
      // Unit tests and legacy rows can contain non-PDF placeholder bytes. The
      // Gemini service still validates/falls back safely for those inputs.
      return this.geminiImport.extractPdf(buffer);
    }
  }

  async uploadSource(file: Upload, userId: string) {
    const maxBytes = numberSetting("UPLOAD_MAX_FILE_MB", 15) * 1024 * 1024;
    if (!file || !file.buffer || file.size > maxBytes || file.size < 8)
      throw new BadRequestException(`Tệp không hợp lệ hoặc vượt ${numberSetting("UPLOAD_MAX_FILE_MB", 15)} MB.`);
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [recentSources, recentMaterials] = await Promise.all([
      this.prisma.examSource.count({ where: { uploadedById: userId, createdAt: { gte: since } } }),
      this.prisma.material.count({ where: { createdById: userId, createdAt: { gte: since } } }),
    ]);
    if (recentSources + recentMaterials >= numberSetting("UPLOADS_PER_USER_PER_HOUR", 20))
      throw new BadRequestException("Bạn đã đạt giới hạn tải lên trong một giờ. Vui lòng thử lại sau.");
    const checksum = createHash("sha256").update(file.buffer).digest("hex");
    const duplicate = await this.prisma.examSource.findFirst({
      where: { uploadedById: userId, checksum, status: { not: SourceImportStatus.FAILED } },
      orderBy: { createdAt: "desc" },
    });
    if (duplicate) return { ...duplicate, duplicate: true };
    await this.assertStorageQuota(userId, file.size);
    const imported = await probeExamSource(file);
    const fileKey = await save(file.buffer, imported.extension, "quarantine");
    return this.prisma.examSource.create({
      data: {
        fileKey,
        fileName: file.originalname.slice(0, 180),
        mimeType: imported.mimeType,
        pageCount: imported.pageCount,
        sizeBytes: file.size,
        checksum,
        status: SourceImportStatus.QUEUED,
        progress: 5,
        statusMessage: "Đang chờ kiểm tra an toàn",
        uploadedById: userId,
      },
    });
  }

  async uploadSources(files: Upload[], userId: string) {
    if (!files?.length) throw new BadRequestException("Chưa chọn tệp đề.");
    if (files.length === 1) return this.uploadSource(files[0], userId);
    if (files.length > numberSetting("UPLOAD_MAX_IMAGE_FILES", 20))
      throw new BadRequestException(`Chỉ được chọn tối đa ${numberSetting("UPLOAD_MAX_IMAGE_FILES", 20)} ảnh.`);
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > numberSetting("UPLOAD_MAX_BATCH_MB", 50) * 1024 * 1024)
      throw new BadRequestException(`Một lượt ảnh chỉ được tối đa ${numberSetting("UPLOAD_MAX_BATCH_MB", 50)} MB.`);
    const output = await PDFDocument.create();
    for (const file of files) {
      const probe = await probeExamSource(file);
      if (!probe.mimeType.startsWith("image/"))
        throw new BadRequestException("Khi chọn nhiều tệp, tất cả phải là ảnh JPG hoặc PNG.");
      const embedded = probe.mimeType === "image/png"
        ? await output.embedPng(file.buffer)
        : await output.embedJpg(file.buffer);
      const page = output.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
    }
    const buffer = Buffer.from(await output.save());
    return this.uploadSource({
      buffer,
      size: buffer.length,
      mimetype: "application/pdf",
      originalname: `${files[0].originalname.replace(/\.[^.]+$/, "").slice(0, 120)}-va-${files.length - 1}-anh.pdf`,
    }, userId);
  }

  private async assertStorageQuota(userId: string, incomingBytes: number) {
    const [allSources, userSources, allMaterials, userMaterials] = await Promise.all([
      this.prisma.examSource.aggregate({ _sum: { sizeBytes: true } }),
      this.prisma.examSource.aggregate({ where: { uploadedById: userId }, _sum: { sizeBytes: true } }),
      this.prisma.material.aggregate({ _sum: { sizeBytes: true } }),
      this.prisma.material.aggregate({ where: { createdById: userId }, _sum: { sizeBytes: true } }),
    ]);
    const total = (allSources._sum.sizeBytes || 0) + (allMaterials._sum.sizeBytes || 0);
    const byUser = (userSources._sum.sizeBytes || 0) + (userMaterials._sum.sizeBytes || 0);
    const totalQuota = numberSetting("UPLOAD_TOTAL_QUOTA_MB", 10240) * 1024 * 1024;
    const userQuota = numberSetting("UPLOAD_USER_QUOTA_MB", 2048) * 1024 * 1024;
    if (total + incomingBytes > totalQuota)
      throw new BadRequestException("Kho lưu trữ của trung tâm đã đầy. Vui lòng dọn tệp cũ hoặc tăng dung lượng.");
    if (byUser + incomingBytes > userQuota)
      throw new BadRequestException("Bạn đã dùng hết dung lượng tải lên được cấp.");
  }

  async processNextSource() {
    const next = await this.prisma.examSource.findFirst({
      where: { status: SourceImportStatus.QUEUED },
      orderBy: { createdAt: "asc" },
    });
    if (!next) return false;
    const claimed = await this.prisma.examSource.updateMany({
      where: { id: next.id, status: SourceImportStatus.QUEUED },
      data: { status: SourceImportStatus.SCANNING, progress: 15, statusMessage: "Đang quét mã độc" },
    });
    if (!claimed.count) return false;
    try {
      const buffer = await readFile(join(root, next.fileKey));
      await this.antivirus.scan(buffer);
      await this.prisma.examSource.update({
        where: { id: next.id },
        data: { status: SourceImportStatus.PROCESSING, progress: 45, statusMessage: "Đang nhận dạng nội dung" },
      });
      const imported = await withTimeout(
        inspectExamSource({ buffer, originalname: next.fileName, mimetype: next.mimeType }),
        numberSetting("IMPORT_TIMEOUT_MS", 180000),
      );
      const cleanKey = next.fileKey.replace(/^quarantine\//, "sources/");
      await mkdir(join(root, "sources"), { recursive: true });
      if (cleanKey !== next.fileKey) await rename(join(root, next.fileKey), join(root, cleanKey));
      await this.prisma.examSource.update({
        where: { id: next.id },
        data: {
          fileKey: cleanKey,
          pageCount: imported.pageCount,
          mimeType: imported.mimeType,
          importDraft: imported.questions as unknown as Prisma.InputJsonValue,
          importWarnings: imported.warnings as Prisma.InputJsonValue,
          status: SourceImportStatus.READY,
          progress: 100,
          statusMessage: "Sẵn sàng tạo đề",
          lastError: null,
          processedAt: new Date(),
        },
      });
    } catch (error) {
      const quarantined = error instanceof MalwareDetectedError;
      const message = error instanceof Error && error.message !== "IMPORT_TIMEOUT"
        ? error.message
        : "Xử lý tệp quá thời gian cho phép; hãy giảm dung lượng hoặc số trang.";
      await this.prisma.examSource.update({
        where: { id: next.id },
        data: {
          status: quarantined ? SourceImportStatus.QUARANTINED : SourceImportStatus.FAILED,
          progress: 100,
          statusMessage: quarantined ? "Tệp đã bị cách ly" : "Không thể xử lý tệp",
          lastError: message.slice(0, 500),
        },
      });
    }
    return true;
  }

  async processNextExam() {
    const next = await this.prisma.exam.findFirst({
      where: { extractionStatus: SourceImportStatus.QUEUED },
      include: {
        source: true,
        questions: { orderBy: { position: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    });
    if (!next) return false;
    const claimed = await this.prisma.exam.updateMany({
      where: { id: next.id, extractionStatus: SourceImportStatus.QUEUED },
      data: {
        extractionStatus: SourceImportStatus.PROCESSING,
        extractionProgress: 25,
        extractionError: null,
        extractionWarnings: ["Đang đọc nội dung và nhận dạng câu hỏi."],
      },
    });
    if (!claimed.count) return false;
    let extractionProvider: ExtractionProvider = ExtractionProvider.LOCAL;
    let aiModel: string | null = null;
    let aiInputTokens: number | null = null;
    let aiOutputTokens: number | null = null;
    let aiFallbackReason: string | null = null;
    try {
      let extracted: { questions: ImportedQuestion[]; warnings: string[] };
      if (next.source.mimeType === "application/pdf") {
        // The exam file has already been cropped to the teacher-selected page
        // range. Sending only that file reduces Gemini tokens and avoids
        // extracting unrelated pages from the source document.
        const croppedPdf = await readFile(join(root, next.fileKey));
        const ai = await this.extractPdfWithGemini(
          croppedPdf,
          async (completed, total) => {
            await this.prisma.exam.updateMany({
              where: {
                id: next.id,
                extractionStatus: SourceImportStatus.PROCESSING,
              },
              data: {
                extractionProgress: Math.min(
                  80,
                  30 + Math.round((completed / total) * 50),
                ),
                extractionWarnings: [
                  `Đã xử lý cụm ${completed}/${total}; đang kiểm tra và ghép câu hỏi.`,
                ],
              },
            });
          },
        );
        if (ai.status === "SUCCESS") {
          const usedLocalFallback = ai.questions.some(
            (question) =>
              question.recognitionProvider === ExtractionProvider.LOCAL_FALLBACK,
          );
          extractionProvider = usedLocalFallback
            ? ExtractionProvider.LOCAL_FALLBACK
            : ExtractionProvider.GEMINI;
          aiModel = ai.model;
          aiInputTokens = ai.usage.inputTokens;
          aiOutputTokens = ai.usage.outputTokens;
          aiFallbackReason = usedLocalFallback
            ? "Một số cụm trang không dùng được Gemini và đã tự chuyển sang nhận diện nội bộ."
            : null;
          extracted = {
            questions: ai.questions.map((question) => ({
              ...question,
              recognitionProvider:
                question.recognitionProvider || ExtractionProvider.GEMINI,
              recognitionModel:
                question.recognitionProvider === ExtractionProvider.LOCAL_FALLBACK
                  ? null
                  : ai.model,
              sourcePage: question.sourcePage
                ? Math.min(
                    next.endPage,
                    Math.max(next.startPage, next.startPage + question.sourcePage - 1),
                  )
                : next.startPage,
            })),
            warnings: [...ai.warnings],
          };
        } else {
          if (ai.status !== "DISABLED") {
            extractionProvider = ExtractionProvider.LOCAL_FALLBACK;
            aiModel = ai.model;
            aiFallbackReason = ai.reason;
          }
          extracted = await withTimeout(
            extractPdfWithOcr(
              new Uint8Array(await readFile(join(root, next.source.fileKey))),
              next.startPage,
              next.endPage,
            ),
            numberSetting("IMPORT_TIMEOUT_MS", 180000),
          );
          extracted.questions = extracted.questions.map((question) => ({
            ...question,
            recognitionProvider:
              ai.status === "DISABLED"
                ? ExtractionProvider.LOCAL
                : ExtractionProvider.LOCAL_FALLBACK,
            recognitionModel: null,
          }));
          if (ai.status !== "DISABLED") extracted.warnings.unshift(ai.reason);
        }
      } else {
        extracted = {
            questions: Array.isArray(next.source.importDraft)
              ? (next.source.importDraft as unknown as ImportedQuestion[]).map(
                  (question) => ({
                    ...question,
                    recognitionProvider: ExtractionProvider.LOCAL,
                    recognitionModel: null,
                  }),
                )
              : [],
            warnings: Array.isArray(next.source.importWarnings)
              ? next.source.importWarnings.map(String)
              : [],
          };
      }
      const correctionMemory = await this.prisma.recognitionCorrection.findMany({
        where: { sourceChecksum: next.source.checksum },
        select: { signature: true, action: true, correctedData: true },
        orderBy: { updatedAt: "desc" },
      });
      const learned = applyCorrectionMemory(extracted.questions, correctionMemory);
      extracted.questions = learned.questions;
      if (learned.applied || learned.suppressed)
        extracted.warnings.push(
          `Đã áp dụng ${learned.applied} bản sửa và loại ${learned.suppressed} câu nhận diện nhầm từ lần giáo viên duyệt trước.`,
        );
      if (extracted.questions.length > 200)
        extracted.warnings.push(
          `Tệp nhận diện ${extracted.questions.length} câu; hệ thống chỉ nhập 200 câu đầu tiên cho một đề.`,
        );
      const existingBySignature = new Map(
        next.questions.map((question) => [questionSignature(question), question]),
      );
      const existingBySource = new Map<string, typeof next.questions>();
      for (const question of next.questions) {
        const key = `${question.sourcePage || 0}|${question.sourceLabel || ""}|${question.kind}`;
        existingBySource.set(key, [...(existingBySource.get(key) || []), question]);
      }
      const matchedExistingIds = new Set<string>();
      const questionData = extracted.questions.slice(0, 200).map((question) => {
        const sourceKey = `${question.sourcePage || 0}|${question.sourceLabel || ""}|${question.kind}`;
        const sourceMatches = existingBySource.get(sourceKey) || [];
        const existing =
          existingBySignature.get(questionSignature(question)) ||
          (sourceMatches.length === 1 ? sourceMatches[0] : undefined);
        if (existing) matchedExistingIds.add(existing.id);
        return {
        examId: next.id,
        position: question.position,
        kind: question.kind,
        taskType: question.taskType || existing?.taskType || QuestionTaskType.GENERAL,
        answer: existing?.answer || question.answer || null,
        points: existing?.points || question.points || 1,
        sourceLabel: question.sourceLabel || null,
        section: question.section || null,
        content: question.content || `Câu ${question.position}`,
        options: question.options as Prisma.InputJsonValue,
        interactionData: question.interactionData
          ? question.interactionData as Prisma.InputJsonValue
          : Prisma.JsonNull,
        sourcePage: question.sourcePage || null,
        recognitionConfidence: question.recognitionConfidence ?? 0.5,
        recognitionProvider:
          question.recognitionProvider || extractionProvider,
        recognitionModel: question.recognitionModel || null,
        extractionBatch: question.extractionBatch || null,
        reviewFlags: (question.reviewFlags ?? ["LEGACY_IMPORT", "LOW_CONFIDENCE"]) as Prisma.InputJsonValue,
        sourceBounds: question.sourceBounds
          ? (question.sourceBounds as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        reviewedAt: question.reviewFlags?.includes("LEARNED_CORRECTION")
          ? new Date()
          : null as Date | null,
        };
      });
      for (const existing of next.questions) {
        // Only teacher-confirmed/manual questions survive a fresh extraction.
        // Auto-detected rows that disappeared are stale false positives (for
        // example vocabulary entries or answer grids) and must be removed.
        if (
          existing.reviewedAt &&
          !matchedExistingIds.has(existing.id)
        )
          questionData.push({
            examId: next.id,
            position: questionData.length + 1,
            kind: existing.kind,
            taskType: existing.taskType,
            answer: existing.answer,
            points: existing.points,
            sourceLabel: existing.sourceLabel,
            section: existing.section,
            content: existing.content || `Câu ${existing.position}`,
            options: (existing.options || []) as Prisma.InputJsonValue,
            interactionData: existing.interactionData || Prisma.JsonNull,
            sourcePage: existing.sourcePage,
            recognitionConfidence: existing.recognitionConfidence,
            recognitionProvider: existing.recognitionProvider,
            recognitionModel: existing.recognitionModel,
            extractionBatch: existing.extractionBatch,
            reviewFlags: (existing.reviewFlags || []) as Prisma.InputJsonValue,
            sourceBounds: existing.sourceBounds || Prisma.JsonNull,
            reviewedAt: existing.reviewedAt,
          });
      }
      questionData.sort((a, b) => a.position - b.position);
      await this.prisma.$transaction(async (tx) => {
        await tx.examQuestion.deleteMany({ where: { examId: next.id } });
        if (questionData.length)
          await tx.examQuestion.createMany({ data: questionData.slice(0, 200) });
        await tx.exam.update({
          where: { id: next.id },
          data: {
            extractionStatus: SourceImportStatus.READY,
            extractionProgress: 100,
            extractionError: null,
            extractedAt: new Date(),
            extractionWarnings: extracted.warnings as Prisma.InputJsonValue,
            extractionProvider,
            aiModel,
            aiInputTokens,
            aiOutputTokens,
            aiFallbackReason,
          },
        });
      });
    } catch (error) {
      const message = error instanceof Error && error.message !== "IMPORT_TIMEOUT"
        ? error.message
        : "Trích xuất câu hỏi quá thời gian cho phép; hãy chọn ít trang hơn.";
      await this.prisma.exam.update({
        where: { id: next.id },
        data: {
          extractionStatus: SourceImportStatus.FAILED,
          extractionProgress: 100,
          extractionError: message.slice(0, 500),
          extractionWarnings: ["Không thể hoàn tất trích xuất. Bạn có thể thử lại hoặc nhập câu thủ công."],
          extractionProvider,
          aiModel,
          aiInputTokens,
          aiOutputTokens,
          aiFallbackReason,
        },
      });
    }
    return true;
  }

  async storageStats() {
    const [source, material, byStatus] = await Promise.all([
      this.prisma.examSource.aggregate({ _sum: { sizeBytes: true }, _count: true }),
      this.prisma.material.aggregate({ _sum: { sizeBytes: true }, _count: true }),
      this.prisma.examSource.groupBy({ by: ["status"], _count: true }),
    ]);
    const usedBytes = (source._sum.sizeBytes || 0) + (material._sum.sizeBytes || 0);
    return {
      usedBytes,
      quotaBytes: numberSetting("UPLOAD_TOTAL_QUOTA_MB", 10240) * 1024 * 1024,
      sources: source._count,
      materials: material._count,
      byStatus,
    };
  }

  async cleanupUnusedSources() {
    const cutoff = new Date(Date.now() - numberSetting("SOURCE_RETENTION_DAYS", 30) * 86400000);
    const items = await this.prisma.examSource.findMany({
      where: {
        createdAt: { lt: cutoff },
        exams: { none: {} },
        status: { in: [SourceImportStatus.FAILED, SourceImportStatus.QUARANTINED] },
      },
      select: { id: true, fileKey: true },
      take: 100,
    });
    for (const item of items) {
      await rm(join(root, item.fileKey), { force: true }).catch(() => undefined);
      await this.prisma.examSource.delete({ where: { id: item.id } });
    }
    return items.length;
  }

  sources(userId: string, role: Role) {
    return this.prisma.examSource.findMany({
      where: role === Role.ADMIN ? {} : { uploadedById: userId },
      include: { _count: { select: { exams: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async retrySource(id: string, userId: string, role: Role) {
    const source = await this.prisma.examSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException();
    if (role !== Role.ADMIN && source.uploadedById !== userId) throw new ForbiddenException();
    if (source.status !== SourceImportStatus.FAILED && source.status !== SourceImportStatus.QUARANTINED)
      throw new BadRequestException("Chỉ có thể thử lại tệp đang lỗi hoặc bị cách ly.");
    return this.prisma.examSource.update({
      where: { id },
      data: { status: SourceImportStatus.QUEUED, progress: 5, statusMessage: "Đang chờ kiểm tra lại", lastError: null },
    });
  }

  async deleteSource(id: string, userId: string, role: Role) {
    const source = await this.prisma.examSource.findUnique({ where: { id }, include: { _count: { select: { exams: true } } } });
    if (!source) throw new NotFoundException();
    if (role !== Role.ADMIN && source.uploadedById !== userId) throw new ForbiddenException();
    if (source._count.exams) throw new BadRequestException("Tệp đang được một đề sử dụng nên không thể xóa.");
    if (source.status === SourceImportStatus.QUEUED || source.status === SourceImportStatus.SCANNING || source.status === SourceImportStatus.PROCESSING)
      throw new BadRequestException("Hãy đợi tệp xử lý xong rồi mới xóa.");
    await this.prisma.examSource.delete({ where: { id } });
    await rm(join(root, source.fileKey), { force: true }).catch(() => undefined);
    return { deleted: true };
  }

  async createExam(
    data: {
      sourceId: string;
      title: string;
      summary?: string;
      schoolLevel: string;
      grade: number;
      startPage: number;
      endPage: number;
      durationMinutes?: number;
      answerText?: string;
      extractQuestions?: boolean;
    },
    userId: string,
    role: Role,
  ) {
    if (
      !data ||
      typeof data.title !== "string" ||
      !data.title.trim() ||
      data.title.length > 160 ||
      typeof data.sourceId !== "string" ||
      (data.answerText && typeof data.answerText !== "string")
    )
      throw new BadRequestException("Thông tin đề không hợp lệ.");
    assertLevel(data.schoolLevel, Number(data.grade));
    const source = await this.prisma.examSource.findUnique({
      where: { id: data.sourceId },
    });
    if (!source) throw new NotFoundException("Không tìm thấy PDF nguồn.");
    if (role !== Role.ADMIN && source.uploadedById !== userId)
      throw new ForbiddenException();
    if (source.status !== SourceImportStatus.READY)
      throw new BadRequestException(
        source.status === SourceImportStatus.FAILED || source.status === SourceImportStatus.QUARANTINED
          ? source.lastError || "Tệp nguồn không thể sử dụng."
          : "Tệp vẫn đang được kiểm tra và nhận dạng; vui lòng đợi hoàn tất.",
      );
    const start = source.mimeType === "application/pdf" ? Number(data.startPage) : 1,
      end = source.mimeType === "application/pdf" ? Number(data.endPage) : 1,
      duration = Number(data.durationMinutes ?? 45);
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1 ||
      end < start ||
      end > source.pageCount ||
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration > 240
    )
      throw new BadRequestException("Khoảng trang/thời lượng không hợp lệ.");
    const keys = parseKeys(data.answerText || "");
    const sourceBytes = await readFile(join(root, source.fileKey));
    let fileKey = source.fileKey;
    let extracted: { questions: ImportedQuestion[]; warnings: string[] };
    const queueExtraction = source.mimeType === "application/pdf" && data.extractQuestions !== false;
    if (source.mimeType === "application/pdf") {
      const pdf = await PDFDocument.load(sourceBytes);
      const output = await PDFDocument.create();
      const pages = await output.copyPages(
        pdf,
        Array.from({ length: end - start + 1 }, (_, index) => start - 1 + index),
      );
      pages.forEach((page) => output.addPage(page));
      fileKey = await save(await output.save(), "pdf");
      extracted = queueExtraction
        ? { questions: [], warnings: ["Tệp đang được xử lý nền; bạn có thể rời trang và quay lại sau."] }
        : { questions: [], warnings: [] };
    } else {
      const draft = Array.isArray(source.importDraft)
        ? (source.importDraft as unknown as ImportedQuestion[])
        : [];
      extracted = data.extractQuestions === false
        ? { questions: [], warnings: [] }
        : {
            questions: draft,
            warnings: Array.isArray(source.importWarnings)
              ? source.importWarnings.map(String)
              : [],
          };
    }
    if (extracted.questions.length > 200)
      extracted.warnings.push(
        `PDF nhận diện ${extracted.questions.length} câu; hệ thống chỉ nhập 200 câu đầu tiên cho một đề.`,
      );
    const questionData = extracted.questions.slice(0, 200).map((question) => ({
      ...question,
      options: question.options as Prisma.InputJsonValue,
      interactionData: question.interactionData
        ? question.interactionData as Prisma.InputJsonValue
        : Prisma.JsonNull,
      recognitionConfidence: question.recognitionConfidence ?? 0.5,
      reviewFlags: (question.reviewFlags ?? ["LEGACY_IMPORT", "LOW_CONFIDENCE"]) as Prisma.InputJsonValue,
      sourceBounds: question.sourceBounds
        ? (question.sourceBounds as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      answer: keys.get(question.position) || question.answer || null,
      points: question.points || 1,
    }));
    for (const [position, answer] of keys) {
      if (!questionData.some((question) => question.position === position))
        questionData.push({
          position,
          sourceLabel: String(position),
          section: null,
          content: `Câu ${position}`,
          options: [] as Prisma.InputJsonValue,
          interactionData: Prisma.JsonNull,
          kind: /^[A-D]$/i.test(answer)
            ? QuestionKind.SINGLE_CHOICE
            : QuestionKind.SHORT_TEXT,
          sourcePage: start,
          recognitionConfidence: 1,
          reviewFlags: [] as Prisma.InputJsonValue,
          sourceBounds: Prisma.JsonNull,
          answer,
          points: 1,
        });
    }
    questionData.sort((a, b) => a.position - b.position);
    return this.prisma.exam.create({
      data: {
        slug: slug(data.title),
        title: data.title.slice(0, 160),
        summary: (data.summary || "").slice(0, 500),
        schoolLevel: data.schoolLevel as SchoolLevel,
        grade: Number(data.grade),
        durationMinutes: duration,
        sourceId: source.id,
        startPage: start,
        endPage: end,
        fileKey,
        createdById: userId,
        extractedAt: queueExtraction ? null : (extracted.questions.length ? new Date() : null),
        extractionWarnings: extracted.warnings as Prisma.InputJsonValue,
        extractionStatus: queueExtraction ? SourceImportStatus.QUEUED : SourceImportStatus.READY,
        extractionProgress: queueExtraction ? 5 : 100,
        extractionError: null,
        questions: {
          create: questionData,
        },
      },
      include: { questions: { orderBy: { position: "asc" } } },
    });
  }

  staffExams(userId: string, role: Role) {
    return this.prisma.exam.findMany({
      where: role === Role.ADMIN ? {} : { createdById: userId },
      include: {
        questions: { orderBy: { position: "asc" } },
        source: { select: { fileName: true, mimeType: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  examTemplate() {
    return createExamTemplate();
  }

  async updateKeys(
    examId: string,
    answerText: string,
    userId: string,
    role: Role,
  ) {
    const exam = await this.ownedExam(examId, userId, role);
    if (exam.status === ContentStatus.PUBLISHED)
      throw new BadRequestException("Đưa đề về bản nháp trước khi sửa đáp án.");
    if (exam.extractionStatus === SourceImportStatus.QUEUED || exam.extractionStatus === SourceImportStatus.PROCESSING)
      throw new BadRequestException("Đề đang được trích xuất; hãy đợi hoàn tất trước khi sửa.");
    const keys = parseKeys(answerText);
    await this.prisma.$transaction([
      this.prisma.examQuestion.updateMany({
        where: { examId },
        data: { answer: null },
      }),
      ...[...keys].map(([position, answer]) =>
        this.prisma.examQuestion.upsert({
          where: { examId_position: { examId, position } },
          update: { answer },
          create: {
            examId,
            position,
            sourceLabel: String(position),
            content: `Câu ${position}`,
            options: [],
            answer,
            kind: /^[A-D]$/i.test(answer)
              ? QuestionKind.SINGLE_CHOICE
              : QuestionKind.SHORT_TEXT,
            recognitionProvider: ExtractionProvider.MANUAL,
          },
        }),
      ),
    ]);
    return this.prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: { orderBy: { position: "asc" } } },
    });
  }

  async upsertQuestion(
    examId: string,
    body: {
      position: number;
      answer?: string;
      kind?: QuestionKind;
      taskType?: QuestionTaskType;
      points?: number;
      content?: string;
      section?: string;
      options?: string[];
      interactionData?: {
        matchingLeft?: string[];
        matchingRight?: string[];
        orderingItems?: string[];
      } | null;
    },
    userId: string,
    role: Role,
  ) {
    const exam = await this.ownedExam(examId, userId, role);
    if (exam.status === ContentStatus.PUBLISHED)
      throw new BadRequestException("Đưa đề về bản nháp trước khi sửa câu.");
    if (exam.extractionStatus === SourceImportStatus.QUEUED || exam.extractionStatus === SourceImportStatus.PROCESSING)
      throw new BadRequestException("Đề đang được trích xuất; hãy đợi hoàn tất trước khi sửa.");
    const position = Number(body.position),
      points = Number(body.points ?? 1);
    if (
      !Number.isInteger(position) ||
      position < 1 ||
      position > 200 ||
      !Number.isFinite(points) ||
      points <= 0 ||
      points > 100 ||
      (body.kind && !Object.values(QuestionKind).includes(body.kind))
      || (body.taskType && !Object.values(QuestionTaskType).includes(body.taskType))
    )
      throw new BadRequestException("Câu hỏi không hợp lệ.");
    const existing = await this.prisma.examQuestion.findUnique({
      where: { examId_position: { examId, position } },
    });
    const interactionData = cleanInteractionData(body.interactionData);
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.examQuestion.upsert({
        where: { examId_position: { examId, position } },
        update: {
          answer: body.answer?.trim() || null,
          kind: body.kind || undefined,
          taskType: body.taskType || undefined,
          points,
          content: body.content?.trim().slice(0, 4000) || undefined,
          section: body.section?.trim().slice(0, 1000) || undefined,
          options: Array.isArray(body.options)
            ? (body.options
                .map((option) => String(option).trim().slice(0, 1000))
                .filter(Boolean) as Prisma.InputJsonValue)
            : undefined,
          interactionData,
          recognitionConfidence: 1,
          reviewFlags: [],
          reviewedAt: new Date(),
        },
        create: {
          examId,
          position,
          answer: body.answer?.trim() || null,
          kind: body.kind || QuestionKind.SINGLE_CHOICE,
          taskType: body.taskType || QuestionTaskType.GENERAL,
          points,
          sourceLabel: String(position),
          content: body.content?.trim().slice(0, 4000) || `Câu ${position}`,
          section: body.section?.trim().slice(0, 1000) || null,
          options: (Array.isArray(body.options)
            ? body.options
                .map((option) => String(option).trim().slice(0, 1000))
                .filter(Boolean)
            : []) as Prisma.InputJsonValue,
          interactionData: interactionData || Prisma.JsonNull,
          recognitionConfidence: 1,
          recognitionProvider: ExtractionProvider.MANUAL,
          reviewFlags: [],
          reviewedAt: new Date(),
        },
      });
      if (
        existing?.sourcePage &&
        JSON.stringify(snapshotQuestion(existing)) !== JSON.stringify(snapshotQuestion(saved))
      ) {
        const previous = await tx.recognitionCorrection.findFirst({
          where: { examId, questionPosition: position },
          orderBy: { createdAt: "asc" },
        });
        if (previous)
          await tx.recognitionCorrection.update({
            where: { id: previous.id },
            data: {
              action: "UPDATED",
              correctedData: snapshotQuestion(saved) as unknown as Prisma.InputJsonValue,
              correctedById: userId,
            },
          });
        else
          await tx.recognitionCorrection.create({
            data: {
              examId,
              sourceId: exam.sourceId,
              sourceChecksum: exam.source.checksum,
              questionPosition: position,
              signature: questionSignature(existing),
              action: "UPDATED",
              originalData: snapshotQuestion(existing) as unknown as Prisma.InputJsonValue,
              correctedData: snapshotQuestion(saved) as unknown as Prisma.InputJsonValue,
              correctedById: userId,
            },
          });
      }
      return saved;
    });
  }

  async extractExamQuestions(examId: string, userId: string, role: Role) {
    const exam = await this.ownedExam(examId, userId, role);
    if (exam.status === ContentStatus.PUBLISHED)
      throw new BadRequestException(
        "Đưa đề về bản nháp trước khi trích xuất lại câu hỏi.",
      );
    const source = await this.prisma.examSource.findUnique({
      where: { id: exam.sourceId },
    });
    if (!source) throw new NotFoundException("Không tìm thấy tệp nguồn.");
    if (exam.extractionStatus === SourceImportStatus.QUEUED || exam.extractionStatus === SourceImportStatus.PROCESSING)
      throw new BadRequestException("Đề đang được xử lý; vui lòng đợi hoàn tất.");
    return this.prisma.exam.update({
      where: { id: examId },
      data: {
        extractionStatus: SourceImportStatus.QUEUED,
        extractionProgress: 5,
        extractionError: null,
        extractedAt: null,
        extractionWarnings: ["Đang trích xuất lại câu hỏi trong hàng đợi nền."],
        extractionProvider: ExtractionProvider.LOCAL,
        aiModel: null,
        aiInputTokens: null,
        aiOutputTokens: null,
        aiFallbackReason: null,
      },
      include: { questions: { orderBy: { position: "asc" } } },
    });
  }

  async confirmTrustedQuestions(examId: string, userId: string, role: Role) {
    const exam = await this.ownedExam(examId, userId, role);
    if (exam.status === ContentStatus.PUBLISHED)
      throw new BadRequestException("Đưa đề về bản nháp trước khi xác nhận câu hỏi.");
    if (
      exam.extractionStatus === SourceImportStatus.QUEUED ||
      exam.extractionStatus === SourceImportStatus.PROCESSING
    )
      throw new BadRequestException("Đề đang được trích xuất; hãy đợi hoàn tất trước khi xác nhận.");
    return this.prisma.examQuestion.updateMany({
      where: {
        examId,
        reviewedAt: null,
        recognitionConfidence: { gte: 0.68 },
      },
      data: {
        recognitionConfidence: 1,
        reviewFlags: [],
        reviewedAt: new Date(),
      },
    });
  }

  async deleteQuestion(
    examId: string,
    position: number,
    userId: string,
    role: Role,
  ) {
    const exam = await this.ownedExam(examId, userId, role);
    if (exam.status === ContentStatus.PUBLISHED)
      throw new BadRequestException("Đưa đề về bản nháp trước khi sửa câu.");
    if (exam.extractionStatus === SourceImportStatus.QUEUED || exam.extractionStatus === SourceImportStatus.PROCESSING)
      throw new BadRequestException("Đề đang được trích xuất; hãy đợi hoàn tất trước khi sửa.");
    const existing = await this.prisma.examQuestion.findUnique({
      where: { examId_position: { examId, position } },
    });
    return this.prisma.$transaction(async (tx) => {
      if (existing?.sourcePage) {
        const previous = await tx.recognitionCorrection.findFirst({
          where: { examId, questionPosition: position },
          orderBy: { createdAt: "asc" },
        });
        if (previous)
          await tx.recognitionCorrection.update({
            where: { id: previous.id },
            data: {
              action: "DELETED",
              correctedData: Prisma.JsonNull,
              correctedById: userId,
            },
          });
        else
          await tx.recognitionCorrection.create({
            data: {
              examId,
              sourceId: exam.sourceId,
              sourceChecksum: exam.source.checksum,
              questionPosition: position,
              signature: questionSignature(existing),
              action: "DELETED",
              originalData: snapshotQuestion(existing) as unknown as Prisma.InputJsonValue,
              correctedData: Prisma.JsonNull,
              correctedById: userId,
            },
          });
      }
      return tx.examQuestion.deleteMany({ where: { examId, position } });
    });
  }

  async recognitionLearningStats(userId: string, role: Role) {
    const correctionWhere = role === Role.ADMIN ? {} : { correctedById: userId };
    const examWhere = role === Role.ADMIN ? {} : { createdById: userId };
    const [corrections, reviewedQuestions, totalQuestions] = await Promise.all([
      this.prisma.recognitionCorrection.findMany({
        where: correctionWhere,
        select: { action: true, sourceChecksum: true, updatedAt: true },
      }),
      this.prisma.examQuestion.count({
        where: { reviewedAt: { not: null }, exam: examWhere },
      }),
      this.prisma.examQuestion.count({ where: { exam: examWhere } }),
    ]);
    return {
      corrections: corrections.length,
      updated: corrections.filter((item) => item.action === "UPDATED").length,
      deleted: corrections.filter((item) => item.action === "DELETED").length,
      sourceFiles: new Set(corrections.map((item) => item.sourceChecksum)).size,
      reviewedQuestions,
      totalQuestions,
      lastCorrectionAt: corrections
        .map((item) => item.updatedAt)
        .sort((a, b) => b.getTime() - a.getTime())[0] || null,
    };
  }

  async recognitionLearningExport(userId: string, role: Role) {
    const rows = await this.prisma.recognitionCorrection.findMany({
      where: role === Role.ADMIN ? {} : { correctedById: userId },
      select: {
        sourceChecksum: true,
        questionPosition: true,
        signature: true,
        action: true,
        originalData: true,
        correctedData: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "asc" },
    });
    return rows.map((row) => JSON.stringify({ version: 1, ...row })).join("\n");
  }

  async setExamStatus(
    id: string,
    status: ContentStatus,
    userId: string,
    role: Role,
  ) {
    const exam = await this.ownedExam(id, userId, role);
    if (status !== ContentStatus.DRAFT && exam.extractionStatus !== SourceImportStatus.READY)
      throw new BadRequestException("Cần đợi trích xuất câu hỏi hoàn tất trước khi gửi duyệt hoặc xuất bản.");
    if (status === ContentStatus.PUBLISHED) {
      if (role !== Role.ADMIN) throw new ForbiddenException();
      if (exam.extractionStatus !== SourceImportStatus.READY)
        throw new BadRequestException("Cần đợi trích xuất câu hỏi hoàn tất trước khi xuất bản.");
      const count = await this.prisma.examQuestion.count({
        where: { examId: id },
      });
      if (!count)
        throw new BadRequestException("Cần ít nhất một câu hỏi để xuất bản.");
    }
    if (exam.status === ContentStatus.PUBLISHED && role !== Role.ADMIN)
      throw new ForbiddenException();
    return this.prisma.exam.update({ where: { id }, data: { status } });
  }

  private async ownedExam(id: string, userId: string, role: Role) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: { source: { select: { checksum: true } } },
    });
    if (!exam) throw new NotFoundException();
    if (role !== Role.ADMIN && exam.createdById !== userId)
      throw new ForbiddenException();
    return exam;
  }

  publicExams(level?: SchoolLevel, grade?: number) {
    return this.prisma.exam.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        access: ExamAccess.PUBLIC,
        ...(level ? { schoolLevel: level } : {}),
        ...(grade !== undefined ? { grade } : {}),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        schoolLevel: true,
        grade: true,
        durationMinutes: true,
        source: { select: { fileName: true, mimeType: true } },
        questions: {
          select: { position: true, kind: true, points: true, content: true },
          orderBy: { position: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
  async publicExam(slugValue: string) {
    const exam = await this.prisma.exam.findFirst({
      where: {
        slug: slugValue,
        status: ContentStatus.PUBLISHED,
        access: ExamAccess.PUBLIC,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        schoolLevel: true,
        grade: true,
        durationMinutes: true,
        source: { select: { fileName: true, mimeType: true } },
        questions: {
          select: {
            position: true,
            sourceLabel: true,
            section: true,
            content: true,
            options: true,
            interactionData: true,
            sourcePage: true,
            kind: true,
            taskType: true,
            points: true,
          },
          orderBy: { position: "asc" },
        },
      },
    });
    if (!exam) throw new NotFoundException();
    return exam;
  }
  async examFile(id: string, userId?: string, role?: Role) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: { source: { select: { fileName: true, mimeType: true } } },
    });
    if (
      !exam ||
      (exam.status !== ContentStatus.PUBLISHED &&
        role !== Role.ADMIN &&
        exam.createdById !== userId) ||
      (exam.access !== ExamAccess.PUBLIC && !userId)
    )
      throw new NotFoundException();
    return {
      buffer: await readFile(join(root, exam.fileKey)),
      mime: exam.source.mimeType,
      name: exam.source.fileName,
    };
  }
  private scoreAttempt(
    questions: {
      position: number;
      kind: QuestionKind;
      taskType: QuestionTaskType;
      answer: string | null;
      points: number;
    }[],
    answers: Record<string, string>,
    manualScores: Record<string, number> = {},
  ) {
    let earned = 0;
    let possible = 0;
    let manualEarned = 0;
    let manualPossible = 0;
    let pending = 0;
    const details = questions.map((question) => {
      const response = String(answers[String(question.position)] || "").trim();
      if (question.kind === QuestionKind.ESSAY || !question.answer) {
        manualPossible += question.points;
        const manualScore = manualScores[String(question.position)];
        if (Number.isFinite(manualScore)) {
          manualEarned += manualScore;
          return {
            position: question.position,
            status: "MANUALLY_GRADED",
            score: manualScore,
          };
        }
        pending++;
        return { position: question.position, status: "PENDING" };
      }
      possible += question.points;
      const correct =
        normalizedScoringAnswer(response, question.kind, question.taskType) ===
        normalizedScoringAnswer(question.answer, question.kind, question.taskType);
      if (correct) earned += question.points;
      return {
        position: question.position,
        status: correct ? "CORRECT" : "INCORRECT",
        correctAnswer: question.answer,
      };
    });
    return {
      earned,
      possible,
      manualEarned,
      manualPossible,
      pending,
      provisional: pending > 0,
      details,
    };
  }

  private async publicExamWithQuestions(id: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id, status: ContentStatus.PUBLISHED, access: ExamAccess.PUBLIC },
      include: { questions: { orderBy: { position: "asc" } } },
    });
    if (!exam) throw new NotFoundException();
    return exam;
  }

  private assertAttemptAccess(
    attempt: { userId: string | null; guestTokenHash: string | null },
    userId?: string,
    guestToken?: string,
  ) {
    if (userId && attempt.userId === userId) return;
    if (
      !attempt.userId &&
      attempt.guestTokenHash &&
      guestToken &&
      hashGuestToken(guestToken) === attempt.guestTokenHash
    )
      return;
    throw new ForbiddenException("Bạn không có quyền truy cập bài làm này.");
  }

  async startAttempt(
    examId: string,
    data: { participantName?: string; attemptId?: string; guestToken?: string },
    userId?: string,
  ) {
    const exam = await this.publicExamWithQuestions(examId);
    const payload = (attempt: {
      id: string;
      answers: Prisma.JsonValue;
      participantName: string | null;
      status: AttemptStatus;
      updatedAt: Date;
      manualScores: Prisma.JsonValue | null;
      teacherFeedback: string | null;
    }) => ({
      attemptId: attempt.id,
      answers: attempt.answers,
      participantName: attempt.participantName,
      status: attempt.status,
      savedAt: attempt.updatedAt,
      teacherFeedback: attempt.teacherFeedback,
      result:
        attempt.status === AttemptStatus.DRAFT
          ? null
          : this.scoreAttempt(
              exam.questions,
              cleanAnswers(attempt.answers),
              manualScoresRecord(attempt.manualScores),
            ),
    });
    if (data.attemptId) {
      const attempt = await this.prisma.examAttempt.findFirst({
        where: { id: data.attemptId, examId },
      });
      if (!attempt) throw new NotFoundException("Không tìm thấy bài làm.");
      this.assertAttemptAccess(attempt, userId, data.guestToken);
      return payload(attempt);
    }
    if (userId) {
      const existing = await this.prisma.examAttempt.findFirst({
        where: { examId, userId, status: AttemptStatus.DRAFT },
        orderBy: { updatedAt: "desc" },
      });
      if (existing) return payload(existing);
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException();
      const attempt = await this.prisma.examAttempt.create({
        data: {
          examId,
          userId,
          participantName: user.fullName,
          answers: {},
          status: AttemptStatus.DRAFT,
        },
      });
      return payload(attempt);
    }
    const participantName = data.participantName?.trim();
    if (
      !participantName ||
      participantName.length < 2 ||
      participantName.length > 80
    )
      throw new BadRequestException("Vui lòng nhập tên từ 2 đến 80 ký tự.");
    const guestToken = randomUUID();
    const attempt = await this.prisma.examAttempt.create({
      data: {
        examId,
        participantName,
        guestTokenHash: hashGuestToken(guestToken),
        answers: {},
        status: AttemptStatus.DRAFT,
      },
    });
    return {
      ...payload(attempt),
      attemptId: attempt.id,
      guestToken,
    };
  }

  async saveAttempt(
    examId: string,
    attemptId: string,
    answersValue: unknown,
    userId?: string,
    guestToken?: string,
  ) {
    await this.publicExamWithQuestions(examId);
    const attempt = await this.prisma.examAttempt.findFirst({
      where: { id: attemptId, examId },
    });
    if (!attempt) throw new NotFoundException("Không tìm thấy bài làm.");
    this.assertAttemptAccess(attempt, userId, guestToken);
    if (attempt.status !== AttemptStatus.DRAFT)
      throw new BadRequestException("Bài đã nộp nên không thể sửa.");
    const answers = cleanAnswers(answersValue);
    const updated = await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: { answers: answers as Prisma.InputJsonValue },
    });
    return { saved: true, savedAt: updated.updatedAt };
  }

  async submitAttempt(
    examId: string,
    attemptId: string,
    answersValue: unknown,
    userId?: string,
    guestToken?: string,
  ) {
    const exam = await this.publicExamWithQuestions(examId);
    const attempt = await this.prisma.examAttempt.findFirst({
      where: { id: attemptId, examId },
    });
    if (!attempt) throw new NotFoundException("Không tìm thấy bài làm.");
    this.assertAttemptAccess(attempt, userId, guestToken);
    const answers = cleanAnswers(answersValue);
    const score = this.scoreAttempt(exam.questions, answers);
    await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        answers: answers as Prisma.InputJsonValue,
        earned: score.earned,
        possible: score.possible,
        manualEarned: 0,
        manualPossible: score.manualPossible,
        pending: score.pending,
        status:
          score.pending > 0 ? AttemptStatus.SUBMITTED : AttemptStatus.GRADED,
        submittedAt: attempt.submittedAt || new Date(),
      },
    });
    return { attemptId, ...score };
  }

  async submit(id: string, answersValue: unknown, userId?: string) {
    const exam = await this.publicExamWithQuestions(id);
    const answers = cleanAnswers(answersValue);
    const score = this.scoreAttempt(exam.questions, answers);
    const attempt = await this.prisma.examAttempt.create({
      data: {
        examId: id,
        userId,
        participantName: userId ? undefined : "Khách",
        answers: answers as Prisma.InputJsonValue,
        earned: score.earned,
        possible: score.possible,
        manualPossible: score.manualPossible,
        pending: score.pending,
        status:
          score.pending > 0 ? AttemptStatus.SUBMITTED : AttemptStatus.GRADED,
        submittedAt: new Date(),
      },
    });
    return { attemptId: attempt.id, ...score };
  }

  async staffAttempts(userId: string, role: Role) {
    const attempts = await this.prisma.examAttempt.findMany({
      where:
        role === Role.ADMIN ? {} : { exam: { is: { createdById: userId } } },
      select: {
        id: true,
        participantName: true,
        status: true,
        answers: true,
        earned: true,
        possible: true,
        manualEarned: true,
        manualPossible: true,
        manualScores: true,
        pending: true,
        teacherFeedback: true,
        submittedAt: true,
        updatedAt: true,
        user: { select: { fullName: true, email: true } },
        exam: {
          select: {
            id: true,
            title: true,
            questions: {
              select: {
                position: true,
                content: true,
                options: true,
                interactionData: true,
                kind: true,
                taskType: true,
                answer: true,
                points: true,
                sourcePage: true,
                section: true,
              },
              orderBy: { position: "asc" },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return attempts.map((attempt) => {
      if (attempt.status === AttemptStatus.DRAFT) return attempt;
      const score = this.scoreAttempt(
        attempt.exam.questions,
        cleanAnswers(attempt.answers),
        manualScoresRecord(attempt.manualScores),
      );
      return {
        ...attempt,
        earned: score.earned,
        possible: score.possible,
        manualEarned: score.manualEarned,
        manualPossible: score.manualPossible,
        pending: score.pending,
      };
    });
  }

  async gradeAttempt(
    attemptId: string,
    scoresValue: unknown,
    feedback: string | undefined,
    userId: string,
    role: Role,
  ) {
    if (
      !scoresValue ||
      typeof scoresValue !== "object" ||
      Array.isArray(scoresValue)
    )
      throw new BadRequestException("Điểm chấm tay không hợp lệ.");
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: { include: { questions: true } } },
    });
    if (!attempt) throw new NotFoundException("Không tìm thấy bài làm.");
    if (role !== Role.ADMIN && attempt.exam.createdById !== userId)
      throw new ForbiddenException();
    if (attempt.status === AttemptStatus.DRAFT)
      throw new BadRequestException("Học viên chưa nộp bài.");
    const pendingQuestions = attempt.exam.questions.filter(
      (question) => question.kind === QuestionKind.ESSAY || !question.answer,
    );
    const allowed = new Map(
      pendingQuestions.map((question) => [
        String(question.position),
        question.points,
      ]),
    );
    const scores: Record<string, number> = {};
    for (const [position, rawScore] of Object.entries(scoresValue)) {
      const max = allowed.get(position);
      const score = Number(rawScore);
      if (
        max === undefined ||
        !Number.isFinite(score) ||
        score < 0 ||
        score > max
      )
        throw new BadRequestException(`Điểm câu ${position} không hợp lệ.`);
      scores[position] = score;
    }
    const answers = cleanAnswers(attempt.answers);
    const result = this.scoreAttempt(attempt.exam.questions, answers, scores);
    return this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        manualScores: scores as Prisma.InputJsonValue,
        manualEarned: result.manualEarned,
        manualPossible: result.manualPossible,
        pending: result.pending,
        status:
          result.pending > 0 ? AttemptStatus.SUBMITTED : AttemptStatus.GRADED,
        teacherFeedback: feedback?.trim().slice(0, 1000) || null,
        gradedById: userId,
        gradedAt: result.pending > 0 ? null : new Date(),
      },
    });
  }

  async history(userId: string) {
    const attempts = await this.prisma.examAttempt.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        answers: true,
        manualScores: true,
        earned: true,
        possible: true,
        manualEarned: true,
        manualPossible: true,
        pending: true,
        teacherFeedback: true,
        submittedAt: true,
        updatedAt: true,
        createdAt: true,
        exam: {
          select: {
            title: true,
            slug: true,
            questions: {
              select: {
                position: true,
                kind: true,
                taskType: true,
                answer: true,
                points: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return attempts.map((attempt) => {
      const { answers, manualScores, exam, ...historyItem } = attempt;
      if (attempt.status === AttemptStatus.DRAFT)
        return {
          ...historyItem,
          exam: { title: exam.title, slug: exam.slug },
        };
      const score = this.scoreAttempt(
        exam.questions,
        cleanAnswers(answers),
        manualScoresRecord(manualScores),
      );
      return {
        ...historyItem,
        earned: score.earned,
        possible: score.possible,
        manualEarned: score.manualEarned,
        manualPossible: score.manualPossible,
        pending: score.pending,
        exam: { title: exam.title, slug: exam.slug },
      };
    });
  }

  async uploadMaterial(
    file: Upload,
    body: {
      title: string;
      summary: string;
      category: string;
      schoolLevel: string;
      grade: number;
    },
    userId: string,
  ) {
    const mimeType = safeFile(file);
    await probeExamSource(file);
    if (
      !body ||
      typeof body.title !== "string" ||
      typeof body.category !== "string" ||
      typeof body.summary !== "string"
    )
      throw new BadRequestException("Thông tin tài liệu không hợp lệ.");
    assertLevel(body.schoolLevel, Number(body.grade));
    if (!body.title?.trim() || !body.category?.trim())
      throw new BadRequestException("Thiếu tên tài liệu hoặc danh mục.");
    const [recentSources, recentMaterials] = await Promise.all([
      this.prisma.examSource.count({ where: { uploadedById: userId, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } }),
      this.prisma.material.count({ where: { createdById: userId, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } }),
    ]);
    if (recentSources + recentMaterials >= numberSetting("UPLOADS_PER_USER_PER_HOUR", 20))
      throw new BadRequestException("Bạn đã đạt giới hạn tải lên trong một giờ. Vui lòng thử lại sau.");
    const checksum = createHash("sha256").update(file.buffer).digest("hex");
    const duplicate = await this.prisma.material.findFirst({
      where: { createdById: userId, checksum },
      orderBy: { createdAt: "desc" },
    });
    if (duplicate) return { ...duplicate, duplicate: true };
    await this.assertStorageQuota(userId, file.size);
    try { await this.antivirus.scan(file.buffer); }
    catch (error) {
      if (error instanceof MalwareDetectedError)
        throw new BadRequestException("Tệp bị từ chối vì phát hiện mã độc.");
      throw error;
    }
    const fileKey = await save(
      file.buffer,
      mimeType === "application/pdf" ? "pdf" : "docx",
      "materials",
    );
    return this.prisma.material.create({
      data: {
        slug: slug(body.title),
        title: body.title.slice(0, 160),
        summary: (body.summary || "").slice(0, 220),
        category: body.category.slice(0, 80),
        level: `Lớp ${body.grade}`,
        type: "DOCUMENT",
        schoolLevel: body.schoolLevel as SchoolLevel,
        grade: Number(body.grade),
        fileKey,
        fileName: file.originalname.slice(0, 180),
        mimeType,
        sizeBytes: file.size,
        checksum,
        status: ContentStatus.DRAFT,
        isPublic: false,
        createdById: userId,
      },
    });
  }
  staffMaterials(userId: string, role: Role) {
    return this.prisma.material.findMany({
      where: role === Role.ADMIN ? {} : { createdById: userId },
      orderBy: { createdAt: "desc" },
    });
  }
  async staffMaterialFile(id: string, userId: string, role: Role) {
    const item = await this.prisma.material.findUnique({ where: { id } });
    if (
      !item ||
      !item.fileKey ||
      (role !== Role.ADMIN && item.createdById !== userId)
    )
      throw new NotFoundException();
    return {
      buffer: await readFile(join(root, item.fileKey)),
      name: item.fileName || "tai-lieu",
      mime: item.mimeType || "application/octet-stream",
    };
  }
  async setMaterialStatus(
    id: string,
    status: ContentStatus,
    userId: string,
    role: Role,
  ) {
    const item = await this.prisma.material.findUnique({ where: { id } });
    if (!item) throw new NotFoundException();
    if (role !== Role.ADMIN && item.createdById !== userId)
      throw new ForbiddenException();
    if (status === ContentStatus.PUBLISHED && role !== Role.ADMIN)
      throw new ForbiddenException();
    return this.prisma.material.update({
      where: { id },
      data: {
        status,
        isPublic: status === ContentStatus.PUBLISHED,
        publishedAt: status === ContentStatus.PUBLISHED ? new Date() : null,
      },
    });
  }
  publicMaterials(level?: SchoolLevel, grade?: number) {
    return this.prisma.material.findMany({
      where: {
        isPublic: true,
        ...(level ? { schoolLevel: level } : {}),
        ...(grade !== undefined ? { grade } : {}),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        category: true,
        schoolLevel: true,
        grade: true,
        type: true,
        driveUrl: true,
        youtubeUrl: true,
        fileName: true,
        mimeType: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
  async publicMaterial(slugValue: string) {
    const item = await this.prisma.material.findFirst({
      where: { slug: slugValue, isPublic: true },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        category: true,
        schoolLevel: true,
        grade: true,
        type: true,
        driveUrl: true,
        youtubeUrl: true,
        fileName: true,
        mimeType: true,
      },
    });
    if (!item) throw new NotFoundException();
    return item;
  }
  async materialFile(id: string) {
    const item = await this.prisma.material.findFirst({
      where: { id, isPublic: true },
    });
    if (!item || !item.fileKey) throw new NotFoundException();
    return {
      buffer: await readFile(join(root, item.fileKey)),
      name: item.fileName || "tai-lieu",
      mime: item.mimeType || "application/octet-stream",
    };
  }

  apply(body: {
    fullName: string;
    email: string;
    phone: string;
    area: string;
    experience: string;
    message?: string;
  }) {
    if (
      !body ||
      typeof body.fullName !== "string" ||
      typeof body.email !== "string" ||
      typeof body.phone !== "string" ||
      typeof body.area !== "string" ||
      typeof body.experience !== "string" ||
      (body.message && typeof body.message !== "string") ||
      !body.fullName.trim() ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email) ||
      !/^[0-9+().\s-]{9,18}$/.test(body.phone) ||
      !body.area.trim() ||
      !body.experience.trim()
    )
      throw new BadRequestException("Thông tin ứng tuyển chưa hợp lệ.");
    return this.prisma.teacherApplication.create({
      data: {
        fullName: body.fullName.slice(0, 120),
        email: body.email.slice(0, 160),
        phone: body.phone.slice(0, 30),
        area: body.area.slice(0, 100),
        experience: body.experience.slice(0, 100),
        message: body.message?.slice(0, 1500),
      },
    });
  }
  applications() {
    return this.prisma.teacherApplication.findMany({
      orderBy: { createdAt: "desc" },
    });
  }
  setApplicationStatus(id: string, status: string) {
    if (
      !["NEW", "CONTACTED", "INTERVIEW", "HIRED", "REJECTED"].includes(status)
    )
      throw new BadRequestException();
    return this.prisma.teacherApplication.update({
      where: { id },
      data: { status: status as "NEW" },
    });
  }
}
