/**
 * Chỉ cho phép liên kết ngoài dùng giao thức http/https.
 * Chặn các scheme nguy hiểm như `javascript:`, `data:`, `vbscript:`.
 */
export function safeExternalUrl(value?: string | null): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
