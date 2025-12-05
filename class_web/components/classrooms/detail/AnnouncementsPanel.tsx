"use client";

import { useEffect, useState } from "react";
import api from "@/api/client";
import useClassroomRealtime from "@/hooks/useClassroomRealtime";
import Card from "@/components/ui/Card";
import { Paperclip, MoreHorizontal, ChevronDown, ChevronRight, Clock, Send } from "lucide-react";
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

export default function AnnouncementsPanel({ classroomId, isTeacher }: { classroomId: string; isTeacher?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const { data } = await api.get(`/announcements/classroom/${classroomId}`);
      setItems(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { if (classroomId) load(); }, [classroomId]);

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

  if (loading) return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-6">Đang tải thông báo...</div>
  );

  return (
    <>
    <div className="p-0">
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-semibold">Thông báo</div>
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
