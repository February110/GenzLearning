"use client";

import api from "@/api/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

type ClassRow = { id: string; name: string; teacherName: string };
type Assignment = { id: string; title: string };
type Submission = { id: string; studentName: string; email: string; fileSize: number; submittedAt: string; grade?: number; feedback?: string };

export default function AdminSubmissionsPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentId, setAssignmentId] = useState<string>("");
  const [items, setItems] = useState<Submission[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [grading, setGrading] = useState<Submission | null>(null);
  const [gradeForm, setGradeForm] = useState({ score: "", feedback: "" });

  async function loadClasses() {
    const { data } = await api.get("/admin/classes");
    setClasses(data);
    if (data.length && !classId) setClassId(data[0].id);
  }

  async function loadAssignmentsByClass(cid: string) {
    if (!cid) {
      setAssignments([]);
      setAssignmentId("");
      setItems([]);
      return;
    }
    try {
      const { data } = await api.get(`/admin/classes/${cid}/assignments`);
      setAssignments(data);
      setAssignmentId(data.length ? data[0].id : "");
      setItems([]);
    } catch (err: any) {
      toast.error(err?.response?.data || "Không thể tải bài tập");
    }
  }

  async function loadSubs(aid: string) {
    if (!aid) return setItems([]);
    const { data } = await api.get(`/submissions/by-assignment/${aid}`);
    setItems(data);
  }

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    loadAssignmentsByClass(classId);
  }, [classId]);

  useEffect(() => {
    loadSubs(assignmentId);
  }, [assignmentId]);

  const currentClass = useMemo(() => classes.find((c) => c.id === classId), [classes, classId]);
  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    return items.filter((s) => {
      const studentName = ((s as any).studentName ?? (s as any).StudentName ?? "").toString().toLowerCase();
      const email = ((s as any).email ?? (s as any).Email ?? "").toString().toLowerCase();
      if (key && !(studentName.includes(key) || email.includes(key))) return false;
      if (statusFilter === "all") return true;
      const gradeDetail: any = (s as any).gradeDetail || (s as any).GradeDetail || null;
      const score = (s as any).grade ?? (s as any).Grade ?? gradeDetail?.score ?? gradeDetail?.Score ?? null;
      const status = (s as any).gradeStatus ?? (s as any).GradeStatus ?? gradeDetail?.status ?? gradeDetail?.Status ?? null;
      const bucket = score != null ? "graded" : status === "pending" ? "pending" : "ungraded";
      return bucket === statusFilter;
    });
  }, [items, q, statusFilter]);

  function startGrade(sub: Submission) {
    setGrading(sub);
    setGradeForm({
      score: sub.grade != null ? String(sub.grade) : "",
      feedback: (sub as any).feedback || "",
    });
  }

  async function saveGrade(e: React.FormEvent) {
    e.preventDefault();
    if (!grading) return;
    const score = Number(gradeForm.score);
    if (isNaN(score)) {
      toast.error("Điểm không hợp lệ");
      return;
    }
    try {
      await api.put(`/grades/${grading.id}`, { grade: score, feedback: gradeForm.feedback || undefined, status: "graded" });
      toast.success("Đã cập nhật điểm");
      setGrading(null);
      loadSubs(assignmentId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Chấm điểm thất bại");
    }
  }

  async function download(id: string) {
    const { data } = await api.get(`/submissions/${id}/download`);
    window.open(data.downloadUrl, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Bài nộp</h1>
          {currentClass && assignments.length > 0 && (
            <p className="text-sm text-slate-500">
              Lớp: {currentClass.name} • Giáo viên: {currentClass.teacherName}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            placeholder="Tìm học viên..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-56 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-2 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="graded">Đã chấm</option>
            <option value="pending">Đang chấm</option>
            <option value="ungraded">Chưa chấm</option>
          </select>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/60">
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)} className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/60">
            {assignments.length === 0 ? (
              <option value="">-- Không có bài tập --</option>
            ) : (
              assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
            <thead className="bg-slate-50/70 dark:bg-slate-900/60">
              <tr className="text-left text-slate-500">
                <th className="px-4 py-3">Học viên</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 text-center">Kích thước</th>
                <th className="px-4 py-3 text-center">Nộp lúc</th>
                <th className="px-4 py-3 text-center">Điểm</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const gradeDetail: any = (s as any).gradeDetail || (s as any).GradeDetail || null;
                const score = (s as any).grade ?? (s as any).Grade ?? gradeDetail?.score ?? gradeDetail?.Score ?? null;
                const status = (s as any).gradeStatus ?? (s as any).GradeStatus ?? gradeDetail?.status ?? gradeDetail?.Status ?? null;
                const gradeLabel = score != null ? score : status === "pending" ? "Đang chấm" : "-";
                return (
                  <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3 font-medium">{s.studentName}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.email}</td>
                    <td className="px-4 py-3 text-center">{(s.fileSize / 1024).toFixed(1)} KB</td>
                    <td className="px-4 py-3 text-center">{new Date(s.submittedAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{gradeLabel}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => download(s.id)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/70">
                        Tải
                      </button>
                      <button onClick={() => startGrade(s)} className="rounded-lg border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50">
                        {score != null ? "Sửa điểm" : "Chấm"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Chưa có bài nộp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </div>

      {grading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Chấm điểm</p>
                <h2 className="text-lg font-semibold">{grading.studentName}</h2>
                <p className="text-sm text-slate-500">{grading.email}</p>
              </div>
              <button onClick={() => setGrading(null)} className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">
                Đóng
              </button>
            </div>
            <form onSubmit={saveGrade} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Điểm</label>
                <input
                  required
                  type="number"
                  placeholder="Điểm"
                  value={gradeForm.score}
                  onChange={(e) => setGradeForm((p) => ({ ...p, score: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Nhận xét</label>
                <textarea
                  placeholder="Nhận xét (tuỳ chọn)"
                  value={gradeForm.feedback}
                  onChange={(e) => setGradeForm((p) => ({ ...p, feedback: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60 min-h-[120px]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setGrading(null)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/70">
                  Huỷ
                </button>
                <button type="submit" className="rounded-lg bg-indigo-500 text-white text-sm font-semibold px-4 py-2 hover:bg-indigo-600">
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
