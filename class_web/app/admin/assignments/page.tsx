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
            <p className="text-sm text-gray-500">
              Lớp: {currentClass.name} • Giáo viên: {currentClass.teacherName}
            </p>
          )}
        </div>
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-4 grid md:grid-cols-5 gap-3">
        <input required placeholder="Tiêu đề bài tập" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="rounded-md border px-3 py-2 text-sm bg-transparent md:col-span-2" />
        <input type="datetime-local" value={form.dueAt} onChange={(e) => setForm((p) => ({ ...p, dueAt: e.target.value }))} className="rounded-md border px-3 py-2 text-sm bg-transparent" />
        <input type="number" min={1} value={form.maxPoints} onChange={(e) => setForm((p) => ({ ...p, maxPoints: Number(e.target.value) }))} className="rounded-md border px-3 py-2 text-sm bg-transparent" />
        <button type="submit" className="rounded-md bg-black text-white text-sm font-medium px-3 py-2 hover:bg-gray-800">
          {form.id ? "Cập nhật" : "Thêm bài tập"}
        </button>
      </form>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50/70 dark:bg-zinc-900/60">
            <tr className="text-left text-gray-500">
              <th className="px-4 py-3">Tiêu đề</th>
              <th className="px-4 py-3 text-center">Hạn</th>
              <th className="px-4 py-3 text-center">Điểm tối đa</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="px-4 py-3 font-medium">{a.title}</td>
                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{a.dueAt ? new Date(a.dueAt).toLocaleString() : "-"}</td>
                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{a.maxPoints}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => startEdit(a)} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800">
                    Sửa
                  </button>
                  <button onClick={() => remove(a.id)} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800">
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
          {items.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-gray-500" colSpan={4}>
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
