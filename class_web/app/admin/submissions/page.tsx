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
            <p className="text-sm text-gray-500">
              Lớp: {currentClass.name} • Giáo viên: {currentClass.teacherName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
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

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 overflow-x-auto">
        <table className="min-w-full text-sm">
            <thead className="bg-gray-50/70 dark:bg-zinc-900/60">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3">Học viên</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 text-center">Kích thước</th>
                <th className="px-4 py-3 text-center">Nộp lúc</th>
                <th className="px-4 py-3 text-center">Điểm</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const gradeDetail: any = (s as any).gradeDetail || (s as any).GradeDetail || null;
                const score = (s as any).grade ?? (s as any).Grade ?? gradeDetail?.score ?? gradeDetail?.Score ?? null;
                const status = (s as any).gradeStatus ?? (s as any).GradeStatus ?? gradeDetail?.status ?? gradeDetail?.Status ?? null;
                const gradeLabel = score != null ? score : status === "pending" ? "Đang chấm" : "-";
                return (
                  <tr key={s.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3 font-medium">{s.studentName}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{s.email}</td>
                    <td className="px-4 py-3 text-center">{(s.fileSize / 1024).toFixed(1)} KB</td>
                    <td className="px-4 py-3 text-center">{new Date(s.submittedAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{gradeLabel}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => download(s.id)} className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800">
                        Tải
                      </button>
                      <button onClick={() => startGrade(s)} className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800">
                        {score != null ? "Sửa điểm" : "Chấm"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={6}>
                    Chưa có bài nộp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </div>

      {grading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-900 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Chấm điểm</p>
                <h2 className="text-lg font-semibold">{grading.studentName}</h2>
                <p className="text-sm text-gray-500">{grading.email}</p>
              </div>
              <button onClick={() => setGrading(null)} className="text-sm text-gray-500 hover:text-black dark:hover:text-white">
                Đóng
              </button>
            </div>
            <form onSubmit={saveGrade} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Điểm</label>
                <input
                  required
                  type="number"
                  placeholder="Điểm"
                  value={gradeForm.score}
                  onChange={(e) => setGradeForm((p) => ({ ...p, score: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-transparent"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Nhận xét</label>
                <textarea
                  placeholder="Nhận xét (tuỳ chọn)"
                  value={gradeForm.feedback}
                  onChange={(e) => setGradeForm((p) => ({ ...p, feedback: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-transparent min-h-[120px]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setGrading(null)} className="rounded-md border px-4 py-2 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
                  Huỷ
                </button>
                <button type="submit" className="rounded-md bg-black text-white text-sm font-medium px-4 py-2 hover:bg-gray-800">
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
