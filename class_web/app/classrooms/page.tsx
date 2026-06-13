"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GraduationCap, KeyRound, Plus, Search } from "lucide-react";
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
        <div className="rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur p-4 md:p-5 mb-6 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-indigo-50 via-sky-50 to-white text-indigo-700 ring-1 ring-indigo-200/80 shadow-sm dark:from-indigo-950/60 dark:via-slate-900 dark:to-slate-950 dark:text-indigo-300 dark:ring-indigo-500/20">
                <GraduationCap className="h-6 w-6" strokeWidth={2.1} />
                <span className="absolute -right-1 -bottom-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-950" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-semibold leading-tight">Lớp học của tôi</h1>
                <div className="text-xs text-gray-500">Quản lý lớp học bạn dạy và tham gia</div>
              </div>
            </div>
            <div className="flex-1 flex items-center gap-2 md:gap-3 md:justify-end">
              <div className="relative flex-1 md:flex-none md:w-72">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm theo tên, mô tả, mã mời"
                  className="w-full rounded-full border border-gray-200 bg-gray-50/90 py-2 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-300 focus:bg-white dark:border-gray-800 dark:bg-zinc-900/80 dark:focus:bg-zinc-950"
                />
              </div>
              <div className="hidden md:block w-px h-8 bg-gray-200 dark:bg-gray-800" />
              <button
                onClick={() => setShowJoin(true)}
                className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:-translate-y-px hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:border-gray-700 dark:bg-zinc-950 dark:text-gray-200 dark:hover:border-amber-500/40 dark:hover:bg-amber-500/10 dark:hover:text-amber-300"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-100 text-amber-600 transition group-hover:bg-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300">
                  <KeyRound className="h-4 w-4" />
                </span>
                <span>Tham gia lớp</span>
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-px hover:shadow-md hover:shadow-indigo-500/20"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white transition group-hover:bg-white/20">
                  <Plus className="h-4 w-4" />
                </span>
                <span>Tạo lớp</span>
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
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-zinc-800">
                <GraduationCap className="h-7 w-7" />
              </div>
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
