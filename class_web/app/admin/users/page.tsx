"use client";

import api from "@/api/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

type User = { id: string; email: string; fullName: string; systemRole: string; isActive: boolean };

const ROLES = ["Admin", "User"];

export default function AdminUsersPage() {
  const [items, setItems] = useState<User[]>([]);
  const [q, setQ] = useState("");
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
    const key = q.trim().toLowerCase();
    if (!key) return items;
    return items.filter((u) => u.fullName.toLowerCase().includes(key) || u.email.toLowerCase().includes(key));
  }, [items, q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Users</h1>
          <p className="text-sm text-gray-500">Tạo tài khoản admin / người dùng nhanh.</p>
        </div>
        <input
          placeholder="Search users"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-56 rounded-full bg-gray-100 dark:bg-zinc-900 border border-transparent focus:border-gray-300 outline-none px-4 py-2 text-sm"
        />
      </div>

      <form onSubmit={handleCreate} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-4 grid md:grid-cols-5 gap-3">
        <input required placeholder="Họ tên" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} className="rounded-md border px-3 py-2 text-sm bg-transparent" />
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="rounded-md border px-3 py-2 text-sm bg-transparent" />
        <input required type="password" placeholder="Mật khẩu tạm" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className="rounded-md border px-3 py-2 text-sm bg-transparent" />
        <select value={form.systemRole} onChange={(e) => setForm((p) => ({ ...p, systemRole: e.target.value }))} className="rounded-md border px-3 py-2 text-sm bg-transparent">
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-black text-white text-sm font-medium px-3 py-2 hover:bg-gray-800">
          Thêm tài khoản
        </button>
      </form>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50/70 dark:bg-zinc-900/60">
            <tr className="text-left text-gray-500">
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
                <tr key={u.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-tr from-indigo-500 to-fuchsia-500 text-white text-xs font-semibold">{initials}</div>
                      <div className="font-medium">{u.fullName}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{u.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300 px-2.5 py-1 text-[11px] font-medium">{u.systemRole}</span>
                  </td>
                  <td className="px-4 py-3 text-center">{u.isActive ? <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-600 px-2.5 py-1 text-[11px] font-medium">Active</span> : <span className="inline-flex items-center rounded-full bg-rose-50 text-rose-600 px-2.5 py-1 text-[11px] font-medium">Blocked</span>}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(u)} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800">
                      Sửa
                    </button>
                    {u.systemRole.toLowerCase() !== "admin" && (
                      <button onClick={() => toggleActive(u.id)} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover.bg-gray-800">
                        {u.isActive ? "Khoá" : "Mở"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={5}>
                  Không có dữ liệu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-900 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Chỉnh sửa tài khoản</h2>
                <p className="text-sm text-gray-500">{editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-sm text-gray-500 hover:text-black dark:hover:text-white">
                Đóng
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Họ tên</label>
                <input required value={editForm.fullName} onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-transparent" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Vai trò</label>
                <select value={editForm.systemRole} onChange={(e) => setEditForm((p) => ({ ...p, systemRole: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-transparent">
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingUser(null)} className="rounded-md border px-4 py-2 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
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
