"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  FileText,
  ClipboardList,
  NotebookPen,
  FileCheck2,
  ChevronLeft,
  ChevronRight,
  LineChart,
} from "lucide-react";
import clsx from "clsx";

const NavItem = ({ href, label, icon: Icon, collapsed = false }: { href: string; label: string; icon: any; collapsed?: boolean }) => {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={clsx(
        "group relative flex items-center rounded-lg text-sm transition",
        collapsed ? "mx-auto justify-center p-2" : "gap-3 px-3 py-2",
        active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900/60"
      )}
    >
      <span
        className={clsx(
        "grid h-9 w-9 place-items-center rounded-md",
          active ? "text-indigo-600" : "text-slate-600 dark:text-slate-300"
        )}
      >
        <Icon size={20} />
      </span>
      {!collapsed && <span className="font-medium">{label}</span>}
    </Link>
  );
};

export default function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("sidebar:admin:collapsed") === "1";
    } catch {
      return false;
    }
  });
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("sidebar:admin:collapsed", collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);
  return (
    <aside className={clsx("hidden md:flex shrink-0 flex-col border-r border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 relative transition-all", collapsed ? "w-16" : "w-72") }>
      {/* Brand */}
      <div className={clsx("flex items-center px-3 h-16 border-b border-slate-200/70 dark:border-slate-800", collapsed ? "justify-center" : "gap-3 px-5") }>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo/logo-light-admin.png" alt="GenZ Learning" className="h-9 w-9 object-contain border-0 shadow-none" />
        {!collapsed && <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">GenZ Learning</div>}
        {!collapsed && (
          <button
            aria-label="Thu gọn"
            onClick={() => setCollapsed(true)}
            className="ml-auto rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900/70 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
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
          className="absolute -right-3 top-16 z-10 rounded-full bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 p-1 shadow"
          title="Mở rộng"
        >
          <ChevronRight size={16} />
        </button>
      )}

      {/* Menu */}
      <div className={clsx("py-4 overflow-y-auto", collapsed ? "px-1" : "px-3")}>
        {!collapsed && <div className="px-2 text-[11px] uppercase tracking-wider text-slate-400 mb-2">Main Menu</div>}
        <nav className="flex flex-col gap-1">
          <NavItem collapsed={collapsed} href="/admin" label="Tổng quan" icon={LayoutDashboard} />
          <NavItem collapsed={collapsed} href="/admin/analytics" label="Phân tích" icon={LineChart} />
          <NavItem collapsed={collapsed} href="/admin/users" label="Quản lý tài khoản" icon={Users} />
          <NavItem collapsed={collapsed} href="/admin/classes" label="Quản lý lớp" icon={GraduationCap} />
          <NavItem collapsed={collapsed} href="/admin/assignments" label="Quản lý bài tập" icon={ClipboardList} />
          <NavItem collapsed={collapsed} href="/admin/submissions" label="Bài nộp" icon={FileText} />
        </nav>

        {!collapsed && <div className="px-2 text-[11px] uppercase tracking-wider text-slate-400 mt-4 mb-2">Khác</div>}
        <nav className="flex flex-col gap-1">
          <NavItem collapsed={collapsed} href="/auth/login" label="Đăng nhập" icon={FileCheck2} />
          <NavItem collapsed={collapsed} href="/auth/register" label="Đăng ký" icon={NotebookPen} />
        </nav>
      </div>

      {!collapsed && <div className="mt-auto px-5 py-4 text-xs text-slate-400">© {new Date().getFullYear()} GenZ Learning</div>}

    </aside>
  );
}
