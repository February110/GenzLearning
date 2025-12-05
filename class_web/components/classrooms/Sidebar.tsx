"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, GraduationCap, FileText, User as UserIcon, ChevronLeft, ChevronRight, ChevronDown, Users, CalendarDays } from "lucide-react";
import clsx from "clsx";
import api from "@/api/client";

const NavItem = ({ href, label, icon: Icon, collapsed = false }: { href: string; label: string; icon: any; collapsed?: boolean }) => {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={clsx(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
        active ? "bg-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
      )}
    >
      <span className={clsx("grid h-8 w-8 place-items-center rounded-md", active ? "bg-indigo-100 text-indigo-600" : "bg-white ring-1 ring-gray-200 text-gray-700 dark:bg-zinc-800 dark:ring-gray-700 dark:text-gray-200")}> 
        <Icon size={16} />
      </span>
      {!collapsed && <span className="font-medium">{label}</span>}
    </Link>
  );
};

export default function ClassroomSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openTeach, setOpenTeach] = useState(true);
  const [openEnroll, setOpenEnroll] = useState(true);

  type Classroom = { classroomId: string; name: string; role: string };
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const fetchClasses = () => {
      setLoading(true);
      api
        .get("/classrooms")
        .then(({ data }) => setClasses(data))
        .catch(() => {})
        .finally(() => setLoading(false));
    };

    fetchClasses();
    const handler = (e: Event) => {
      const custom = e as CustomEvent;
      const data = custom.detail;
      if (Array.isArray(data)) {
        setClasses(data);
        setLoading(false);
      } else {
        fetchClasses();
      }
    };
    window.addEventListener("classrooms:updated", handler);
    return () => window.removeEventListener("classrooms:updated", handler);
  }, []);

  const teachClasses = useMemo(() => classes.filter((c) => c.role === "Teacher"), [classes]);
  const enrollClasses = useMemo(() => classes.filter((c) => c.role !== "Teacher"), [classes]);
  const dotColors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-violet-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-sky-500",
  ];
  function dotFor(id: string) {
    let sum = 0;
    for (let i = 0; i < id.length; i++) sum = (sum + id.charCodeAt(i)) % 8191;
    return dotColors[sum % dotColors.length];
  }
  return (
    <aside className={clsx("hidden md:flex shrink-0 flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950 relative transition-all", collapsed ? "w-16" : "w-72") }>
      <div className={clsx("flex items-center px-3 h-16 border-b border-gray-200 dark:border-gray-800", collapsed ? "justify-center" : "gap-3 px-5") }>
        <img src="/images/logo/logo-light-admin.png" alt="GenZ Learning" className="h-8 w-auto" />
        {!collapsed && <div className="text-lg font-semibold">GenZ Learning</div>}
        {!collapsed && (
          <button
            aria-label="Thu gọn"
            onClick={() => setCollapsed(true)}
            className="ml-auto rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
            title="Thu gọn"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>
      {collapsed && (
        <button
          aria-label="Mở rộng"
          onClick={() => setCollapsed(false)}
          className="absolute -right-3 top-16 z-10 rounded-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 p-1 shadow"
          title="Mở rộng"
        >
          <ChevronRight size={16} />
        </button>
      )}
      <div className="px-3 py-4 overflow-y-auto">
        {!collapsed && <div className="px-2 text-[11px] uppercase tracking-wider text-gray-400 mb-2">Menu</div>}
        <nav className="flex flex-col gap-1">
          <NavItem collapsed={collapsed} href="/classrooms/overview" label="Tổng quan" icon={LayoutDashboard} />
          
          <NavItem collapsed={collapsed} href="/classrooms" label="Lớp của tôi" icon={GraduationCap} />
          <NavItem collapsed={collapsed} href="/assignments/calendar" label="Lịch" icon={CalendarDays} />

          {/* Giảng dạy */}
          <div className={clsx("mt-1", collapsed && "hidden")}>
            <button
              onClick={() => setOpenTeach((v) => !v)}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-expanded={openTeach}
            >
              <span className="grid h-8 w-8 place-items-center rounded-md bg-white dark:bg-zinc-800 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200">
                <Users size={16} />
              </span>
              <span className="font-medium flex-1 text-left">Giảng dạy</span>
              <ChevronDown size={16} className={clsx("transition-transform", openTeach ? "rotate-180" : "rotate-0")} />
            </button>
            {openTeach && (
              <div className="mt-1 ml-11 flex flex-col">
                {loading && <div className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400">Đang tải...</div>}
                {!loading && teachClasses.slice(0, 6).map((c) => (
                  <Link
                    key={c.classroomId}
                    href={`/classrooms/${c.classroomId}`}
                    className={clsx(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 truncate border-l-2 border-transparent hover:border-indigo-300 transition",
                      pathname === `/classrooms/${c.classroomId}` && "text-indigo-700 dark:text-indigo-300 font-medium bg-indigo-50/60 dark:bg-indigo-900/20 border-indigo-500"
                    )}
                    title={c.name}
                  >
                    <span className={clsx("h-1.5 w-1.5 rounded-full ring-2 ring-white dark:ring-zinc-950", dotFor(c.classroomId))} />
                    <span className="truncate">{c.name}</span>
                  </Link>
                ))}
                {!loading && teachClasses.length > 6 && (
                  <Link href="/classrooms" className="px-2 py-1.5 text-xs text-indigo-600 hover:underline">Xem tất cả</Link>
                )}
                {!loading && teachClasses.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400">Chưa có lớp</div>
                )}
              </div>
            )}
          </div>

          {/* Đã đăng ký */}
          <div className={clsx("mt-1", collapsed && "hidden")}>
            <button
              onClick={() => setOpenEnroll((v) => !v)}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-expanded={openEnroll}
            >
              <span className="grid h-8 w-8 place-items-center rounded-md bg-white dark:bg-zinc-800 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200">
                <GraduationCap size={16} />
              </span>
              <span className="font-medium flex-1 text-left">Đã đăng ký</span>
              <ChevronDown size={16} className={clsx("transition-transform", openEnroll ? "rotate-180" : "rotate-0")} />
            </button>
            {openEnroll && (
              <div className="mt-1 ml-11 flex flex-col">
                {loading && <div className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400">Đang tải...</div>}
                {!loading && enrollClasses.slice(0, 8).map((c) => (
                  <Link
                    key={c.classroomId}
                    href={`/classrooms/${c.classroomId}`}
                    className={clsx(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 truncate border-l-2 border-transparent hover:border-indigo-300 transition",
                      pathname === `/classrooms/${c.classroomId}` && "text-indigo-700 dark:text-indigo-300 font-medium bg-indigo-50/60 dark:bg-indigo-900/20 border-indigo-500"
                    )}
                    title={c.name}
                  >
                    <span className={clsx("h-1.5 w-1.5 rounded-full ring-2 ring-white dark:ring-zinc-950", dotFor(c.classroomId))} />
                    <span className="truncate">{c.name}</span>
                  </Link>
                ))}
                {!loading && enrollClasses.length > 8 && (
                  <Link href="/classrooms" className="px-2 py-1.5 text-xs text-indigo-600 hover:underline">Xem tất cả</Link>
                )}
                {!loading && enrollClasses.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400">Chưa có lớp</div>
                )}
              </div>
            )}
          </div>

          <div className="h-2" />
          <NavItem collapsed={collapsed} href="/submissions" label="Bài nộp" icon={FileText} />
          <NavItem collapsed={collapsed} href="/profile" label="Hồ sơ" icon={UserIcon} />
        </nav>
      </div>
      {!collapsed && <div className="mt-auto px-5 py-4 text-xs text-gray-400">© {new Date().getFullYear()} GenZ Learning</div>}
    </aside>
  );
}
