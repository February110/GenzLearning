export function resolveAvatar(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const v = String(raw).trim();
  if (!v) return undefined;
  const lower = v.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("data:") || lower.startsWith("blob:")) {
    return v;
  }
  const baseRaw = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5081";
  const sanitizedBase = baseRaw.replace(/\/api\/?$/i, "").replace(/\/$/, "");
  const path = v.replace(/^\/+/, "");
  return `${sanitizedBase}/${path}`;
}
