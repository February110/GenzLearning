"use client";
import api from "@/api/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

type ClassRow = {
  id: string;
  name: string;
  description?: string;
  section?: string;
  room?: string;
  schedule?: string;
  teacherName: string;
  teacherId: string;
  createdAt: string;
};
type TeacherOption = { id: string; fullName: string; email: string; systemRole: string; isActive?: boolean };
type ClassDetail = {
  id: string;
  name: string;
  description?: string;
  section?: string;
  room?: string;
  schedule?: string;
  inviteCode: string;
  teacherName: string;
  membersCount: number;
  members: { userId: string; fullName: string; email: string; role: string }[];
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Quản trị",
  teacher: "Giáo viên",
  user: "Người dùng",
  student: "Học viên",
};

function formatRoleLabel(role?: string) {
  const key = (role || "").toString().toLowerCase();
  return ROLE_LABELS[key] || role || "";
}

export default function AdminClassesPage() {
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [q, setQ] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [form, setForm] = useState({ id: "", name: "", description: "", section: "", room: "", schedule: "", teacherId: "" });
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  async function loadClasses() {
    const { data } = await api.get("/admin/classes");
    setRows(data);
    if (!form.teacherId && data.length) setForm((p) => ({ ...p, teacherId: data[0].teacherId }));
  }
  async function loadTeachers() {
    try {
      const { data } = await api.get("/admin/teachers");
      const list = data.filter((u: TeacherOption) => u.isActive !== false);
      setTeachers(list);
      if (!form.teacherId && list.length) setForm((p) => ({ ...p, teacherId: list[0].id }));
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const { data } = await api.get("/admin/users");
        const list = data.filter((u: TeacherOption) => u.systemRole?.toLowerCase().includes("teacher") && u.isActive !== false);
        setTeachers(list);
        if (!form.teacherId && list.length) setForm((p) => ({ ...p, teacherId: list[0].id }));
        return;
      }
      toast.error(err?.response?.data || "Không thể tải danh sách giáo viên");
    }
  }

  useEffect(() => {
    loadClasses();
    loadTeachers();
  }, []);

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (key && !(r.name.toLowerCase().includes(key) || r.teacherName.toLowerCase().includes(key))) return false;
      if (teacherFilter !== "all" && r.teacherId !== teacherFilter) return false;
      return true;
    });
  }, [rows, q, teacherFilter]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.teacherId) {
      toast.error("Chọn giáo viên phụ trách.");
      return;
    }
    const payload = {
      name: form.name,
      description: form.description || undefined,
      section: form.section || undefined,
      room: form.room || undefined,
      schedule: form.schedule || undefined,
      teacherId: form.teacherId
    };
    try {
      if (form.id) {
        await api.put(`/admin/classes/${form.id}`, payload);
        toast.success("Đã cập nhật lớp");
      } else {
        await api.post("/admin/classes", payload);
        toast.success("Đã tạo lớp");
      }
      setForm({ id: "", name: "", description: "", section: "", room: "", schedule: "", teacherId: form.teacherId });
      loadClasses();
    } catch (err: any) {
      toast.error(err?.response?.data || "Thao tác thất bại");
    }
  }

  function startEdit(cls: ClassRow) {
    setForm({
      id: cls.id,
      name: cls.name,
      description: cls.description || "",
      section: cls.section || "",
      room: cls.room || "",
      schedule: cls.schedule || "",
      teacherId: cls.teacherId
    });
  }

  async function remove(id: string) {
    if (!confirm("Xoá lớp này?")) return;
    await api.delete(`/admin/classes/${id}`);
    loadClasses();
  }

  async function viewDetail(id: string) {
    setIsDetailModalOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/admin/classes/${id}/detail`);
      setDetail({
        id: data.id,
        name: data.name,
        description: data.description,
        section: data.section,
        room: data.room,
        schedule: data.schedule,
        inviteCode: data.inviteCode,
        teacherName: data.teacherName,
        membersCount: data.membersCount,
        members: data.members
      });
    } catch (err: any) {
      toast.error(err?.response?.data || "Không thể tải chi tiết lớp");
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Lớp học</h1>
          <p className="text-sm text-slate-500">Tạo / cập nhật lớp học và giáo viên phụ trách.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-sm grid md:grid-cols-6 gap-3">
        <input required placeholder="Tên lớp" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60 md:col-span-2" />
        <input placeholder="Mô tả" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60 md:col-span-2" />
        <input placeholder="Phòng" value={form.room} onChange={(e) => setForm((p) => ({ ...p, room: e.target.value }))} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60" />
        <input placeholder="Lịch học" value={form.schedule} onChange={(e) => setForm((p) => ({ ...p, schedule: e.target.value }))} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60" />
        <select value={form.teacherId} onChange={(e) => setForm((p) => ({ ...p, teacherId: e.target.value }))} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60 md:col-span-2">
          <option value="">-- Chọn giáo viên --</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fullName}
            </option>
          ))}
        </select>
        <input placeholder="Tổ/nhóm" value={form.section} onChange={(e) => setForm((p) => ({ ...p, section: e.target.value }))} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60" />
        <button type="submit" className="rounded-lg bg-indigo-500 text-white text-sm font-semibold px-3 py-2 hover:bg-indigo-600">
          {form.id ? "Cập nhật" : "Thêm lớp"}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <input
          placeholder="Tìm lớp học"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-56 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 px-4 py-2 text-sm text-slate-700 dark:text-slate-100 placeholder:text-slate-400"
        />
        <select
          value={teacherFilter}
          onChange={(e) => setTeacherFilter(e.target.value)}
          className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
        >
          <option value="all">Tất cả giáo viên</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fullName}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/70 dark:bg-slate-900/60">
              <tr className="text-left text-slate-500">
                <th className="px-4 py-3">Lớp học</th>
                <th className="px-4 py-3 text-center">Giáo viên</th>
                <th className="px-4 py-3 text-center">Ngày tạo</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.name}</div>
                    {r.description && <p className="text-xs text-slate-500">{r.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{r.teacherName}</td>
                  <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/70" onClick={() => viewDetail(r.id)}>
                      Chi tiết
                    </button>
                    <button className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/70" onClick={() => startEdit(r)}>
                      Sửa
                    </button>
                  <button className="rounded-lg border border-rose-200 dark:border-rose-800 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50" onClick={() => remove(r.id)}>
                    Xoá
                  </button>
                </td>
              </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={4}>
                    Không có dữ liệu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </div>

      {isDetailModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Chi tiết lớp</p>
                {detail ? (
                  <>
                    <h2 className="text-xl font-semibold mt-1">{detail.name}</h2>
                    <p className="text-sm text-slate-500">
                      Giáo viên: {detail.teacherName} • Thành viên: {detail.membersCount}
                    </p>
                    <p className="text-sm text-slate-500">
                      Mã mời: <span className="font-mono">{detail.inviteCode}</span>
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Đang tải thông tin lớp...</p>
                )}
              </div>
              <button
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setDetail(null);
                }}
                className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                Đóng
              </button>
            </div>
            {detail && detail.description && <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{detail.description}</p>}
            <div className="rounded-lg border border-slate-100 dark:border-slate-800 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/60">
                  <tr className="text-left text-slate-500">
                    <th className="px-4 py-2">Họ tên</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2 text-center">Vai trò</th>
                  </tr>
                </thead>
                <tbody>
                  {detail ? (
                    detail.members.length ? (
                      detail.members.map((m) => (
                        <tr key={m.userId} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-4 py-2">{m.fullName}</td>
                          <td className="px-4 py-2 text-slate-500">{m.email}</td>
                          <td className="px-4 py-2 text-center">
                            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-900 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300">
                              {formatRoleLabel(m.role)}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-4 text-slate-500" colSpan={3}>
                          Chưa có thành viên.
                        </td>
                      </tr>
                    )
                  ) : (
                    <tr>
                      <td className="px-4 py-4 text-slate-500" colSpan={3}>
                        Đang tải danh sách...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {detailLoading && <p className="text-xs text-slate-400 mt-3">Đang tải...</p>}
          </div>
        </div>
      )}
    </div>
  );
}
