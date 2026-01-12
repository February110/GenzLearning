"use client";

import { useEffect, useState } from "react";
import api from "@/api/client";
import { toast } from "react-hot-toast";
import Button from "@/components/ui/Button";
import RichTextEditor from "@/components/common/RichTextEditor";
import { Paperclip } from "lucide-react";

type ReuseDraft = {
  sourceId: string;
  content: string;
  materials?: any[];
  copyAttachments?: boolean;
};

export default function AnnouncementModal({
  classroomId,
  onClose,
  draft,
}: {
  classroomId: string;
  onClose: () => void;
  draft?: ReuseDraft | null;
}) {
  const [content, setContent] = useState("");
  const [all, setAll] = useState(true);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [reuseMaterials, setReuseMaterials] = useState<any[]>([]);
  const copyAttachments = draft?.copyAttachments ?? true;

  // Members to target specific students
  const [members, setMembers] = useState<{ userId: string; fullName: string; role: string }[]>([]);
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const reuseMode = !!draft?.sourceId;

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/classrooms/${classroomId}`);
        const list = (data?.Members || data?.members || []) as any[];
        const students = list
          .map((m: any) => ({ userId: String(m.UserId || m.userId), fullName: m.FullName || m.fullName || "", role: m.Role || m.role || "" }))
          .filter((m: any) => String(m.role).toLowerCase() === "student");
        setMembers(students);
      } catch {}
    })();
  }, [classroomId]);

  useEffect(() => {
    if (!draft) {
      setReuseMaterials([]);
      return;
    }
    setContent(draft.content || "");
    setAll(true);
    setTargetIds([]);
    setFiles([]);
    setLinks([]);
    setLinkInput("");
    setProgress(null);
    setReuseMaterials(Array.isArray(draft.materials) ? draft.materials : []);
  }, [draft]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      setLoading(true);
      if (!all && targetIds.length === 0) {
        toast.error("Chọn ít nhất 1 học viên hoặc bật gửi tất cả");
        setLoading(false);
        return;
      }

      const html = (content || "").trim();
      if (!html) { setLoading(false); return; }

      if (reuseMode && draft?.sourceId) {
        const { data } = await api.post(`/announcements/${draft.sourceId}/repost`, {
          classroomIds: [classroomId],
          content: html,
          allStudents: all,
          userIds: all ? [] : targetIds,
          copyAttachments,
        });
        const created = Array.isArray(data?.created) ? data.created[0] : null;
        if (created && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("announcement:created", { detail: created }));
        }
        toast.success("Đã đăng thông báo");
        onClose();
        return;
      }

      const hasUploads = files.length > 0 || links.length > 0;

      let resp;
      if (hasUploads) {
        // multipart -> /announcements/with-materials
        const fd = new FormData();
        fd.append("ClassroomId", classroomId);
        fd.append("Content", html);
        fd.append("AllStudents", String(all));
        if (!all && targetIds.length) fd.append("UserIds", JSON.stringify(targetIds));
        files.forEach((f) => fd.append("Files", f));
        if (links.length) fd.append("Links", JSON.stringify(links));

        setProgress(0);
        resp = await api.post("/announcements/with-materials", fd, {
          onUploadProgress: (ev: ProgressEvent) => {
            if (!ev.total) return;
            const pct = Math.round((ev.loaded / ev.total) * 100);
            setProgress(pct);
          },
        } as any);
      } else {
        // simple JSON -> /announcements
        resp = await api.post("/announcements", {
          ClassroomId: classroomId,
          Content: html,
          AllStudents: all,
          UserIds: all ? [] : targetIds,
        });
      }

      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('announcement:created', { detail: resp.data }));
        }
      } catch {}
      toast.success("Đã đăng thông báo");
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Gửi thông báo thất bại");
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-3xl mx-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="mb-3">
          <div className="text-2xl font-bold text-gray-900">Thông báo</div>
          <p className="text-sm text-gray-600">Soạn và gửi thông báo quan trọng đến các thành viên trong lớp học.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={all}
              onChange={(e) => setAll(e.target.checked)}
            />
            Gửi tới tất cả học viên
          </label>
          {!all && (
            <div className="max-h-40 overflow-auto rounded-lg border border-gray-200 p-2 space-y-1 bg-gray-50">
              {members.length === 0 ? (
                <div className="text-sm text-gray-500">Đang tải danh sách học viên...</div>
              ) : (
                members.map((m) => (
                  <label key={m.userId} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={targetIds.includes(String(m.userId))}
                      onChange={(e) => {
                        const id = String(m.userId);
                        setTargetIds((prev) => (e.target.checked ? [...prev, id] : prev.filter((x) => x !== id)));
                      }}
                    />
                    <span className="truncate">{m.fullName}</span>
                  </label>
                ))
              )}
            </div>
          )}
          <RichTextEditor value={content} onChange={setContent} placeholder="Nhập nội dung thông báo..." disabled={loading} />
          <div className="space-y-2">
            {reuseMode ? (
              <div className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600">
                <div className="font-medium text-gray-800 mb-1">
                  {copyAttachments ? "Đính kèm sẽ được sao chép" : "Đính kèm từ thông báo gốc"}
                </div>
                {reuseMaterials.length === 0 ? (
                  <div>Không có tệp đính kèm.</div>
                ) : (
                  <ul className="space-y-1">
                    {reuseMaterials.map((m, i) => (
                      <li key={i} className="truncate">
                        <a href={m.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                          {m.name || m.url || "Tệp đính kèm"}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="text-xs text-gray-500 mt-2">
                  {copyAttachments ? "Các tệp sẽ được sao chép sang lớp hiện tại." : "Các tệp sẽ được dùng lại từ thông báo gốc."}
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-3 items-center">
                  <label
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${loading ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"}`}
                  >
                    <input
                      disabled={loading}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const list = Array.from(e.target.files || []);
                        setFiles((prev) => [...prev, ...list]);
                      }}
                    />
                    <Paperclip className="h-4 w-4 text-gray-600" />
                    Đính kèm tệp
                  </label>
                  <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                    <input
                      disabled={loading}
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      placeholder="Dán liên kết và nhấn Thêm"
                      className="rounded-full border px-4 py-1.5 text-sm w-full disabled:opacity-60"
                    />
                    <button
                      type="button"
                      disabled={loading}
                      className="rounded-full border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
                      onClick={() => {
                        if (linkInput.trim()) {
                          setLinks([...links, linkInput.trim()]);
                          setLinkInput("");
                        }
                      }}
                    >
                      Thêm
                    </button>
                  </div>
                </div>
                {(files.length > 0 || links.length > 0) && (
                  <div className="space-y-1 text-sm">
                    {files.map((f, i) => {
                      const ext = (f.name.split(".").pop() || "").toLowerCase();
                      const isImage = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext);
                      const icon =
                        isImage
                          ? "🖼️"
                          : ext === "pdf"
                          ? "📄"
                          : ["mp4", "mov", "webm", "mkv", "avi"].includes(ext)
                          ? "🎞️"
                          : ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)
                          ? "🎵"
                          : ["doc", "docx"].includes(ext)
                          ? "📝"
                          : ["xls", "xlsx"].includes(ext)
                          ? "📊"
                          : ["ppt", "pptx"].includes(ext)
                          ? "📈"
                          : ["zip", "rar", "7z"].includes(ext)
                          ? "🗜️"
                          : "📃";
                      return (
                        <div key={i} className="flex items-center justify-between rounded-xl border px-3 py-1 gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span>{icon}</span>
                            <span className="truncate">
                              {f.name} <span className="text-xs text-gray-500">({(f.size / 1024).toFixed(1)} KB)</span>
                            </span>
                          </div>
                          <button type="button" className="text-red-600 hover:underline" onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>
                            Xóa
                          </button>
                        </div>
                      );
                    })}
                    {links.map((u, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl border px-3 py-1 gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span>🔗</span>
                          <a href={u} target="_blank" rel="noreferrer" className="truncate text-indigo-600 hover:underline">
                            {u}
                          </a>
                        </div>
                        <button type="button" className="text-red-600 hover:underline" onClick={() => setLinks(links.filter((_, idx) => idx !== i))}>
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {progress !== null && (
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-2 bg-indigo-600" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="md" onClick={onClose} className="!rounded-full">
              Hủy
            </Button>
            <Button disabled={loading || !content.trim()} variant="primary" size="md" className="!rounded-full">
              Đăng
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
