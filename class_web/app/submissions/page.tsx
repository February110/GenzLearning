"use client";
import api from "@/api/client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSignalR } from "@/lib/signalr";

type Submission = {
  id: string;
  assignmentId: string;
  fileKey: string;
  fileSize: number;
  submittedAt: string;
  grade?: number | null;
  feedback?: string | null;
  gradeStatus?: string | null;
};

export default function MySubmissionsPage() {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "graded" | "pending">("all");
  const [query, setQuery] = useState("");
  const [titles, setTitles] = useState<Record<string, { title: string; classroom?: string }>>({});

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/submissions/my");
      const list: Submission[] = data || [];
      setItems(list);
      // Fetch assignment titles in parallel
      const uniqueIds = Array.from(new Set(list.map((s) => s.assignmentId)));
      const map: Record<string, { title: string; classroom?: string }> = {};
      await Promise.all(
        uniqueIds.map(async (id) => {
          try {
            const { data } = await api.get(`/assignments/${id}`);
            map[id] = { title: data?.title || `Bài tập ${id}`, classroom: data?.classroomName || "" };
          } catch {
            map[id] = { title: `Bài tập ${id}` };
          }
        })
      );
      setTitles(map);
    } finally {
      setLoading(false);
    }
  }
  async function getUrl(key: string) {
    const { data } = await api.get(`/submissions/public-url`, { params: { key } });
    window.open(data.url, "_blank");
  }

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token");
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5081/api";
    const hubBase = base.replace(/\/api$/, "");
    const conn = getSignalR(hubBase, "/hubs/notifications");
    const handler = (payload: any) => {
      const aid = payload?.assignmentId ?? payload?.AssignmentId;
      if (!aid) return;
      const grade = payload?.grade ?? payload?.Grade ?? payload?.score ?? payload?.Score ?? null;
      const gradeStatus = payload?.gradeStatus ?? payload?.GradeStatus ?? payload?.status ?? payload?.Status ?? null;
      const feedback = payload?.feedback ?? payload?.Feedback ?? null;
      const updatedAt = payload?.updatedAt ?? payload?.UpdatedAt ?? null;
      setItems((prev) =>
        prev.map((s: any) => {
          const sAid = s.assignmentId ?? s.AssignmentId;
          if (String(sAid).toLowerCase() !== String(aid).toLowerCase()) return s;
          return {
            ...s,
            grade: grade ?? s.grade,
            gradeStatus: gradeStatus ?? s.gradeStatus,
            feedback: feedback ?? s.feedback,
            gradeUpdatedAt: updatedAt ?? s.gradeUpdatedAt,
          };
        })
      );
    };
    try { (conn as any).off?.("GradeUpdated", handler as any); } catch {}
    conn.on("GradeUpdated", handler);
    const ensure = async () => {
      try { await conn.start().catch(() => {}); } catch {}
    };
    ensure();
    (conn as any).onreconnected?.(() => ensure());
    return () => {
      try { (conn as any).off?.("GradeUpdated", handler as any); } catch {}
    };
  }, []);

  const filtered = useMemo(() => {
    let list = items.slice().sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    const hasScore = (s: Submission) => {
      const val = (s as any).grade ?? (s as any).Grade;
      return val !== undefined && val !== null;
    };
    if (filter === "graded") list = list.filter((s) => hasScore(s));
    if (filter === "pending") list = list.filter((s) => !hasScore(s));
    const key = query.trim().toLowerCase();
    if (key) {
      list = list.filter((s) => {
        const meta = titles[s.assignmentId];
        const title = (meta?.title || "").toLowerCase();
        const classroom = (meta?.classroom || "").toLowerCase();
        return title.includes(key) || classroom.includes(key) || s.assignmentId.toLowerCase().includes(key);
      });
    }
    return list;
  }, [items, filter, query, titles]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Bài đã nộp</h1>
        <div className="text-sm text-gray-500">Theo dõi các bài bạn đã nộp và điểm số</div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên bài hoặc lớp"
          className="w-64 rounded-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 px-4 py-2 text-sm outline-none focus:border-gray-300"
        />
        <button onClick={() => setFilter("all")} className={`px-3 py-1.5 rounded-full text-xs border ${filter === "all" ? "bg-gray-900 text-white border-transparent dark:bg-gray-100 dark:text-black" : "border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>Tất cả</button>
        <button onClick={() => setFilter("pending")} className={`px-3 py-1.5 rounded-full text-xs border ${filter === "pending" ? "bg-amber-500 text-white border-transparent" : "border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>Chưa chấm</button>
        <button onClick={() => setFilter("graded")} className={`px-3 py-1.5 rounded-full text-xs border ${filter === "graded" ? "bg-emerald-600 text-white border-transparent" : "border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>Đã chấm</button>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900">
        {loading ? (
          <div className="p-4 grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-md bg-gray-100 dark:bg-zinc-800" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-gray-500">Chưa nộp bài nào.</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((s) => {
              const t = titles[s.assignmentId];
              const grade = (s as any).grade ?? (s as any).Grade;
              const status = (s as any).gradeStatus ?? (s as any).GradeStatus ?? "";
              const statusLabel = grade != null ? `Điểm: ${grade}` : (status === "pending" ? "Đang chấm" : "Chưa chấm");
              const classroom = t?.classroom || "";
              return (
                <div key={s.id} className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/assignments/${s.assignmentId}`} className="font-medium hover:underline truncate block">
                      {t?.title || `Bài tập ${s.assignmentId}`}
                    </Link>
                    <div className="text-xs text-gray-500 truncate">{classroom}</div>
                    <div className="text-xs text-gray-500">Nộp lúc: {new Date(s.submittedAt).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-md text-xs ${grade != null ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"}`}>
                      {statusLabel}
                    </span>
                    <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => getUrl(s.fileKey)}>Tải / Xem</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
