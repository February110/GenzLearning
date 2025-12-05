"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import api from "@/api/client";
import { toast } from "react-hot-toast";

interface Classroom {
  classroomId: string;
  name: string;
  description?: string;
  inviteCode: string;
  inviteCodeVisible?: boolean;
  section?: string;
  role: string;
}

export default function ClassroomsPage() {
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [filter, setFilter] = useState<"all" | "teaching" | "enrolled">("all");
  const [query, setQuery] = useState("");

  const [createData, setCreateData] = useState({
    name: "",
    description: "",
    section: "",
    room: "",
    schedule: "",
  });
  const [inviteCode, setInviteCode] = useState("");

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/classrooms");
      setClasses(data);
      // Notify listeners (sidebar) with fresh data
      window.dispatchEvent(new CustomEvent("classrooms:updated", { detail: data }));
    } catch (err) {
      console.error(err);
      toast.error("Không tải được danh sách lớp học");
    } finally {
      setLoading(false);
    }
  }

  async function createClassroom(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/classrooms", createData);
      toast.success("Tạo lớp học thành công!");
      setShowCreate(false);
      setCreateData({ name: "", description: "", section: "", room: "", schedule: "" });
      load();
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Lỗi khi tạo lớp học";
      toast.error(message);
    }
  }

  async function joinClassroom(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/classrooms/join", { inviteCode });
      toast.success("Đã tham gia lớp học!");
      setShowJoin(false);
      setInviteCode("");
      load();
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Mã mời không hợp lệ";
      toast.error(message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Card color helper (deterministic by id)
  // Softer, easier-to-read palette (blue/teal focused)
  const gradients = [
    "from-blue-500 to-blue-600",
    "from-sky-500 to-indigo-600",
    "from-teal-500 to-emerald-600",
    "from-cyan-500 to-sky-600",
    "from-indigo-500 to-blue-700",
    "from-emerald-500 to-green-600",
  ];
  function gradientFor(id: string) {
    let sum = 0;
    for (let i = 0; i < id.length; i++) sum = (sum + id.charCodeAt(i)) % 9973;
    return gradients[sum % gradients.length];
  }

  const filtered = useMemo(() => {
    let list = classes;
    if (filter === "teaching") list = list.filter((c) => c.role === "Teacher");
    if (filter === "enrolled") list = list.filter((c) => c.role !== "Teacher");
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || c.section?.toLowerCase().includes(q) || c.inviteCode.toLowerCase().includes(q)
      );
    }
    return list;
  }, [classes, filter, query]);

  function copyCode(code: string) {
    try {
      navigator.clipboard?.writeText(code);
      toast.success("Đã sao chép mã mời");
    } catch {
      toast.success("Mã mời: " + code);
    }
  }

  return (
    <div className="py-4 md:py-6">
      <div className="mx-auto max-w-7xl px-4">
        {/* Toolbar */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-4 md:p-5 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-700/40">📚</div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-semibold leading-tight">Lớp học của tôi</h1>
                <div className="text-xs text-gray-500">Quản lý lớp học bạn dạy và tham gia</div>
              </div>
            </div>
            <div className="flex-1 flex items-center gap-2 md:gap-3 md:justify-end">
              <div className="relative flex-1 md:flex-none md:w-72">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm theo tên, mô tả, mã mời"
                  className="w-full rounded-full bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 pl-4 pr-3 py-2 text-sm outline-none focus:border-gray-300"
                />
              </div>
              <div className="hidden md:block w-px h-8 bg-gray-200 dark:bg-gray-800" />
              <button
                onClick={() => setShowJoin(true)}
                className="rounded-full border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                🔑 Tham gia lớp
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm"
              >
                ➕ Tạo lớp
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                filter === "all"
                  ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-black border-transparent"
                  : "border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setFilter("teaching")}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                filter === "teaching"
                  ? "bg-indigo-600 text-white border-transparent"
                  : "border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Giảng dạy
            </button>
            <button
              onClick={() => setFilter("enrolled")}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                filter === "enrolled"
                  ? "bg-fuchsia-600 text-white border-transparent"
                  : "border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Đã tham gia
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-4 md:p-5">
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="h-16 bg-gray-100 dark:bg-zinc-800" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-2/3 bg-gray-100 dark:bg-zinc-800 rounded" />
                    <div className="h-3 w-1/2 bg-gray-100 dark:bg-zinc-800 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-14 h-14 grid place-items-center rounded-full bg-gray-100 dark:bg-zinc-800 text-2xl">🗂️</div>
              <div className="mt-3 font-medium">Không có lớp phù hợp</div>
              <div className="text-sm text-gray-500">Hãy đổi bộ lọc hoặc tạo lớp mới</div>
              <div className="mt-4 flex justify-center gap-2">
                <button onClick={() => setShowJoin(true)} className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800">Tham gia lớp</button>
                <button onClick={() => setShowCreate(true)} className="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm">Tạo lớp</button>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
              {filtered.map((c) => {
                const showInviteCode = c.inviteCodeVisible ?? true;
                return (
                  <div key={c.classroomId} className="group rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-zinc-950 hover:shadow-md transition">
                    <Link href={`/classrooms/${c.classroomId}`} className="block">
                      <div className={`h-16 bg-gradient-to-r ${gradientFor(c.classroomId)} relative` }>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition" />
                        <div className="absolute left-4 right-16 top-1/2 -translate-y-1/2 text-white font-semibold truncate drop-shadow">{c.name}</div>
                        <div className={`absolute right-3 top-2 px-2 py-0.5 rounded-full text-[10px] font-medium text-white/90 border border-white/30 backdrop-blur-sm`}>{c.role === "Teacher" ? "Giảng dạy" : "Tham gia"}</div>
                      </div>
                      <div className="p-5 min-h-28 flex items-start">
                        <div
                          className="text-sm text-gray-700 dark:text-gray-200"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {c.description || c.section || "Không có mô tả"}
                        </div>
                      </div>
                    </Link>
                    <div className="px-4 pb-3 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                      <div className="font-mono text-xs">{showInviteCode ? `Mã: ${c.inviteCode}` : "Mã mời đã bị ẩn"}</div>
                      {showInviteCode && (
                        <button
                          onClick={() => copyCode(c.inviteCode)}
                          className="rounded-md px-2 py-1 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs"
                        >
                          Sao chép
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal tạo lớp */}
      {showCreate && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/55 dark:bg-slate-950/70 px-4 z-50">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-xl w-full max-w-lg relative border border-gray-200 dark:border-gray-800">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold">Tạo lớp học mới</h2>
              <p className="text-sm text-gray-500 mt-1">Điền thông tin chi tiết để học viên dễ nhận biết lớp.</p>
            </div>
            <form onSubmit={createClassroom} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  Tên lớp học <span className="text-red-500">*</span>
                </label>
                <input
                  placeholder="Ví dụ: Lập trình di động K2025"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                  value={createData.name}
                  onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-100">Mô tả</label>
                <textarea
                  placeholder="Nội dung chính, mục tiêu của lớp..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none resize-none"
                  value={createData.description}
                  onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-800 dark:text-gray-100">Phân ban / tổ</label>
                  <input
                    placeholder="VD: CNTT1, 12A1..."
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                    value={createData.section}
                    onChange={(e) => setCreateData({ ...createData, section: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-800 dark:text-gray-100">Phòng học</label>
                  <input
                    placeholder="Ví dụ: P.203, Lab 4..."
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                    value={createData.room}
                    onChange={(e) => setCreateData({ ...createData, room: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-100">Thời khóa biểu</label>
                <input
                  placeholder="Ví dụ: Thứ 2 - 4 (tiết 3-4)"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                  value={createData.schedule}
                  onChange={(e) => setCreateData({ ...createData, schedule: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 text-sm font-medium"
                >
                  Tạo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal tham gia lớp */}
      {showJoin && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/55 dark:bg-slate-950/70 z-50">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-xl w-full max-w-md relative border border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-semibold mb-4">
              Nhập mã mời lớp học
            </h2>
            <form onSubmit={joinClassroom} className="space-y-3">
              <input
                placeholder="Mã mời (VD: ABC123)"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoin(false)}
                  className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm"
                >
                  Tham gia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
