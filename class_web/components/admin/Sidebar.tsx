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
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
        active ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
      )}
    >
      <span
        className={clsx(
          "grid h-8 w-8 place-items-center rounded-md",
          active ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
        )}
      >
        <Icon size={16} />
      </span>
      {!collapsed && <span className="font-medium">{label}</span>}
    </Link>
  );
};

export default function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside className={clsx("hidden md:flex shrink-0 flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950 relative transition-all", collapsed ? "w-16" : "w-72") }>
      {/* Brand */}
      <div className={clsx("flex items-center px-3 h-16 border-b border-gray-200 dark:border-gray-800", collapsed ? "justify-center" : "gap-3 px-5") }>
        {/* eslint-disable-next-line @next/next/no-img-element */}
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

      {/* Menu */}
      <div className="px-3 py-4 overflow-y-auto">
        {!collapsed && <div className="px-2 text-[11px] uppercase tracking-wider text-gray-400 mb-2">Main Menu</div>}
        <nav className="flex flex-col gap-1">
          <NavItem collapsed={collapsed} href="/admin" label="Tổng quan" icon={LayoutDashboard} />
          <NavItem collapsed={collapsed} href="/admin/analytics" label="Phân tích" icon={LineChart} />
          <NavItem collapsed={collapsed} href="/admin/users" label="Quản lý tài khoản" icon={Users} />
          <NavItem collapsed={collapsed} href="/admin/classes" label="Quản lý lớp" icon={GraduationCap} />
          <NavItem collapsed={collapsed} href="/admin/assignments" label="Quản lý bài tập" icon={ClipboardList} />
          <NavItem collapsed={collapsed} href="/admin/submissions" label="Bài nộp" icon={FileText} />
        </nav>

        {!collapsed && <div className="px-2 text-[11px] uppercase tracking-wider text-gray-400 mt-4 mb-2">Khác</div>}
        <nav className="flex flex-col gap-1">
          <NavItem collapsed={collapsed} href="/auth/login" label="Đăng nhập" icon={FileCheck2} />
          <NavItem collapsed={collapsed} href="/auth/register" label="Đăng ký" icon={NotebookPen} />
        </nav>
      </div>

      {!collapsed && <div className="mt-auto px-5 py-4 text-xs text-gray-400">© {new Date().getFullYear()} GenZ Learning</div>}

    </aside>
  );
}
