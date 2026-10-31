import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { ExtractionProvider, QuestionKind, SourceImportStatus } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { ContentService } from "./content.service";
import { extractPdfWithOcr } from "./question-importer";

jest.mock("./question-importer", () => ({
  ...jest.requireActual("./question-importer"),
  extractPdfWithOcr: jest.fn(),
}));

const mockedLocalExtraction = jest.mocked(extractPdfWithOcr);
const uploadRoot = process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
const sourceKey = "gemini-fallback-test-source.pdf";
const croppedKey = "gemini-fallback-test-cropped.pdf";
const chunkedKey = "gemini-fallback-test-chunked.pdf";

function question(position = 1, sourcePage = 1) {
  return {
    position,
    sourceLabel: String(position),
    section: null,
    kind: QuestionKind.SHORT_TEXT,
    content: `Question ${position}`,
    options: [],
    answer: null,
    points: 1,
    sourcePage,
    recognitionConfidence: 0.9,
    reviewFlags: [],
    sourceBounds: null,
  };
}

function createHarness(
  aiResult: Record<string, unknown>,
  overrides: { fileKey?: string; startPage?: number; endPage?: number } = {},
) {
  const next = {
    id: "exam-1",
    sourceId: "source-1",
    fileKey: overrides.fileKey || croppedKey,
    startPage: overrides.startPage || 4,
    endPage: overrides.endPage || 5,
    createdAt: new Date(),
    questions: [],
    source: {
      mimeType: "application/pdf",
      fileKey: sourceKey,
      checksum: "checksum",
      importDraft: null,
      importWarnings: null,
    },
  };
  const tx = {
    examQuestion: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    exam: { update: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    exam: {
      findFirst: jest.fn().mockResolvedValue(next),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    recognitionCorrection: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const gemini = { extractPdf: jest.fn().mockResolvedValue(aiResult) };
  const service = new ContentService(prisma as never, {} as never, gemini as never);
  return { service, prisma, tx, gemini };
}

describe("ContentService Gemini fallback", () => {
  beforeAll(async () => {
    await mkdir(uploadRoot, { recursive: true });
    const chunked = await PDFDocument.create();
    for (let index = 0; index < 5; index += 1) chunked.addPage();
    await Promise.all([
      writeFile(join(uploadRoot, sourceKey), Buffer.from("source-pdf")),
      writeFile(join(uploadRoot, croppedKey), Buffer.from("cropped-pdf")),
      writeFile(join(uploadRoot, chunkedKey), Buffer.from(await chunked.save())),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      rm(join(uploadRoot, sourceKey), { force: true }),
      rm(join(uploadRoot, croppedKey), { force: true }),
      rm(join(uploadRoot, chunkedKey), { force: true }),
    ]);
  });

  beforeEach(() => mockedLocalExtraction.mockReset());

  it("stores Gemini metadata and maps cropped PDF pages back to source pages", async () => {
    const harness = createHarness({
      status: "SUCCESS",
      model: "gemini-test",
      questions: [question(1, 2)],
      warnings: [],
      usage: { inputTokens: 120, outputTokens: 45, totalTokens: 165 },
    });

    await harness.service.processNextExam();

    expect(mockedLocalExtraction).not.toHaveBeenCalled();
    expect(harness.tx.examQuestion.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ sourcePage: 5 })],
    });
    expect(harness.tx.exam.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        extractionStatus: SourceImportStatus.READY,
        extractionProvider: ExtractionProvider.GEMINI,
        aiModel: "gemini-test",
        aiInputTokens: 120,
        aiOutputTokens: 45,
      }),
    }));
  });

  it("clamps an invalid Gemini page number to the selected source range", async () => {
    const harness = createHarness({
      status: "SUCCESS",
      model: "gemini-test",
      questions: [question(1, 999)],
      warnings: [],
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
    });

    await harness.service.processNextExam();

    expect(harness.tx.examQuestion.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ sourcePage: 5 })],
    });
  });

  it("splits a longer PDF into small Gemini batches and merges source pages", async () => {
    const harness = createHarness(
      {
        status: "SUCCESS",
        model: "gemini-test",
        questions: [question(1, 1)],
        warnings: [],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      },
      { fileKey: chunkedKey, startPage: 4, endPage: 8 },
    );

    await harness.service.processNextExam();

    expect(harness.gemini.extractPdf).toHaveBeenCalledTimes(4);
    expect(harness.tx.examQuestion.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ position: 1, sourcePage: 4 }),
        expect.objectContaining({ position: 2, sourcePage: 5 }),
        expect.objectContaining({ position: 3, sourcePage: 6 }),
        expect.objectContaining({ position: 4, sourcePage: 7 }),
      ]),
    });
    expect(harness.tx.exam.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        aiInputTokens: 40,
        aiOutputTokens: 20,
      }),
    }));
  });

  it("finishes with the local parser when Gemini quota is exhausted", async () => {
    mockedLocalExtraction.mockResolvedValue({ questions: [question(1, 4)], warnings: [] });
    const harness = createHarness({
      status: "QUOTA",
      model: "gemini-test",
      reason: "Gemini đã hết hạn mức; hệ thống chuyển sang nhận diện nội bộ.",
    });

    await harness.service.processNextExam();

    expect(mockedLocalExtraction).toHaveBeenCalledTimes(1);
    expect(harness.tx.exam.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        extractionStatus: SourceImportStatus.READY,
        extractionProvider: ExtractionProvider.LOCAL_FALLBACK,
        aiFallbackReason: expect.stringContaining("hết hạn mức"),
      }),
    }));
  });

  it("keeps successful AI batches and falls back only for failed batches", async () => {
    mockedLocalExtraction.mockResolvedValue({ questions: [question(1, 1)], warnings: ["local"] });
    const harness = createHarness(
      {
        status: "SUCCESS",
        model: "gemini-test",
        questions: [question(1, 1)],
        warnings: [],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      },
      { fileKey: chunkedKey, startPage: 4, endPage: 8 },
    );
    harness.gemini.extractPdf
      .mockResolvedValueOnce({
        status: "SUCCESS",
        model: "gemini-test",
        questions: [question(1, 1)],
        warnings: [],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      })
      .mockResolvedValue({
        status: "QUOTA",
        model: "gemini-test",
        reason: "Gemini đã hết hạn mức.",
      });

    await harness.service.processNextExam();

    expect(mockedLocalExtraction).toHaveBeenCalledTimes(3);
    expect(harness.tx.examQuestion.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ recognitionProvider: ExtractionProvider.GEMINI }),
        expect.objectContaining({ recognitionProvider: ExtractionProvider.LOCAL_FALLBACK }),
      ]),
    });
    expect(harness.tx.exam.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        extractionProvider: ExtractionProvider.LOCAL_FALLBACK,
        aiFallbackReason: expect.stringContaining("Một số cụm trang"),
      }),
    }));
  });

  it("uses the local parser without a fallback warning when AI is disabled", async () => {
    mockedLocalExtraction.mockResolvedValue({ questions: [question(1, 4)], warnings: [] });
    const harness = createHarness({
      status: "DISABLED",
      model: null,
      reason: "Chưa cấu hình GEMINI_API_KEY.",
    });

    await harness.service.processNextExam();

    expect(harness.tx.exam.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        extractionProvider: ExtractionProvider.LOCAL,
        aiFallbackReason: null,
        extractionWarnings: [],
      }),
    }));
  });

  it("marks the job failed only when both Gemini and the local parser fail", async () => {
    mockedLocalExtraction.mockRejectedValue(new Error("Local parser failed"));
    const harness = createHarness({
      status: "ERROR",
      model: "gemini-test",
      reason: "Gemini unavailable; hệ thống chuyển sang nhận diện nội bộ.",
    });

    await harness.service.processNextExam();

    expect(harness.prisma.exam.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        extractionStatus: SourceImportStatus.FAILED,
        extractionProvider: ExtractionProvider.LOCAL_FALLBACK,
        extractionError: "Local parser failed",
      }),
    }));
  });
});
