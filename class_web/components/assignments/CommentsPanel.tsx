"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/api/client";
import useAssignmentThreadRealtime from "@/hooks/useAssignmentThreadRealtime";
import { resolveAvatar } from "@/utils/resolveAvatar";

export default function CommentsPanel({ assignmentId, studentId }: { assignmentId: string; studentId?: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [me, setMe] = useState<any>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Resolve current student id for the thread (teacher passes prop; student derives from local storage)
  const usedStudentId = (studentId ?? (me?.id || me?.userId || me?.Id)) as string | undefined;
  const threadRef = useRef<string | undefined>(usedStudentId);
  useEffect(() => { threadRef.current = usedStudentId; }, [usedStudentId]);
  const groupRef = useRef<string | null>(null);


  async function load() {
    try {
      const sid = usedStudentId;
      const { data } = await api.get(`/comments/assignment/${assignmentId}`, { params: sid ? { studentId: sid } : undefined as any });
      const list = Array.isArray(data) ? data : [];
      const unique = Array.from(new Map(list.map((it: any) => [it.id, it])).values());
      unique.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setItems(unique);
    } catch {}
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    try {
      setSending(true);
      const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
      const sid = usedStudentId;
      const optimistic = {
        id: `local-${Date.now()}`,
        assignmentId,
        userId: user.id || user.userId || user.Id || "me",
        userName: user.fullName || "Tôi",
        content,
        createdAt: new Date().toISOString(),
        role: user.role || user.userRole || undefined,
        targetUserId: sid,
      } as any;
      setItems((p) => [...p, optimistic]);
      setText("");
      const { data } = await api.post(`/comments`, { assignmentId, content, studentId: sid });
      setItems((p) => {
        const filtered = p.filter((c: any) => c.id !== optimistic.id && c.id !== data.id);
        return [...filtered, data];
      });
    } catch {
      setItems((p) => p.filter((c: any) => !String(c.id).startsWith("local-")));
    } finally {
      setSending(false);
    }
  }

  // Hydrate current user (student) to ensure id is available
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      setMe(u);
      if (!u?.id && !u?.userId && !u?.Id) {
        (async () => {
          try {
            const { data } = await api.get("/users/me");
            const merged = {
              ...u,
              id: data?.id || data?.Id,
              fullName: u?.fullName || data?.fullName,
              email: u?.email || data?.email,
              avatar: data?.avatar ? resolveAvatar(data.avatar) || data.avatar : u?.avatar,
            };
            localStorage.setItem("user", JSON.stringify(merged));
            setMe(merged);
          } catch {}
        })();
      }
    } catch {}
  }, []);

  // Load history whenever thread changes
  useEffect(() => {
    setItems([]);
    load();
  }, [assignmentId, usedStudentId]);

  // Attach realtime via hook
  useAssignmentThreadRealtime(assignmentId, usedStudentId, (c: any) => {
    if (String(c?.assignmentId).toLowerCase() !== String(assignmentId).toLowerCase()) return;
    let sid: any = threadRef.current;
    if (!sid) sid = me?.id || (me as any)?.userId || (me as any)?.Id;
    if (!sid && typeof window !== "undefined") {
      try {
        const u = JSON.parse(localStorage.getItem("user") || "{}");
        sid = u.id || u.userId || u.Id;
      } catch {}
    }
    if (!sid) return;
    const sidLc = String(sid).toLowerCase();
    const tgtLc = String(c?.targetUserId || "").toLowerCase();
    if (tgtLc !== sidLc) return;
    setItems((p) => [...p.filter((x: any) => x.id !== c.id), c]);
  });

  // Group membership managed inside hook, keep a mirror key for UI if needed
  useEffect(() => {
    const sid = threadRef.current; if (!sid) return;
    groupRef.current = `${String(assignmentId).toLowerCase()}:${String(sid).toLowerCase()}`;
  }, [assignmentId, usedStudentId]);

  // Always keep scrolled to bottom
  useEffect(() => {
    const el = listRef.current; if (!el) return; el.scrollTop = el.scrollHeight;
  }, [items]);

  return (
    <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-6">
      <div className="text-lg font-semibold mb-3">Trao đổi</div>
      <div ref={listRef} className="max-h-64 overflow-y-auto space-y-3 pr-1 pb-2">
        {items.map((c: any) => {
          const name = c.userName || "Người dùng";
          const isMine = me && (String(c.userId) === String(me.id) || name === me.fullName || String(c.userId) === "me");
          const roleRaw = c.userRole || c.role || c.userType;
          const roleLower = typeof roleRaw === "string" ? roleRaw.toLowerCase() : "";
          const isTeacher = !!(c.isTeacher || roleLower.includes("teacher") || roleLower.includes("giáo") || roleLower.includes("gv"));
          const initials = (name || "?").trim().split(/\s+/).slice(0, 2).map((s: string) => s[0]).join("").toUpperCase();
          return (
            <div key={c.id} className={`flex items-start gap-3 ${isMine ? "justify-end" : ""}`}>
              {!isMine && (
                <div className="h-8 w-8 shrink-0 rounded-full bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 flex items-center justify-center text-xs font-semibold">
                  {initials}
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${isMine ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-gray-100"}`}>
                <div className={`mb-1 flex items-center gap-2 text-[11px] ${isMine ? "text-indigo-100/90" : "text-gray-500"}`}>
                  <span className="font-medium">{isMine ? "Bạn" : name}</span>
                  {isTeacher && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isMine ? "bg-indigo-500/70 text-white" : "bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-200"}`}>Giáo viên</span>
                  )}
                  <span>• {new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <div>{c.content}</div>
              </div>
              {isMine && (
                <div className="h-8 w-8 shrink-0 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200 flex items-center justify-center text-xs font-semibold">
                  {(me?.fullName || "B").trim().charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          );
        })}
        {items.length === 0 && <div className="text-sm text-gray-500">Chưa có trao đổi nào.</div>}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 mt-3">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Thêm tin nhắn riêng tư..." className="flex-1 rounded-full border px-4 py-2 text-sm bg-white dark:bg-zinc-950" />
        <button disabled={sending || !text.trim()} className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm disabled:opacity-60">Gửi</button>
      </form>
    </div>
  );
}
