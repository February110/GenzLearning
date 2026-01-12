"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/api/client";
import { FileViewerTarget, getFileExtension } from "@/utils/fileViewer";

const OFFICE_EXTS = new Set(["doc", "docx", "ppt", "pptx", "xls", "xlsx", "pps", "ppsx"]);
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "ogg", "mov", "m4v", "mkv", "avi"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac"]);
const TEXT_EXTS = new Set(["txt", "csv", "log", "md", "json", "xml", "yml", "yaml"]);

function getDisplayName(nameParam?: string | null, key?: string | null, url?: string | null) {
  if (nameParam) return nameParam;
  if (key) return key.split("/").pop() || "Tệp";
  if (!url) return "Tệp";
  const clean = url.split("?")[0].split("#")[0];
  const base = clean.split("/").pop();
  if (!base) return "Tệp";
  try {
    return decodeURIComponent(base);
  } catch {
    return base;
  }
}

export default function FileViewerPanel({
  target,
  onClose,
  className,
}: {
  target: FileViewerTarget;
  onClose?: () => void;
  className?: string;
}) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const { key, url, submissionId } = target;
    async function load() {
      setLoading(true);
      setError(null);
      setFileUrl(null);
      try {
        if (url) {
          if (active) setFileUrl(url);
          return;
        }
        if (key) {
          const { data } = await api.get(`/submissions/public-url`, { params: { key } });
          if (active) setFileUrl(data.url || data.downloadUrl);
          return;
        }
        if (submissionId) {
          const { data } = await api.get(`/submissions/${submissionId}/download`);
          if (active) setFileUrl(data.url || data.downloadUrl);
          return;
        }
        if (active) setError("Thiếu thông tin tệp để hiển thị.");
      } catch (err: any) {
        const msg = err?.response?.data?.message || "Không tải được tệp.";
        if (active) setError(msg);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [target]);

  const displayName = useMemo(
    () => getDisplayName(target.name ?? null, target.key ?? null, fileUrl ?? target.url ?? null),
    [target.name, target.key, target.url, fileUrl]
  );
  const downloadName = useMemo(() => {
    const raw = displayName || "tep";
    return raw.replace(/[\\/:*?"<>|]/g, "-");
  }, [displayName]);
  const ext = useMemo(() => {
    return (
      getFileExtension(target.name) ||
      getFileExtension(target.key) ||
      getFileExtension(target.url) ||
      getFileExtension(fileUrl)
    );
  }, [target.name, target.key, target.url, fileUrl]);

  const viewerType = useMemo(() => {
    if (!ext) return "generic";
    if (OFFICE_EXTS.has(ext)) return "office";
    if (IMAGE_EXTS.has(ext)) return "image";
    if (VIDEO_EXTS.has(ext)) return "video";
    if (AUDIO_EXTS.has(ext)) return "audio";
    if (TEXT_EXTS.has(ext) || ext === "pdf") return "iframe";
    return "generic";
  }, [ext]);

  const officeUrl = useMemo(() => {
    if (!fileUrl || viewerType !== "office") return null;
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
  }, [fileUrl, viewerType]);

  return (
    <div className={className ?? "p-4 md:p-6 space-y-4"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-gray-500">Xem tệp</div>
          <div className="text-lg md:text-xl font-semibold break-all">{displayName}</div>
        </div>
        <div className="flex items-center gap-2">
          {fileUrl && (
            <a
              href={fileUrl}
              download={downloadName}
              className="rounded-md border border-gray-200 dark:border-gray-800 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              Tải xuống
            </a>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 dark:border-gray-800 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              Đóng
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-4">
        {loading && <div className="text-sm text-gray-500">Đang tải tệp...</div>}
        {!loading && error && <div className="text-sm text-rose-600">{error}</div>}
        {!loading && !error && fileUrl && (
          <div className="w-full">
            {viewerType === "image" && (
              <div className="flex justify-center">
                <img src={fileUrl} alt={displayName} className="max-h-[70vh] w-auto object-contain" />
              </div>
            )}
            {viewerType === "video" && <video controls src={fileUrl} className="w-full max-h-[70vh]" />}
            {viewerType === "audio" && <audio controls src={fileUrl} className="w-full" />}
            {viewerType === "office" && (
              <iframe
                title={displayName}
                src={officeUrl || undefined}
                className="w-full h-[70vh] rounded-md border border-gray-100 dark:border-gray-800"
              />
            )}
            {viewerType === "iframe" && (
              <iframe
                title={displayName}
                src={fileUrl}
                className="w-full h-[70vh] rounded-md border border-gray-100 dark:border-gray-800"
              />
            )}
            {viewerType === "generic" && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Định dạng này có thể không xem trực tiếp được trên trình duyệt.
                </div>
                <iframe
                  title={displayName}
                  src={fileUrl}
                  className="w-full h-[70vh] rounded-md border border-gray-100 dark:border-gray-800"
                />
              </div>
            )}
          </div>
        )}
        {!loading && !error && !fileUrl && <div className="text-sm text-gray-500">Không có tệp.</div>}
      </div>
    </div>
  );
}
