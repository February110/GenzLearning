"use client";

import api from "@/api/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

type ClassRow = { id: string; name: string; teacherName: string };
type Assignment = { id: string; title: string; instructions?: string; dueAt?: string; maxPoints: number };

export default function AdminAssignmentsPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [items, setItems] = useState<Assignment[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ id: "", title: "", dueAt: "", maxPoints: 100 });

  async function loadClasses() {
    const { data } = await api.get("/admin/classes");
    setClasses(data);
    if (data?.length && !classId) setClassId(data[0].id);
  }
  async function loadAssignments(cid: string) {
    if (!cid) return setItems([]);
    const { data } = await api.get(`/admin/classes/${cid}/assignments`);
    setItems(data);
  }

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    loadAssignments(classId);
  }, [classId]);

  const currentClass = useMemo(() => classes.find((c) => c.id === classId), [classes, classId]);
  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    const now = Date.now();
    return items.filter((a) => {
      if (key && !a.title.toLowerCase().includes(key)) return false;
      if (statusFilter === "all") return true;
      const dueRaw = (a as any).dueAt ?? (a as any).DueAt;
      const dueTs = dueRaw ? new Date(dueRaw).getTime() : null;
      if (!dueTs || Number.isNaN(dueTs)) {
        return statusFilter === "no-due";
      }
      if (statusFilter === "overdue") return dueTs < now;
      if (statusFilter === "upcoming") return dueTs >= now;
      return true;
    });
  }, [items, q, statusFilter]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) {
      toast.error("Chọn lớp trước khi tạo bài tập");
      return;
    }
    const payload = {
      title: form.title,
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      maxPoints: form.maxPoints
    };
    try {
      if (form.id) {
        await api.put(`/admin/assignments/${form.id}`, payload);
        toast.success("Đã cập nhật bài tập");
      } else {
        await api.post(`/admin/classes/${classId}/assignments`, payload);
        toast.success("Đã thêm bài tập");
      }
      setForm({ id: "", title: "", dueAt: "", maxPoints: 100 });
      loadAssignments(classId);
    } catch (err: any) {
      toast.error(err?.response?.data || "Không thể lưu bài tập");
    }
  }

  function startEdit(a: Assignment) {
    setForm({ id: a.id, title: a.title, dueAt: a.dueAt ? a.dueAt.substring(0, 16) : "", maxPoints: a.maxPoints });
  }

  async function remove(id: string) {
    if (!confirm("Xoá bài tập này?")) return;
    await api.delete(`/admin/assignments/${id}`);
    loadAssignments(classId);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Quản lý bài tập</h1>
          {currentClass && (
            <p className="text-sm text-slate-500">
              Lớp: {currentClass.name} • Giáo viên: {currentClass.teacherName}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-sm grid md:grid-cols-5 gap-3">
        <input required placeholder="Tiêu đề bài tập" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60 md:col-span-2" />
        <input type="datetime-local" value={form.dueAt} onChange={(e) => setForm((p) => ({ ...p, dueAt: e.target.value }))} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60" />
        <input type="number" min={1} value={form.maxPoints} onChange={(e) => setForm((p) => ({ ...p, maxPoints: Number(e.target.value) }))} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60" />
        <button type="submit" className="rounded-lg bg-indigo-500 text-white text-sm font-semibold px-3 py-2 hover:bg-indigo-600">
          {form.id ? "Cập nhật" : "Thêm bài tập"}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <input
          placeholder="Tìm bài tập"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-56 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-2 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
        >
          <option value="all">Tất cả hạn</option>
          <option value="upcoming">Chưa đến hạn</option>
          <option value="overdue">Quá hạn</option>
          <option value="no-due">Không hạn</option>
        </select>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50/70 dark:bg-slate-900/60">
            <tr className="text-left text-slate-500">
              <th className="px-4 py-3">Tiêu đề</th>
              <th className="px-4 py-3 text-center">Hạn</th>
              <th className="px-4 py-3 text-center">Điểm tối đa</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const dueRaw = (a as any).dueAt ?? (a as any).DueAt;
              return (
              <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3 font-medium">{a.title}</td>
                <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{dueRaw ? new Date(dueRaw).toLocaleString() : "-"}</td>
                <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{a.maxPoints}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => startEdit(a)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/70">
                    Sửa
                  </button>
                  <button onClick={() => remove(a.id)} className="rounded-lg border border-rose-200 dark:border-rose-800 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50">
                    Xoá
                  </button>
                </td>
              </tr>
              );
            })}
          {filtered.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-slate-500" colSpan={4}>
                  Không có bài tập trong lớp "{currentClass?.name || ""}".
              </td>
            </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
