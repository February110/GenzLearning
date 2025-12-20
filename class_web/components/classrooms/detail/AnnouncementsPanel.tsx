"use client";

import { useEffect, useState } from "react";
import api from "@/api/client";
import useClassroomRealtime from "@/hooks/useClassroomRealtime";
import { MoreHorizontal, ChevronDown, ChevronRight, Clock, Repeat2, Megaphone, ArrowLeft } from "lucide-react";
import RichTextEditor from "@/components/common/RichTextEditor";
import Button from "@/components/ui/Button";
import { toast } from "react-hot-toast";
import { resolveAvatar } from "@/utils/resolveAvatar";

type Item = {
  id: string;
  classroomId: string;
  content: string;
  isForAll: boolean;
  targetUserIds?: string[];
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  createdByAvatar?: string;
  materials?: any[];
};

type ClassOption = {
  id: string;
  name: string;
  teacherName?: string;
  createdAt?: string;
};

type ReuseDraft = {
  sourceId: string;
  content: string;
  materials?: any[];
  copyAttachments?: boolean;
};

export default function AnnouncementsPanel({
  classroomId,
  isTeacher,
  onReuse,
  onCreate,
}: {
  classroomId: string;
  isTeacher?: boolean;
  onReuse?: (draft: ReuseDraft) => void;
  onCreate?: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reuseOpen, setReuseOpen] = useState(false);
  const [reuseStep, setReuseStep] = useState<"class" | "announcement">("class");
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [classLoading, setClassLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassOption | null>(null);
  const [reuseAnnouncements, setReuseAnnouncements] = useState<Item[]>([]);
  const [selectedReuseAnnouncement, setSelectedReuseAnnouncement] = useState<Item | null>(null);
  const [reuseCopyAttachments, setReuseCopyAttachments] = useState(false);
  const [reuseLoading, setReuseLoading] = useState(false);

  async function load() {
    try {
      const { data } = await api.get(`/announcements/classroom/${classroomId}`);
      setItems(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { if (classroomId) load(); }, [classroomId]);

  useEffect(() => {
    if (!reuseOpen) return;
    setReuseStep("class");
    setSelectedClass(null);
    setReuseAnnouncements([]);
    setSelectedReuseAnnouncement(null);
    setReuseCopyAttachments(false);
    (async () => {
      try {
        setClassLoading(true);
        const { data } = await api.get("/classrooms");
        const list = Array.isArray(data) ? data : [];
        const options = list
          .map((c: any) => ({
            id: String(c.classroomId || c.ClassroomId || c.id || c.Id || ""),
            name: c.name || c.Name || "",
            role: (c.role || c.Role || "").toString().toLowerCase(),
            teacherName:
              c.teacherName ||
              c.TeacherName ||
              c.ownerName ||
              c.OwnerName ||
              c.teacher?.fullName ||
              c.Teacher?.FullName ||
              "",
            createdAt: c.createdAt || c.CreatedAt || "",
          }))
          .filter((c: any) => c.id && c.role === "teacher")
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            teacherName: c.teacherName,
            createdAt: c.createdAt,
          }));
        setClassOptions(options);
      } catch {
        setClassOptions([]);
      } finally {
        setClassLoading(false);
      }
    })();
  }, [reuseOpen]);

  // Optimistic local update when this browser creates an announcement
  useEffect(() => {
    const onLocal = (e: any) => {
      const a = e?.detail as Item | undefined;
      if (!a) return;
      if (String(a.classroomId) !== String(classroomId)) return;
      setItems((prev) => {
        if (prev.some((x) => x.id === a.id)) return prev;
        return [a, ...prev];
      });
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('announcement:created', onLocal as any);
    }
    return () => { if (typeof window !== 'undefined') window.removeEventListener('announcement:created', onLocal as any); };
  }, [classroomId]);

  // Realtime via shared hook
  useClassroomRealtime(classroomId, {
    onAnnouncementAdded: (a) => setItems((prev) => {
      const incoming = a as Item;
      const without = prev.filter((x) => x.id !== incoming.id);
      return [incoming, ...without];
    }),
    onAnnouncementUpdated: (a) => setItems((prev) => prev.map((x) => (x.id === (a as any).id ? { ...x, content: (a as any).content, isForAll: (a as any).isForAll, targetUserIds: (a as any).targetUserIds } : x))),
    onAnnouncementDeleted: (a) => setItems((prev) => prev.filter((x) => x.id !== (a as any).id)),
    onAnnouncementCommentAdded: (c) => {
      // Bubble event for the specific comment box if needed
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('announcement:comment-added', { detail: c }));
    }
  });

  async function loadReuseAnnouncements(cls: ClassOption) {
    try {
      setReuseLoading(true);
      const { data } = await api.get(`/announcements/classroom/${cls.id}`);
      setReuseAnnouncements(Array.isArray(data) ? data : []);
    } catch {
      setReuseAnnouncements([]);
    } finally {
      setReuseLoading(false);
    }
  }

  async function handleSelectClass(cls: ClassOption) {
    setSelectedClass(cls);
    setReuseStep("announcement");
    setSelectedReuseAnnouncement(null);
    await loadReuseAnnouncements(cls);
  }

  function handleSelectAnnouncement(a: Item) {
    setSelectedReuseAnnouncement((prev) => (prev?.id === a.id ? null : a));
  }

  function handleUseSelectedAnnouncement() {
    if (!selectedReuseAnnouncement) return;
    if (onReuse) {
      onReuse({
        sourceId: selectedReuseAnnouncement.id,
        content: selectedReuseAnnouncement.content,
        materials: (selectedReuseAnnouncement as any).materials,
        copyAttachments: reuseCopyAttachments,
      });
    }
    setReuseOpen(false);
  }

  if (loading) return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-6">Đang tải thông báo...</div>
  );

  return (
    <>
    <div className="p-0">
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-semibold">Thông báo</div>
        {isTeacher && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onCreate?.()}
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 text-white px-4 py-2 text-sm hover:bg-indigo-700"
            >
              <Megaphone className="h-4 w-4" />
              Thông báo mới
            </button>
            <button
              type="button"
              onClick={() => setReuseOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              <Repeat2 className="h-4 w-4" />
              Đăng lại
            </button>
          </div>
        )}
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">Chưa có thông báo nào.</div>
      ) : (
        <ul className="space-y-4">
          {items.map((a) => (
            <li
              key={a.id}
              className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition p-4"
            >
              <div className="flex items-start gap-3">
                {a.createdByAvatar ? (
                  <img
                    src={resolveAvatar(a.createdByAvatar) || a.createdByAvatar}
                    alt={a.createdByName || "Giáo viên"}
                    className="h-10 w-10 shrink-0 rounded-full object-cover border border-white/60 shadow"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-semibold shadow">
                    {getInitials(a.createdByName || "G V")}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{a.createdByName || "Giáo viên"}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {new Date(a.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {isTeacher && (
                    <details className="relative">
                      <summary className="list-none p-1.5 rounded hover:bg-gray-100 text-gray-500 cursor-pointer">
                        <MoreHorizontal className="w-4 h-4" />
                      </summary>
                      <div className="absolute right-0 mt-1 w-40 rounded-md border bg-white shadow p-1 z-10">
                        <button onClick={() => setEditing({ id: a.id, content: a.content })} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100">Chỉnh sửa</button>
                        <button onClick={() => handleDelete(a.id)} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 text-red-600">Xóa</button>
                      </div>
                    </details>
                  )}
                  </div>
                  <div className="prose prose-sm max-w-none dark:prose-invert mt-2" dangerouslySetInnerHTML={{ __html: a.content }} />

                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                      {!a.isForAll && a.targetUserIds && a.targetUserIds.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100">Chỉ định: {a.targetUserIds.length} học viên</span>
                      )}
                    </div>

                  <div className="mt-2">
                    <AnnouncementFiles announcementId={a.id} initialItems={(a as any).materials} />
                  </div>

                  <AnnouncementComments announcementId={a.id} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
    {editing && (
      <EditAnnouncementModal
        content={editing.content}
        onClose={() => setEditing(null)}
        onSave={async (html) => {
          try {
            await api.put(`/announcements/${editing.id}`, { content: html });
            setItems((prev) => prev.map((x) => (x.id === editing.id ? { ...x, content: html } : x)));
            setEditing(null);
            toast.success("Đã cập nhật thông báo");
          } catch (e: any) {
            toast.error(e?.response?.data?.message || "Cập nhật thất bại");
          }
        }}
      />
    )}
    {reuseOpen && (
      <ReuseAnnouncementModal
        step={reuseStep}
        classOptions={classOptions}
        classLoading={classLoading}
        selectedClass={selectedClass}
        announcements={reuseAnnouncements}
        announcementsLoading={reuseLoading}
        selectedAnnouncementId={selectedReuseAnnouncement?.id || null}
        copyAttachments={reuseCopyAttachments}
        onSelectClass={handleSelectClass}
        onSelectAnnouncement={handleSelectAnnouncement}
        onToggleCopyAttachments={setReuseCopyAttachments}
        onUse={handleUseSelectedAnnouncement}
        onBack={() => {
          setReuseStep("class");
          setSelectedReuseAnnouncement(null);
        }}
        onClose={() => setReuseOpen(false)}
      />
    )}
  </>
  );
}

function AnnouncementFiles({ announcementId, initialItems }: { announcementId: string; initialItems?: any[] }) {
  const [items, setItems] = useState<any[] | null>(initialItems ?? null);
  useEffect(() => {
    if (initialItems && Array.isArray(initialItems)) return; // đã có sẵn từ realtime payload
    (async () => {
      try {
        const { data } = await api.get(`/announcements/${announcementId}/materials`);
        setItems(Array.isArray(data) ? data : []);
      } catch { setItems([]); }
    })();
  }, [announcementId, initialItems]);
  if (items === null) return <div className="text-sm text-gray-500 dark:text-gray-400 p-2">Đang tải...</div>;
  if (items.length === 0) return <div className="text-sm text-gray-500 dark:text-gray-400 p-2">Không có tệp đính kèm.</div>;
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {items.map((it, i) => (
        <AttachmentChip key={i} url={it.url} name={it.name} />
      ))}
    </div>
  );
}

function extFrom(urlOrName: string): string {
  try {
    const clean = (urlOrName || "").split("?")[0].split("#")[0];
    const idx = clean.lastIndexOf(".");
    return idx >= 0 ? clean.substring(idx + 1).toLowerCase() : "";
  } catch { return ""; }
}

function detectType(url?: string, name?: string): string {
  const ext = extFrom(name || url || "");
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
  if (["mp4", "mov", "webm", "mkv", "avi"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (["xls", "xlsx"].includes(ext)) return "xls";
  if (["ppt", "pptx"].includes(ext)) return "ppt";
  if (["zip", "rar", "7z"].includes(ext)) return "zip";
  if (["txt", "md", "csv", "json"].includes(ext)) return "text";
  if (!ext && url && /^https?:\/\//i.test(url)) return "link";
  return ext ? "file" : "link";
}

function FileRow({ url, name }: { url?: string; name?: string }) {
  const t = detectType(url, name);
  const label = name || url || "Tệp";
  const icon = (
    t === "image" ? "🖼️" :
    t === "video" ? "🎞️" :
    t === "audio" ? "🎵" :
    t === "pdf" ? "📄" :
    t === "doc" ? "📝" :
    t === "xls" ? "📊" :
    t === "ppt" ? "📈" :
    t === "zip" ? "🗜️" :
    t === "text" ? "📃" :
    "🔗"
  );

  if (t === "image" && url) {
    return (
      <li className="flex items-center gap-3">
        <img src={url} alt={label} className="h-12 w-16 object-cover rounded border border-gray-200 dark:border-gray-800" />
        <a href={url} target="_blank" className="text-indigo-600 hover:underline truncate">{label}</a>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 text-sm">
      <span>{icon}</span>
      {url ? (
        <a href={url} target="_blank" className="text-indigo-600 hover:underline truncate">{label}</a>
      ) : (
        <span className="text-gray-700 dark:text-gray-300 truncate">{label}</span>
      )}
      <span className="ml-2 text-xs text-gray-500">{t.toUpperCase()}</span>
    </li>
  );
}

function AttachmentChip({ url, name }: { url?: string; name?: string }) {
  const t = detectType(url, name);
  const label = name || url || "Tệp";
  const isImg = t === "image" && !!url;
  return (
    <a
      href={url || "#"}
      target={url ? "_blank" : undefined}
      className="group inline-flex items-center gap-2 max-w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-2 py-1 hover:bg-gray-50 dark:hover:bg-zinc-800"
    >
      {isImg ? (
        <img src={url} alt={label} className="h-8 w-10 object-cover rounded" />
      ) : (
        <span className="text-sm">{t === "pdf" ? "📄" : t === "video" ? "🎞️" : t === "audio" ? "🎵" : t === "doc" ? "📝" : t === "xls" ? "📊" : t === "ppt" ? "📈" : t === "zip" ? "🗜️" : t === "text" ? "📃" : "🔗"}</span>
      )}
      <span className="truncate text-sm text-indigo-700 dark:text-indigo-300 group-hover:underline">{label}</span>
    </a>
  );
}

function getInitials(name: string): string {
  try {
    return (name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase();
  } catch { return "?"; }
}

function EditAnnouncementModal({ content, onClose, onSave }: { content: string; onClose: () => void; onSave: (html: string) => void }) {
  const [val, setVal] = useState(content);
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl mx-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-5">
        <div className="text-lg font-semibold mb-2">Chỉnh sửa thông báo</div>
        <div className="space-y-3">
          <RichTextEditor value={val} onChange={setVal} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Hủy</Button>
            <Button variant="primary" disabled={saving || !val.trim()} onClick={async () => { setSaving(true); await onSave(val.trim()); setSaving(false); }}>Lưu</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReuseAnnouncementModal({
  step,
  classOptions,
  classLoading,
  selectedClass,
  announcements,
  announcementsLoading,
  selectedAnnouncementId,
  copyAttachments,
  onSelectClass,
  onSelectAnnouncement,
  onToggleCopyAttachments,
  onUse,
  onBack,
  onClose,
}: {
  step: "class" | "announcement";
  classOptions: ClassOption[];
  classLoading: boolean;
  selectedClass: ClassOption | null;
  announcements: Item[];
  announcementsLoading: boolean;
  selectedAnnouncementId: string | null;
  copyAttachments: boolean;
  onSelectClass: (cls: ClassOption) => void;
  onSelectAnnouncement: (a: Item) => void;
  onToggleCopyAttachments: (value: boolean) => void;
  onUse: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl mx-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-zinc-900 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            {step === "announcement" && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
                title="Chọn lớp khác"
              >
                <ArrowLeft className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </button>
            )}
            <div>
              <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {step === "class" ? "Chọn lớp" : `Chọn bài đăng (${selectedClass?.name || "Lớp học"})`}
              </div>
              {step === "class" && (
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Sử dụng lại các bài đăng trong lớp học bạn giảng dạy.
                </div>
              )}
            </div>
          </div>
          <button type="button" className="text-gray-500 hover:text-gray-700" onClick={onClose}>X</button>
        </div>

        {step === "class" && (
          <div className="p-4">
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-zinc-900">
              <div className="grid grid-cols-[1.6fr_1fr_0.9fr] gap-2 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-gray-700">
                <div>Lớp học</div>
                <div>Giáo viên</div>
                <div>Ngày tạo</div>
              </div>
              <div className="max-h-80 overflow-auto">
                {classLoading ? (
                  <div className="text-sm text-gray-500 p-3">Đang tải lớp...</div>
                ) : classOptions.length === 0 ? (
                  <div className="text-sm text-gray-500 p-3">Không có lớp để chọn.</div>
                ) : (
                  classOptions.map((c) => {
                    const teacherName = c.teacherName || "Giáo viên";
                    const dateLabel = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "-";
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onSelectClass(c)}
                        className="w-full text-left grid grid-cols-[1.6fr_1fr_0.9fr] items-center gap-2 px-3 py-2 text-sm border-b border-gray-100 dark:border-gray-800 hover:bg-gray-100/70 dark:hover:bg-zinc-800/60"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-semibold">
                            {getInitials(c.name || "L")}
                          </div>
                          <span className="truncate font-medium text-gray-800 dark:text-gray-100">{c.name}</span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 truncate">{teacherName}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{dateLabel}</div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {step === "announcement" && (
          <>
            <div className="p-4">
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-zinc-900">
                <div className="overflow-x-auto">
                  <div className="min-w-[640px]">
                    <div className="grid grid-cols-[32px_1.4fr_1fr_0.9fr] gap-2 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-gray-700">
                      <div />
                      <div>Tiêu đề</div>
                      <div>Giáo viên</div>
                      <div>Ngày đăng</div>
                    </div>
                    <div className="max-h-[320px] min-h-[240px] overflow-y-auto">
                      {announcementsLoading ? (
                        <div className="text-sm text-gray-500 p-3">Đang tải thông báo...</div>
                      ) : announcements.length === 0 ? (
                        <div className="text-sm text-gray-500 p-3">Lớp này chưa có thông báo.</div>
                      ) : (
                        announcements.map((a) => {
                          const preview = (a.content || "")
                            .replace(/<[^>]+>/g, " ")
                            .replace(/\s+/g, " ")
                            .trim();
                          const selected = selectedAnnouncementId === a.id;
                          const dateLabel = a.createdAt ? new Date(a.createdAt).toLocaleString() : "Bản nháp";
                          const avatarUrl = a.createdByAvatar ? resolveAvatar(a.createdByAvatar) || a.createdByAvatar : undefined;
                          return (
                            <label
                              key={a.id}
                              className={`grid grid-cols-[32px_1.4fr_1fr_0.9fr] items-center gap-2 px-3 py-2 text-sm border-b border-gray-100 dark:border-gray-800 cursor-pointer ${selected ? "bg-gray-200/70 dark:bg-zinc-800/80" : "hover:bg-gray-100/70 dark:hover:bg-zinc-800/60"}`}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                checked={selected}
                                onChange={() => onSelectAnnouncement(a)}
                              />
                              <div className="text-gray-800 dark:text-gray-100 truncate font-medium">
                                {preview || "Thông báo (không có nội dung)"}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 min-w-0">
                                {avatarUrl ? (
                                  <img
                                    src={avatarUrl}
                                    alt={a.createdByName || "Giáo viên"}
                                    className="h-6 w-6 rounded-full object-cover border border-white/60"
                                  />
                                ) : (
                                  <div className="h-6 w-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-semibold">
                                    {getInitials(a.createdByName || "G V")}
                                  </div>
                                )}
                                <span className="truncate">{a.createdByName || "Giáo viên"}</span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{dateLabel}</div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-zinc-900 px-3 py-2">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={copyAttachments}
                    onChange={(e) => onToggleCopyAttachments(e.target.checked)}
                  />
                  Tạo bản sao mới cho tất cả các tệp đính kèm
                </label>
                <button
                  type="button"
                  className="text-sm font-medium text-indigo-600 hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={!selectedAnnouncementId}
                  onClick={onUse}
                >
                  Sử dụng lại
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

async function handleDelete(id: string) {
  if (!confirm("Bạn có chắc muốn xóa thông báo này?")) return;
  try {
    await api.delete(`/announcements/${id}`);
    window.dispatchEvent(new CustomEvent('announcement:deleted', { detail: { id } }));
    toast.success("Đã xóa thông báo");
  } catch (e: any) {
    toast.error(e?.response?.data?.message || "Xóa thất bại");
  }
}

function AnnouncementComments({ announcementId }: { announcementId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!loaded) {
      (async () => {
        try {
          const { data } = await api.get(`/announcements/${announcementId}/comments`);
          setItems(Array.isArray(data) ? data : []);
        } catch {}
        setLoaded(true);
      })();
    }
  }, [announcementId, loaded]);

  useEffect(() => {
    const onAdded = (e: any) => {
      const c = e?.detail; if (!c) return;
      if (String(c.announcementId) !== String(announcementId)) return;
      setItems((prev) => {
        const map = new Map<string, any>();
        [...prev, c].forEach((x: any) => map.set(String(x.id), x));
        const next = Array.from(map.values());
        next.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return next;
      });
    };
    if (typeof window !== 'undefined') window.addEventListener('announcement:comment-added', onAdded as any);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('announcement:comment-added', onAdded as any); };
  }, [announcementId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim(); if (!content) return;
    try {
      setSending(true);
      const me = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
      const optimistic = {
        id: `local-${Date.now()}`,
        announcementId,
        userId: me.id || 'me',
        userName: me.fullName || 'Tôi',
        userAvatar: me.avatar,
        content,
        createdAt: new Date().toISOString()
      };
      setItems((prev) => [...prev, optimistic]); setText("");
      const { data } = await api.post(`/announcements/${announcementId}/comments`, { content });
      setItems((prev) => {
        const replaced = prev.map((x) => (x.id === optimistic.id ? data : x));
        // de-dupe in case realtime also arrived
        const map = new Map<string, any>();
        replaced.forEach((x: any) => map.set(String(x.id), x));
        return Array.from(map.values());
      });
    } catch {}
    finally { setSending(false); }
  };

  const displayItems = expanded ? items : items.slice(Math.max(0, items.length - 3));

  return (
    <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-2">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span>Nhận xét ({items.length})</span>
      </button>

      <div className={`${expanded ? 'max-h-64 overflow-y-auto pr-1' : ''} mt-2 space-y-2`}>
        {displayItems.map((c, i) => {
          const avatarUrl = c.userAvatar ? resolveAvatar(c.userAvatar) || c.userAvatar : undefined;
          return (
          <div key={`${c.id || 'local'}-${i}`} className="flex items-start gap-2 text-sm">
            {avatarUrl ? (
              <img src={avatarUrl} alt={c.userName || "U"} className="h-7 w-7 shrink-0 rounded-full object-cover border border-white/30" />
            ) : (
              <div className="h-7 w-7 shrink-0 rounded-full bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 flex items-center justify-center text-[11px] font-semibold">
                {getInitials(c.userName || 'U')}
              </div>
            )}
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-0.5">{c.userName} • {new Date(c.createdAt).toLocaleString()}</div>
              <div>{c.content}</div>
            </div>
          </div>
        )})}
        {items.length > displayItems.length && !expanded && (
          <button type="button" onClick={() => setExpanded(true)} className="text-xs text-indigo-600 hover:underline">
            Xem thêm {items.length - displayItems.length} nhận xét
          </button>
        )}
        {items.length === 0 && <div className="text-xs text-gray-500 dark:text-gray-400">Chưa có nhận xét nào.</div>}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 mt-2">
        <input
          value={text}
          onChange={(e)=>setText(e.target.value)}
          placeholder="Thêm nhận xét..."
          className="flex-1 rounded-full border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100"
        />
        <Button variant="primary" size="sm" disabled={sending || !text.trim()}>Gửi</Button>
      </form>
    </div>
  );
}
