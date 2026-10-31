import { GeminiImportService } from "./gemini-import.service";

describe("GeminiImportService", () => {
  let service: GeminiImportService;
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    service = new GeminiImportService();
    process.env.AI_IMPORT_ENABLED = "true";
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "gemini-test";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it("uses the local pipeline when no API key is configured", async () => {
    process.env.GEMINI_API_KEY = "";
    global.fetch = jest.fn() as typeof fetch;

    const result = await service.extractPdf(Buffer.from("pdf"));

    expect(result.status).toBe("DISABLED");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("normalizes a structured Gemini response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                questions: [{
                  sourceLabel: "1",
                  section: "Choose the correct answer.",
                  kind: "SINGLE_CHOICE",
                  content: "She ___ to school every day.",
                  options: ["A. go", "B. goes", "C. going"],
                  answer: null,
                  points: 1,
                  sourcePage: 2,
                  confidence: 0.94,
                }],
                warnings: [],
              }),
            }],
          },
        }],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150,
        },
      }),
    }) as typeof fetch;

    const result = await service.extractPdf(Buffer.from("pdf"));

    expect(result.status).toBe("SUCCESS");
    if (result.status !== "SUCCESS") throw new Error("Expected success");
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]).toMatchObject({
      position: 1,
      sourcePage: 2,
      options: ["A. go", "B. goes", "C. going"],
      recognitionConfidence: 0.88,
    });
    expect(result.usage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("test-key");
    expect(init.headers).toMatchObject({ "x-goog-api-key": "test-key" });
    expect(String(init.body)).not.toContain("test-key");
    expect(JSON.parse(String(init.body))).toMatchObject({
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: expect.objectContaining({ type: "object" }),
      },
    });
  });

  it("does not call Gemini when AI import is explicitly disabled", async () => {
    process.env.AI_IMPORT_ENABLED = "false";
    global.fetch = jest.fn() as typeof fetch;

    const result = await service.extractPdf(Buffer.from("pdf"));

    expect(result.status).toBe("DISABLED");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("falls back without retrying when the free-tier quota is exhausted", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "Quota exceeded" } }),
    }) as typeof fetch;

    const result = await service.extractPdf(Buffer.from("pdf"));

    expect(result.status).toBe("QUOTA");
    expect(result.status === "QUOTA" && result.reason).toContain("hết hạn mức");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back when the API key is rejected", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: "API key rejected" } }),
    }) as typeof fetch;

    const result = await service.extractPdf(Buffer.from("pdf"));

    expect(result.status).toBe("ERROR");
    expect(result.status === "ERROR" && result.reason).toContain("chuyển sang nhận diện nội bộ");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back when Gemini returns malformed JSON", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "{not-json" }] } }],
      }),
    }) as typeof fetch;

    const result = await service.extractPdf(Buffer.from("pdf"));

    expect(result.status).toBe("ERROR");
    expect(result.status === "ERROR" && result.reason).toContain("dữ liệu không hợp lệ");
  });

  it("drops empty rows and normalizes unsupported question shapes", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                questions: [
                  {
                    sourceLabel: "heading",
                    section: null,
                    kind: "SHORT_TEXT",
                    content: "",
                    options: [],
                    answer: null,
                    points: 1,
                    sourcePage: 1,
                    confidence: 0.2,
                  },
                  {
                    sourceLabel: "2",
                    section: null,
                    kind: "SINGLE_CHOICE",
                    content: "Write the correct form.",
                    options: ["only one option"],
                    answer: null,
                    points: 0,
                    sourcePage: 0,
                    confidence: 1.4,
                  },
                ],
                warnings: [],
              }),
            }],
          },
        }],
      }),
    }) as typeof fetch;

    const result = await service.extractPdf(Buffer.from("pdf"));

    expect(result.status).toBe("SUCCESS");
    if (result.status !== "SUCCESS") throw new Error("Expected success");
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]).toMatchObject({
      position: 1,
      kind: "SHORT_TEXT",
      points: 1,
      sourcePage: 1,
      recognitionConfidence: 0.88,
    });
  });

  it("falls back when all returned rows are invalid", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify({ questions: [], warnings: [] }) }],
          },
        }],
      }),
    }) as typeof fetch;

    const result = await service.extractPdf(Buffer.from("pdf"));

    expect(result.status).toBe("INVALID");
  });

  it("classifies richer English exercise types and preserves multiple selection", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        questions: [
          { sourceLabel: "1", section: "Choose TWO answers.", kind: "MULTIPLE_CHOICE", taskType: "MULTIPLE_SELECT", content: "Which activities help the environment?", options: ["A. Recycle", "B. Litter", "C. Reuse"], answer: "A, C", points: 1, sourcePage: 1, confidence: 0.95 },
          { sourceLabel: "2", section: "Find the word closest in meaning.", kind: "SINGLE_CHOICE", taskType: "GENERAL", content: "The village is renowned for silk.", options: ["A. famous", "B. quiet"], answer: "A", points: 1, sourcePage: 1, confidence: 0.92 },
          { sourceLabel: "3", section: "Decide True or False.", kind: "TRUE_FALSE", taskType: "TRUE_FALSE", content: "The text mentions a craft village.", options: [], answer: "", points: 1, sourcePage: 1, confidence: 0.9 },
          { sourceLabel: "4", section: "Match the two columns.", kind: "SHORT_TEXT", taskType: "MATCHING", content: "Match each word with its meaning.", options: [], interactionData: { matchingLeft: ["artisan", "pottery"], matchingRight: ["a skilled craft worker", "objects made from clay"], orderingItems: [] }, answer: "", points: 1, sourcePage: 1, confidence: 0.93 },
          { sourceLabel: "5", section: "Put the events in order.", kind: "SHORT_TEXT", taskType: "ORDERING", content: "Arrange the steps.", options: [], interactionData: { matchingLeft: [], matchingRight: [], orderingItems: ["Mix the clay", "Shape the pot", "Fire it"] }, answer: "", points: 1, sourcePage: 1, confidence: 0.91 },
        ], warnings: [],
      }) }] } }], usageMetadata: {} }),
    }) as typeof fetch;

    const result = await service.extractPdf(Buffer.from("pdf"));

    expect(result.status).toBe("SUCCESS");
    if (result.status !== "SUCCESS") throw new Error("Expected success");
    expect(result.questions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "MULTIPLE_CHOICE", taskType: "MULTIPLE_SELECT" }),
      expect.objectContaining({ taskType: "SYNONYM" }),
      expect.objectContaining({ kind: "TRUE_FALSE", options: ["True", "False"] }),
      expect.objectContaining({ taskType: "MATCHING", interactionData: { matchingLeft: ["artisan", "pottery"], matchingRight: ["a skilled craft worker", "objects made from clay"], orderingItems: [] } }),
      expect.objectContaining({ taskType: "ORDERING", interactionData: { matchingLeft: [], matchingRight: [], orderingItems: ["Mix the clay", "Shape the pot", "Fire it"] } }),
    ]));
  });

  it("opens a quota circuit and skips repeated API calls during cooldown", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "Quota exceeded" } }),
    }) as typeof fetch;

    await service.extractPdf(Buffer.from("pdf"));
    const second = await service.extractPdf(Buffer.from("pdf"));

    expect(second.status).toBe("QUOTA");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("normalizes short sentence-building tasks and removes repeated choices", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                questions: [
                  {
                    sourceLabel: "1",
                    section: "Choose the word with a different sound.",
                    kind: "SINGLE_CHOICE",
                    content: "A. layer B. frame C. artisan D. place",
                    options: ["A. layer", "B. frame", "C. artisan", "D. place"],
                    answer: "",
                    points: 1,
                    sourcePage: 1,
                    confidence: 0.99,
                  },
                  {
                    sourceLabel: "2",
                    section: "Use the prompts to make a complete sentence.",
                    kind: "ESSAY",
                    content: "The village/ famous/ silk products.",
                    options: [],
                    answer: "",
                    points: 1,
                    sourcePage: 1,
                    confidence: 0.9,
                  },
                ],
                warnings: [],
              }),
            }],
          },
        }],
      }),
    }) as typeof fetch;

    const result = await service.extractPdf(Buffer.from("pdf"));

    expect(result.status).toBe("SUCCESS");
    if (result.status !== "SUCCESS") throw new Error("Expected success");
    expect(result.questions[0]).toMatchObject({
      content: "Choose the word with a different sound.",
      reviewFlags: expect.arrayContaining(["CHOICES_DEDUPLICATED"]),
    });
    expect(result.questions[1]).toMatchObject({
      kind: "SHORT_TEXT",
      reviewFlags: expect.arrayContaining(["TYPE_NORMALIZED"]),
    });
  });

  it("falls back when the request times out", async () => {
    global.fetch = jest.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")) as typeof fetch;

    const result = await service.extractPdf(Buffer.from("pdf"));

    expect(result.status).toBe("ERROR");
    expect(result.status === "ERROR" && result.reason).toContain("quá thời gian");
  });

  it("does not call Gemini when the cropped PDF exceeds the inline limit", async () => {
    process.env.AI_IMPORT_MAX_INLINE_MB = "1";
    global.fetch = jest.fn() as typeof fetch;

    const result = await service.extractPdf(Buffer.alloc(1024 * 1024 + 1));

    expect(result.status).toBe("ERROR");
    expect(result.status === "ERROR" && result.reason).toContain("vượt giới hạn");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
