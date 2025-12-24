"use client";

import api from "@/api/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

type User = { id: string; email: string; fullName: string; systemRole: string; isActive: boolean };

const ROLES = ["Admin", "Teacher", "User"];

export default function AdminUsersPage() {
  const [items, setItems] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ fullName: "", email: "", password: "", systemRole: "User" });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ fullName: "", systemRole: "User" });

  async function load() {
    const { data } = await api.get("/admin/users");
    setItems(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/admin/users", form);
      toast.success("Đã tạo tài khoản");
      setForm({ fullName: "", email: "", password: "", systemRole: form.systemRole });
      load();
    } catch (err: any) {
      toast.error(err?.response?.data || "Không thể tạo tài khoản");
    }
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setEditForm({ fullName: user.fullName, systemRole: user.systemRole });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await api.put(`/admin/users/${editingUser.id}`, {
        fullName: editForm.fullName,
        systemRole: editForm.systemRole,
        isActive: editingUser.isActive,
      });
      toast.success("Đã cập nhật");
      setEditingUser(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data || "Cập nhật thất bại");
    }
  }

  async function toggleActive(id: string) {
    await api.post(`/admin/users/${id}/toggle-active`);
    load();
  }

  const rows = useMemo(() => {
    const roleKey = roleFilter.toLowerCase();
    const statusKey = statusFilter.toLowerCase();
    const key = q.trim().toLowerCase();
    return items.filter((u) => {
      if (key && !(u.fullName.toLowerCase().includes(key) || u.email.toLowerCase().includes(key))) return false;
      if (roleKey !== "all" && u.systemRole.toLowerCase() !== roleKey) return false;
      if (statusKey !== "all") {
        const isActive = u.isActive;
        if (statusKey === "active" && !isActive) return false;
        if (statusKey === "locked" && isActive) return false;
      }
      return true;
    });
  }, [items, q, roleFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Người dùng</h1>
          <p className="text-sm text-slate-500">Tạo tài khoản admin / người dùng nhanh.</p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-sm grid md:grid-cols-5 gap-3">
        <input required placeholder="Họ tên" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60" />
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60" />
        <input required type="password" placeholder="Mật khẩu tạm" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60" />
        <select value={form.systemRole} onChange={(e) => setForm((p) => ({ ...p, systemRole: e.target.value }))} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60">
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-indigo-500 text-white text-sm font-semibold px-3 py-2 hover:bg-indigo-600">
          Thêm tài khoản
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <input
          placeholder="Tìm người dùng"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-56 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 px-4 py-2 text-sm text-slate-700 dark:text-slate-100 placeholder:text-slate-400"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
        >
          <option value="all">Tất cả vai trò</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Active</option>
          <option value="locked">Blocked</option>
        </select>
      </div>

      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50/70 dark:bg-slate-900/60">
            <tr className="text-left text-slate-500">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3 text-center">Role</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const initials = u.fullName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
              return (
                <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-tr from-indigo-500 to-sky-400 text-white text-xs font-semibold">{initials}</div>
                      <div className="font-medium">{u.fullName}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{u.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300 px-2.5 py-1 text-[11px] font-medium">{u.systemRole}</span>
                  </td>
                  <td className="px-4 py-3 text-center">{u.isActive ? <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-600 px-2.5 py-1 text-[11px] font-medium">Active</span> : <span className="inline-flex items-center rounded-full bg-rose-50 text-rose-600 px-2.5 py-1 text-[11px] font-medium">Blocked</span>}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(u)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/70">
                      Sửa
                    </button>
                    {u.systemRole.toLowerCase() !== "admin" && (
                      <button onClick={() => toggleActive(u.id)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/70">
                        {u.isActive ? "Khoá" : "Mở"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  Không có dữ liệu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Chỉnh sửa tài khoản</h2>
                <p className="text-sm text-slate-500">{editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">
                Đóng
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Họ tên</label>
                <input required value={editForm.fullName} onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Vai trò</label>
                <select value={editForm.systemRole} onChange={(e) => setEditForm((p) => ({ ...p, systemRole: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60">
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingUser(null)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/70">
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
