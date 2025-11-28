"use client";
import api from "@/api/client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

  const filtered = useMemo(() => {
    let list = items.slice().sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    const hasScore = (s: Submission) => {
      const val = (s as any).grade ?? (s as any).Grade;
      return val !== undefined && val !== null;
    };
    if (filter === "graded") list = list.filter((s) => hasScore(s));
    if (filter === "pending") list = list.filter((s) => !hasScore(s));
    return list;
  }, [items, filter]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Bài đã nộp</h1>
        <div className="text-sm text-gray-500">Theo dõi các bài bạn đã nộp và điểm số</div>
      </div>

      <div className="flex items-center gap-2">
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
