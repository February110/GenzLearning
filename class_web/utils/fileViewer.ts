export type FileViewerTarget = {
  key?: string;
  url?: string;
  submissionId?: string;
  name?: string;
};

const KNOWN_FILE_EXTS = new Set([
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "pps", "ppsx",
  "png", "jpg", "jpeg", "gif", "bmp", "webp", "svg",
  "txt", "csv", "log", "md", "json", "xml", "yml", "yaml", "rtf",
  "zip", "rar", "7z",
  "mp4", "webm", "ogg", "mov", "m4v", "mkv", "avi",
  "mp3", "wav", "m4a", "aac", "flac",
  "odt", "ods", "odp"
]);

export function buildFileViewerUrl(target: FileViewerTarget) {
  const params = new URLSearchParams();
  if (target.key) params.set("key", target.key);
  if (target.url) params.set("url", target.url);
  if (target.submissionId) params.set("id", target.submissionId);
  if (target.name) params.set("name", target.name);
  const query = params.toString();
  return query ? `/file-viewer?${query}` : "/file-viewer";
}

export function openFileViewer(target: FileViewerTarget) {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (!w.__fileViewerHostReady) {
    w.__fileViewerPendingTarget = target;
  }
  window.dispatchEvent(new CustomEvent("file-viewer:open", { detail: target }));
}

export function getFileExtension(input?: string | null) {
  if (!input) return "";
  const clean = input.split("?")[0].split("#")[0];
  const base = clean.split("/").pop() || "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function isLikelyFileUrl(url?: string | null, name?: string | null) {
  const ext = getFileExtension(name) || getFileExtension(url);
  return Boolean(ext && KNOWN_FILE_EXTS.has(ext));
}
