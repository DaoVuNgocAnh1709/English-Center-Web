import React from "react";

const tokenPattern =
  /(__[^\s_](?:[^_\n]{0,78}?[^\s_])?__|<u>[\s\S]{1,120}?<\/u>|\*\*[^\s*](?:[^*\n]{0,120}?[^\s*])?\*\*|<(?:b|strong)>[\s\S]{1,120}?<\/(?:b|strong)>)/gi;

export function renderFormattedText(text: string | null | undefined): React.ReactNode {
  if (!text) return "";
  const parts = text.split(tokenPattern);
  if (parts.length === 1) return text;
  return parts.map((part, index) => {
    if (!part) return null;
    if (
      (part.startsWith("__") && part.endsWith("__") && part.length >= 5) ||
      (/^<u>[\s\S]+<\/u>$/i.test(part))
    ) {
      const inner = part.startsWith("__")
        ? part.slice(2, -2)
        : part.replace(/^<u>|<\/u>$/gi, "");
      return (
        <u
          key={index}
          className="font-bold text-[#092b4c] underline decoration-[#d91f2a] decoration-2 underline-offset-4"
        >
          {inner}
        </u>
      );
    }
    if (
      (part.startsWith("**") && part.endsWith("**") && part.length >= 5) ||
      (/^<(?:b|strong)>[\s\S]+<\/(?:b|strong)>$/i.test(part))
    ) {
      const inner = part.startsWith("**")
        ? part.slice(2, -2)
        : part.replace(/^<(?:b|strong)>|<\/(?:b|strong)>$/gi, "");
      return (
        <strong key={index} className="font-bold text-[#092b4c]">
          {inner}
        </strong>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export function stripFormattedText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/<\/?(?:u|b|strong|i|em)>/gi, "")
    .replace(/__(?![_\s])([^_\n]+?)(?<![_\s])__/g, "$1")
    .replace(/\*\*([^*]+?)\*\*/g, "$1");
}

const PRONUNCIATION_GRAPHEMES = [
  "ough",
  "tion",
  "sion",
  "ture",
  "sure",
  "ear",
  "eer",
  "air",
  "our",
  "tch",
  "dge",
  "th",
  "ch",
  "sh",
  "gh",
  "ph",
  "wh",
  "qu",
  "ea",
  "ee",
  "oo",
  "ou",
  "ow",
  "ai",
  "ay",
  "ei",
  "ie",
  "oa",
  "oe",
  "au",
  "aw",
  "ew",
  "ui",
  "ed",
  "es",
  "ar",
  "er",
  "ir",
  "or",
  "ur",
];

const SINGLE_PHONEME_LETTERS = ["a", "e", "i", "o", "u", "y", "c", "g", "s"];

export function enrichPronunciationOptions(
  options: string[],
  taskType?: string | null,
): string[] {
  if (taskType !== "PRONUNCIATION" || options.length < 2) return options;
  if (options.some((opt) => /__|<u>/i.test(opt))) return options;

  const parsed = options.map((opt) => {
    const match = opt.match(/^(\s*[A-H][.)]\s*)(.+)$/i);
    return match
      ? { prefix: match[1], word: match[2].trim() }
      : { prefix: "", word: opt.trim() };
  });

  if (parsed.some((item) => !item.word || /\s/.test(item.word))) {
    return options;
  }

  for (const grapheme of PRONUNCIATION_GRAPHEMES) {
    const regex = new RegExp(grapheme, "gi");
    const matchesAll = parsed.every((item) => {
      const found = item.word.match(regex);
      return found && found.length === 1;
    });
    if (matchesAll) {
      return parsed.map(
        (item) =>
          `${item.prefix}${item.word.replace(new RegExp(`(${grapheme})`, "i"), "__$1__")}`,
      );
    }
  }

  for (const letter of SINGLE_PHONEME_LETTERS) {
    const regex = new RegExp(letter, "gi");
    const matchesAll = parsed.every((item) => {
      const found = item.word.match(regex);
      return found && found.length === 1;
    });
    if (matchesAll) {
      return parsed.map(
        (item) =>
          `${item.prefix}${item.word.replace(new RegExp(`(${letter})`, "i"), "__$1__")}`,
      );
    }
  }

  return options;
}

export function cleanQuestionPrompt(
  content: string | null | undefined,
  section: string | null | undefined,
  taskType?: string | null,
  position?: number,
): string {
  const rawContent = (content || "").trim();
  const rawSection = (section || "").trim();
  const norm = (value: string) =>
    value
      .toLocaleLowerCase("vi")
      .replace(/^[ivxlcdm0-9]+[.)\s:-]*/i, "")
      .replace(/[^a-z0-9\u00C0-\u1EF9]+/gi, "");

  const isDuplicateOfSection =
    !rawContent ||
    (rawSection.length > 0 && norm(rawContent) === norm(rawSection));

  if (!isDuplicateOfSection) return rawContent;

  switch (taskType) {
    case "PRONUNCIATION":
      return "Chọn từ có phần gạch chân được phát âm khác với các từ còn lại.";
    case "STRESS":
      return "Chọn từ có vị trí trọng âm chính khác với các từ còn lại.";
    case "ERROR_CORRECTION":
      return "Chọn phần gạch chân cần sửa trong câu.";
    case "SYNONYM":
      return "Chọn từ hoặc cụm từ đồng nghĩa với phần được nhấn mạnh.";
    case "ANTONYM":
      return "Chọn từ hoặc cụm từ trái nghĩa với phần được nhấn mạnh.";
    default:
      return rawSection ? "Chọn phương án đúng cho câu hỏi dưới đây:" : `Câu ${position || ""}`;
  }
}
