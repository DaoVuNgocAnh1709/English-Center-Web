import { Injectable } from "@nestjs/common";
import { QuestionKind, QuestionTaskType } from "@prisma/client";
import { ImportedQuestion } from "./question-importer";

type GeminiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type GeminiImportResult =
  | {
      status: "SUCCESS";
      model: string;
      questions: ImportedQuestion[];
      warnings: string[];
      usage: GeminiUsage;
    }
  | {
      status: "DISABLED" | "QUOTA" | "ERROR" | "INVALID";
      model: string | null;
      reason: string;
    };

const responseSchema = {
  type: "object",
  required: ["questions", "warnings"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        required: [
          "sourceLabel",
          "section",
          "kind",
          "taskType",
          "content",
          "options",
          "answer",
          "points",
          "sourcePage",
          "confidence",
          "interactionData",
        ],
        properties: {
          sourceLabel: { type: "string" },
          section: { type: "string" },
          kind: {
            type: "string",
            enum: [
              "SINGLE_CHOICE",
              "MULTIPLE_CHOICE",
              "TRUE_FALSE",
              "SHORT_TEXT",
              "ESSAY",
            ],
          },
          taskType: {
            type: "string",
            enum: Object.values(QuestionTaskType),
          },
          content: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" },
          },
          answer: { type: "string" },
          points: { type: "number" },
          sourcePage: { type: "integer" },
          confidence: { type: "number" },
          interactionData: {
            type: "object",
            required: ["matchingLeft", "matchingRight", "orderingItems"],
            properties: {
              matchingLeft: { type: "array", items: { type: "string" } },
              matchingRight: { type: "array", items: { type: "string" } },
              orderingItems: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
};

const prompt = `
Chuyển toàn bộ đề tiếng Anh trong PDF thành dữ liệu câu hỏi web.

Quy tắc bắt buộc:
- Giữ nguyên nội dung câu hỏi và lựa chọn; không dịch, không viết lại.
- Không coi tiêu đề, từ vựng giải nghĩa, ví dụ, đáp án mẫu hoặc nội dung bài đọc là câu hỏi độc lập.
- Đoạn văn/hướng dẫn dùng chung đặt trong trường section của các câu liên quan.
- SINGLE_CHOICE: chọn đúng một phương án.
- MULTIPLE_CHOICE: có thể chọn từ hai phương án đúng trở lên.
- TRUE_FALSE: nhận định đúng/sai.
- SHORT_TEXT dùng cho điền từ, viết lại câu hoặc câu trả lời ngắn.
- ESSAY dùng cho bài viết dài.
- content không được lặp lại các lựa chọn A–D đã đặt trong options.
- Dạng dùng từ gợi ý để viết một câu hoàn chỉnh là SHORT_TEXT, không phải ESSAY.
- taskType phải phân loại ý nghĩa bài tập: PRONUNCIATION, STRESS, VOCABULARY, SYNONYM, ANTONYM, PHRASAL_VERB, GRAMMAR, GAP_FILL, FUNCTIONAL_COMMUNICATION, PASSIVE_VOICE, REPORTED_SPEECH, CONDITIONAL_SENTENCE, RELATIVE_CLAUSE, TAG_QUESTION, WORD_FORM, VERB_FORM, CLOZE, READING_COMPREHENSION, MULTIPLE_SELECT, TRUE_FALSE, MATCHING, ORDERING, ERROR_CORRECTION, SENTENCE_COMBINATION, SENTENCE_REWRITE, SENTENCE_BUILDING, TRANSLATION, LISTENING, DICTATION, WRITING, GENERAL hoặc OTHER.
- Chỉ điền answer khi đáp án được ghi rõ trong chính PDF; tuyệt đối không tự giải đề. Nếu không có đáp án, trả chuỗi rỗng.
- sourcePage là số trang trong PDF được gửi, bắt đầu từ 1.
- sourceLabel giữ số hoặc nhãn câu trong tài liệu. Nếu không có nhãn rõ ràng, dùng thứ tự câu.
- confidence phản ánh độ chắc chắn rằng câu và các lựa chọn đã được tách đúng.
- Với MATCHING, dùng SHORT_TEXT; interactionData.matchingLeft chứa nguyên văn danh sách cột trái và matchingRight chứa nguyên văn danh sách cột phải. Hai danh sách độc lập, không tự ghép đáp án. Các mảng khác để rỗng.
- Với ORDERING, dùng SHORT_TEXT; interactionData.orderingItems chứa nguyên văn các mục theo thứ tự đang hiển thị trong đề, không tự giải hoặc sắp đúng. Các mảng khác để rỗng.
- Nếu PDF ghi rõ đáp án MATCHING, answer là chuỗi JSON object với khóa "0", "1"... theo vị trí matchingLeft và giá trị là nguyên văn mục matchingRight tương ứng. Nếu PDF ghi rõ đáp án ORDERING, answer là chuỗi JSON array các mục theo thứ tự đúng.
- Với dạng khác, cả ba mảng trong interactionData để rỗng.
- Không được bỏ qua câu chỉ vì không có đáp án.
`;

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function stringList(value: unknown, maxItems = 40) {
  return Array.isArray(value)
    ? value.map((item) => textValue(item, 1_000)).filter(Boolean).slice(0, maxItems)
    : [];
}

function inferTaskType(value: string, kind: QuestionKind): QuestionTaskType {
  const text = value.normalize("NFKC").toLocaleLowerCase("vi");
  if (/pronunciation|different sound|underlined part|phát âm/.test(text)) return QuestionTaskType.PRONUNCIATION;
  if (/stress pattern|primary stress|trọng âm/.test(text)) return QuestionTaskType.STRESS;
  if (/closest in meaning|same meaning|synonym|đồng nghĩa/.test(text)) return QuestionTaskType.SYNONYM;
  if (/opposite in meaning|antonym|trái nghĩa/.test(text)) return QuestionTaskType.ANTONYM;
  if (/phrasal verb|cụm động từ/.test(text)) return QuestionTaskType.PHRASAL_VERB;
  if (/word form|correct form of the word|dạng đúng của từ/.test(text)) return QuestionTaskType.WORD_FORM;
  if (/verb form|correct tense|correct form of the verb|chia động từ/.test(text)) return QuestionTaskType.VERB_FORM;
  if (/cloze|fill in each blank|complete the passage|điền.{0,20}đoạn văn/.test(text)) return QuestionTaskType.CLOZE;
  if (/fill in the blank|complete (?:each|the) sentence|gap fill|điền (?:từ|chỗ trống)/.test(text)) return QuestionTaskType.GAP_FILL;
  if (/read(?:ing)? the passage|according to the passage|đọc.{0,30}(?:đoạn|bài)/.test(text)) return QuestionTaskType.READING_COMPREHENSION;
  if (/true or false|true\/false|đúng.{0,5}sai/.test(text) || kind === QuestionKind.TRUE_FALSE) return QuestionTaskType.TRUE_FALSE;
  if (/choose (?:all|two|three)|more than one|chọn.{0,20}nhiều/.test(text) || kind === QuestionKind.MULTIPLE_CHOICE) return QuestionTaskType.MULTIPLE_SELECT;
  if (/match|matching|nối.{0,20}(?:cột|cặp)/.test(text)) return QuestionTaskType.MATCHING;
  if (/order|rearrange|put.{0,20}order|sắp xếp/.test(text)) return QuestionTaskType.ORDERING;
  if (/find (?:and correct )?(?:the )?mistake|error correction|sửa lỗi/.test(text)) return QuestionTaskType.ERROR_CORRECTION;
  if (/communication|best response|respond|would you like|what do you say|giao tiếp/.test(text)) return QuestionTaskType.FUNCTIONAL_COMMUNICATION;
  if (/passive voice|change.{0,20}passive|câu bị động/.test(text)) return QuestionTaskType.PASSIVE_VOICE;
  if (/reported speech|indirect speech|câu tường thuật/.test(text)) return QuestionTaskType.REPORTED_SPEECH;
  if (/conditional sentence|if clause|câu điều kiện/.test(text)) return QuestionTaskType.CONDITIONAL_SENTENCE;
  if (/relative clause|relative pronoun|mệnh đề quan hệ/.test(text)) return QuestionTaskType.RELATIVE_CLAUSE;
  if (/tag question|question tag|câu hỏi đuôi/.test(text)) return QuestionTaskType.TAG_QUESTION;
  if (/combine|join (?:the )?(?:two )?sentences|kết hợp câu/.test(text)) return QuestionTaskType.SENTENCE_COMBINATION;
  if (/rewrite|complete the second sentence|viết lại câu/.test(text)) return QuestionTaskType.SENTENCE_REWRITE;
  if (/make (?:a |the )?(?:complete )?sentence|use the (?:words|prompts)|từ gợi ý/.test(text)) return QuestionTaskType.SENTENCE_BUILDING;
  if (/translate|dịch (?:sang|câu)/.test(text)) return QuestionTaskType.TRANSLATION;
  if (/dictation|write down what you hear|nghe.{0,20}chép/.test(text)) return QuestionTaskType.DICTATION;
  if (/listen|listening|nghe/.test(text)) return QuestionTaskType.LISTENING;
  if (/write|essay|paragraph|letter|email|bài luận|đoạn văn/.test(text) && kind === QuestionKind.ESSAY) return QuestionTaskType.WRITING;
  if (/vocabulary|word meaning|synonym|antonym|từ vựng/.test(text)) return QuestionTaskType.VOCABULARY;
  if (/grammar|tense|preposition|article|relative clause|ngữ pháp/.test(text)) return QuestionTaskType.GRAMMAR;
  return QuestionTaskType.GENERAL;
}

@Injectable()
export class GeminiImportService {
  private blockedUntil = 0;
  private blockedReason = "";

  async extractPdf(
    buffer: Buffer,
    options: { model?: string } = {},
  ): Promise<GeminiImportResult> {
    const enabled = process.env.AI_IMPORT_ENABLED === "true";
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const model =
      options.model?.trim() ||
      process.env.GEMINI_MODEL?.trim() ||
      "gemini-3.5-flash-lite";
    if (!enabled || !apiKey)
      return {
        status: "DISABLED",
        model: null,
        reason: !enabled
          ? "Nhận diện Gemini đang tắt."
          : "Chưa cấu hình GEMINI_API_KEY.",
      };
    if (Date.now() < this.blockedUntil)
      return {
        status: "QUOTA",
        model,
        reason:
          this.blockedReason ||
          "Gemini đang tạm nghỉ sau khi chạm giới hạn; hệ thống chuyển sang nhận diện nội bộ.",
      };

    const maxInlineBytes = Math.max(
      1,
      numberValue(process.env.AI_IMPORT_MAX_INLINE_MB) || 14,
    ) * 1024 * 1024;
    if (buffer.length > maxInlineBytes)
      return {
        status: "ERROR",
        model,
        reason: "PDF vượt giới hạn gửi trực tiếp tới Gemini; hệ thống chuyển sang nhận diện nội bộ.",
      };

    const timeoutMs = Math.max(
      10_000,
      numberValue(process.env.AI_IMPORT_TIMEOUT_MS) || 120_000,
    );
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: buffer.toString("base64"),
                  },
                },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: responseSchema,
            thinkingConfig: {
              thinkingLevel: ["minimal", "low", "medium", "high"].includes(
                process.env.GEMINI_THINKING_LEVEL || "minimal",
              )
                ? process.env.GEMINI_THINKING_LEVEL || "minimal"
                : "minimal",
            },
            maxOutputTokens: Math.max(
              4_096,
              numberValue(process.env.AI_IMPORT_MAX_OUTPUT_TOKENS) || 65_536,
            ),
          },
        }),
      });
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) {
        const error = payload?.error as Record<string, unknown> | undefined;
        const message = textValue(error?.message, 400) || `Gemini HTTP ${response.status}`;
        if (response.status === 429) {
          this.blockedUntil = Date.now() + Math.max(
            60_000,
            numberValue(process.env.AI_IMPORT_QUOTA_COOLDOWN_MS) || 1_800_000,
          );
          this.blockedReason =
            "Gemini đã hết hạn mức; hệ thống tạm nghỉ AI và chuyển sang nhận diện nội bộ.";
        }
        return {
          status: response.status === 429 ? "QUOTA" : "ERROR",
          model,
          reason:
            response.status === 429
              ? "Gemini đã hết hạn mức hoặc đang bị giới hạn request; hệ thống chuyển sang nhận diện nội bộ."
              : `Gemini không khả dụng (${message}); hệ thống chuyển sang nhận diện nội bộ.`,
        };
      }

      const candidates = payload?.candidates as Array<Record<string, unknown>> | undefined;
      const content = candidates?.[0]?.content as Record<string, unknown> | undefined;
      const parts = content?.parts as Array<Record<string, unknown>> | undefined;
      const raw = parts?.map((part) => String(part.text ?? "")).join("").trim();
      if (!raw)
        return {
          status: "INVALID",
          model,
          reason: "Gemini không trả về dữ liệu câu hỏi; hệ thống chuyển sang nhận diện nội bộ.",
        };

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const rows = Array.isArray(parsed.questions) ? parsed.questions : [];
      const questions: ImportedQuestion[] = rows
        .slice(0, 200)
        .flatMap((value, index) => {
          if (!value || typeof value !== "object") return [];
          const row = value as Record<string, unknown>;
          const contentText = textValue(row.content, 4_000);
          if (!contentText) return [];
          const sectionText = row.section == null
            ? ""
            : textValue(row.section, 1_000);
          const options = Array.isArray(row.options)
            ? row.options.map((item) => textValue(item, 1_000)).filter(Boolean).slice(0, 8)
            : [];
          const requestedKind = String(row.kind || "SHORT_TEXT") as QuestionKind;
          const supportedKind = Object.values(QuestionKind).includes(requestedKind)
            ? requestedKind
            : QuestionKind.SHORT_TEXT;
          const essaySignal = `${sectionText} ${contentText}`;
          const isLongForm =
            contentText.length > 300 ||
            /(?:write|compose).{0,40}(?:paragraph|essay|letter|email|story|about)|\b\d{2,3}\s*words?\b|(?:viết|soạn).{0,40}(?:đoạn văn|bài luận|thư|email)/i.test(
              essaySignal,
            );
          const preliminaryKind = options.length >= 2
            ? supportedKind === QuestionKind.MULTIPLE_CHOICE
              ? QuestionKind.MULTIPLE_CHOICE
              : supportedKind === QuestionKind.TRUE_FALSE
                ? QuestionKind.TRUE_FALSE
                : QuestionKind.SINGLE_CHOICE
            : supportedKind === QuestionKind.ESSAY && isLongForm
              ? QuestionKind.ESSAY
              : QuestionKind.SHORT_TEXT;
          const taskTypeFromAi = String(row.taskType || "GENERAL") as QuestionTaskType;
          const inferredTaskType = inferTaskType(
            `${sectionText} ${contentText}`,
            preliminaryKind,
          );
          const taskType =
            Object.values(QuestionTaskType).includes(taskTypeFromAi) &&
            taskTypeFromAi !== QuestionTaskType.GENERAL
              ? taskTypeFromAi
              : inferredTaskType;
          const kind = taskType === QuestionTaskType.TRUE_FALSE
            ? QuestionKind.TRUE_FALSE
            : taskType === QuestionTaskType.MULTIPLE_SELECT
              ? QuestionKind.MULTIPLE_CHOICE
              : preliminaryKind;
          const normalizedOptions =
            kind === QuestionKind.TRUE_FALSE && options.length < 2
              ? ["True", "False"]
              : options;
          const rawInteraction = row.interactionData && typeof row.interactionData === "object"
            ? row.interactionData as Record<string, unknown>
            : {};
          const interactionData = {
            matchingLeft: stringList(rawInteraction.matchingLeft),
            matchingRight: stringList(rawInteraction.matchingRight),
            orderingItems: stringList(rawInteraction.orderingItems),
          };
          const repeatsAllChoices =
            options.length >= 2 &&
            options.every((option) => contentText.includes(option));
          const normalizedContent = repeatsAllChoices && sectionText
            ? sectionText
            : contentText;
          let structuralConfidence = 0.96;
          if (normalizedContent.length < 8) structuralConfidence -= 0.12;
          if (
            ([
              QuestionKind.SINGLE_CHOICE,
              QuestionKind.MULTIPLE_CHOICE,
              QuestionKind.TRUE_FALSE,
            ] as QuestionKind[]).includes(kind) && normalizedOptions.length < 2
          )
            structuralConfidence -= 0.4;
          if (taskType === QuestionTaskType.GENERAL) structuralConfidence -= 0.08;
          const incompleteInteraction =
            (taskType === QuestionTaskType.MATCHING &&
              (interactionData.matchingLeft.length < 2 || interactionData.matchingRight.length < 2)) ||
            (taskType === QuestionTaskType.ORDERING && interactionData.orderingItems.length < 2);
          if (incompleteInteraction) structuralConfidence -= 0.35;
          const confidence = Math.max(
            0.05,
            Math.min(
              0.96,
              numberValue(row.confidence) || 0.5,
              structuralConfidence,
            ),
          );
          const flags = ["AI_EXTRACTED"];
          if (confidence < 0.78) flags.push("LOW_CONFIDENCE", "NEEDS_REVIEW");
          if (requestedKind === QuestionKind.ESSAY && kind !== QuestionKind.ESSAY)
            flags.push("TYPE_NORMALIZED");
          if (normalizedContent !== contentText) flags.push("CHOICES_DEDUPLICATED");
          if (incompleteInteraction) flags.push("INTERACTION_INCOMPLETE", "NEEDS_REVIEW");
          if (
            ([
              QuestionKind.SINGLE_CHOICE,
              QuestionKind.MULTIPLE_CHOICE,
              QuestionKind.TRUE_FALSE,
            ] as QuestionKind[]).includes(kind) && normalizedOptions.length < 2
          )
            flags.push("NO_OPTIONS");
          return [{
            position: index + 1,
            sourceLabel: textValue(row.sourceLabel, 100) || String(index + 1),
            section: sectionText || null,
            kind,
            taskType,
            interactionData,
            content: normalizedContent,
            options: normalizedOptions,
            answer: row.answer == null ? null : textValue(row.answer, 1_000) || null,
            points: Math.max(0.1, Math.min(100, numberValue(row.points) || 1)),
            sourcePage: Math.max(1, Math.trunc(numberValue(row.sourcePage) || 1)),
            recognitionConfidence: confidence,
            reviewFlags: flags,
            sourceBounds: null,
          }];
        })
        .map((question, index) => ({ ...question, position: index + 1 }));
      if (!questions.length)
        return {
          status: "INVALID",
          model,
          reason: "Gemini không nhận diện được câu hỏi hợp lệ; hệ thống chuyển sang nhận diện nội bộ.",
        };

      const usage = (payload?.usageMetadata || {}) as Record<string, unknown>;
      return {
        status: "SUCCESS",
        model,
        questions,
        warnings: [
          ...(Array.isArray(parsed.warnings)
            ? parsed.warnings.map((item) => textValue(item, 300)).filter(Boolean).slice(0, 20)
            : []),
          "Đề được Gemini chuẩn hóa; giáo viên vẫn cần đối chiếu trước khi xuất bản.",
        ],
        usage: {
          inputTokens: Math.max(0, Math.trunc(numberValue(usage.promptTokenCount))),
          outputTokens: Math.max(0, Math.trunc(numberValue(usage.candidatesTokenCount))),
          totalTokens: Math.max(0, Math.trunc(numberValue(usage.totalTokenCount))),
        },
      };
    } catch (error) {
      return {
        status: "ERROR",
        model,
        reason:
          error instanceof SyntaxError
            ? "Gemini trả dữ liệu không hợp lệ; hệ thống chuyển sang nhận diện nội bộ."
            : "Không kết nối được Gemini hoặc yêu cầu quá thời gian; hệ thống chuyển sang nhận diện nội bộ.",
      };
    }
  }
}
