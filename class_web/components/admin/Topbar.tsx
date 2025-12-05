"use client";

import { useTheme } from "next-themes";
import {
  Sun,
  Moon,
  Search,
  Bell,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Megaphone,
  ClipboardList,
  Clock,
  MessageCircle,
} from "lucide-react";
import { getCurrentUser } from "@/api/auth";
import type { AuthUser } from "@/api/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useLogoutHandler } from "@/utils/logoutHandler";
import { resolveAvatar } from "@/utils/resolveAvatar";
import useNotifications from "@/hooks/useNotifications";
import type { NotificationItem } from "@/api/notifications";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import vi from "dayjs/locale/vi";

dayjs.extend(utc);
dayjs.extend(relativeTime);
dayjs.extend(timezone);
dayjs.locale(vi);

export default function AdminTopbar() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const router = useRouter();
  
  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => { setUser(getCurrentUser()); }, []);
  const initials = useMemo(() => {
    const name = user?.fullName?.trim() || "";
    if (!name) return "";
    return name
      .split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [user]);
  const avatarUrl = useMemo(() => {
    if (!user?.avatar) return undefined;
    return resolveAvatar(user.avatar) || user.avatar;
  }, [user]);

  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (popRef.current && !popRef.current.contains(target)) setOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const { items: notifications, unread, loading: notifLoading, markAllRead, markRead } = useNotifications();
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  useEffect(() => {
    if (!notifOpen) setShowAllNotifications(false);
  }, [notifOpen]);

  const handleNotificationClick = useCallback(
    (item: NotificationItem) => {
      if (!item.isRead) {
        markRead(item.id).catch(() => {});
      }
      const target = item.assignmentId
        ? `/assignments/${item.assignmentId}`
        : item.classroomId
          ? `/classrooms/${item.classroomId}`
          : null;
      if (target) router.push(target);
      setNotifOpen(false);
    },
    [markRead, router]
  );

  const handleMarkAllRead = useCallback(() => {
    if (unread === 0) return;
    markAllRead().catch(() => {});
  }, [markAllRead, unread]);

  const pathname = usePathname();
  const pageTitle = useMemo(() => {
    // Admin 
    if (pathname?.startsWith("/admin/analytics")) return "Phân tích";
    if (pathname?.startsWith("/admin/users")) return "Quản lý tài khoản";
    if (pathname?.startsWith("/admin/classes")) return "Quản lý lớp";
    if (pathname?.startsWith("/admin/assignments")) return "Quản lý bài tập";
    if (pathname?.startsWith("/admin/submissions")) return "Bài nộp";
    if (pathname?.startsWith("/admin/grades")) return "Chấm điểm";
    if (pathname === "/admin" || pathname?.startsWith("/admin")) return "Tổng quan";

    // Classroom
    if (pathname?.startsWith("/classrooms/overview")) return "Tổng quan";
    if (pathname?.startsWith("/classrooms")) return "Lớp của tôi";
    if (pathname?.startsWith("/assignments/calendar")) return "Lịch";
    if (pathname?.startsWith("/assignments")) return "Bài tập";
    if (pathname?.startsWith("/submissions")) return "Bài nộp";
    if (pathname?.startsWith("/profile")) return "Hồ sơ";

    return "Tổng quan";
  }, [pathname]);
  const pageSubtitle = pageTitle === "Tổng quan";
  const { handleLogout } = useLogoutHandler();
  const notificationIcon = (type: string) => {
    switch (type) {
      case "announcement":
        return <Megaphone size={16} />;
      case "announcement-comment":
        return <MessageCircle size={16} />;
      case "assignment-due":
        return <Clock size={16} />;
      case "assignment":
      default:
        return <ClipboardList size={16} />;
    }
  };

  const stripHtml = useCallback((input?: string | null) => {
    if (!input) return "";
    return input.replace(/<\/?[^>]+(>|$)/g, "").trim();
  }, []);

  const toVietnamTime = useCallback((value: string) => {
    const hasExplicitOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
    const base = hasExplicitOffset ? dayjs(value) : dayjs.utc(value);
    return base.tz("Asia/Ho_Chi_Minh");
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/95 dark:bg-slate-900/85 px-4 md:px-6 h-16">
      <div className="h-full flex items-center justify-between gap-3 text-slate-900 dark:text-slate-100">
        {/* Title */}
        <div className="min-w-0">
          <div className="text-xl font-semibold leading-tight">{pageTitle}</div>
          {pageSubtitle && (
            <div className="text-xs text-slate-500 dark:text-slate-400 -mt-0.5">{pageSubtitle}</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Smaller search on the right */}
          <div className="relative hidden md:block w-64 mr-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search"
              className="w-full rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-slate-300 outline-none pl-9 pr-3 py-2 text-sm text-slate-700 dark:text-slate-200"
            />
          </div>
        <button
          aria-label="Toggle Theme"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div ref={notifRef} className="relative">
          <button
            aria-label="Notifications"
            className="relative rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            onClick={() => setNotifOpen((v) => !v)}
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 rounded-full bg-rose-500 text-white text-[10px] font-semibold px-1.5 py-0.5 leading-none">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Thông báo</div>                </div>
                <button
                  onClick={handleMarkAllRead}
                  className={`text-xs font-medium ${unread === 0 ? "text-slate-300 cursor-not-allowed" : "text-indigo-600 hover:text-indigo-500"}`}
                  disabled={unread === 0}
                >
                  Đánh dấu tất cả đọc
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {notifLoading ? (
                  <div className="p-4 text-sm text-slate-500">Đang tải...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">Hiện chưa có thông báo.</div>
                ) : (
                    (showAllNotifications ? notifications : notifications.slice(0, 5)).map((item) => {
                    const created = toVietnamTime(item.createdAt);
                    const messageText = stripHtml(item.message);
                    const accent = item.type === "assignment-due" ? "text-orange-500 bg-orange-50" : "text-indigo-500 bg-indigo-50";
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNotificationClick(item)}
                        className={`flex w-full gap-3 px-3 py-3 text-left transition-colors ${item.isRead ? "bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900/70" : "bg-indigo-50/70 dark:bg-indigo-950/30"}`}
                      >
                        <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-full text-sm ${accent} dark:text-indigo-300 dark:bg-indigo-950/50`}>
                          {notificationIcon(item.type)}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{stripHtml(item.title)}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{messageText || "—"}</div>
                          <div className="mt-1 text-[11px] text-slate-400">
                            {created.format("HH:mm DD/MM")} • {created.fromNow()}
                          </div>
                        </div>
                        {!item.isRead && <span className="mt-2 h-2 w-2 rounded-full bg-indigo-500" aria-label="Chưa đọc" />}
                      </button>
                    );
                  })
                )}
              </div>
              {!notifLoading && notifications.length > 5 && (
                <button
                  className="w-full text-center text-sm font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-zinc-900/60 py-2"
                  onClick={() => setShowAllNotifications((prev) => !prev)}
                >
                  {showAllNotifications ? "Thu gọn" : "Xem thêm"}
                </button>
              )}
            </div>
          )}
        </div>

        <div ref={popRef} className="ml-2 relative">
          <button
            className="flex items-center gap-2 rounded-full border border-transparent hover:border-gray-200 dark:hover:border-gray-700 px-1 py-1"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user?.fullName || "Avatar"}
                className="h-8 w-8 rounded-full object-cover border border-white/20 shadow-[0_2px_8px_rgba(124,58,237,0.35)]"
              />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-tr from-indigo-500 to-fuchsia-500 text-white text-sm font-semibold shadow-[0_2px_8px_rgba(124,58,237,0.35)]" suppressHydrationWarning>
                {initials || ""}
              </div>
            )}
            <div className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-200 max-w-32 truncate" suppressHydrationWarning>
              {user?.fullName || ""}
            </div>
            <ChevronDown size={16} className="text-gray-500" />
          </button>

          {open && (
            <div role="menu" className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 shadow-xl p-2">
              <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="font-medium text-gray-900 dark:text-gray-100">{user?.fullName || "User"}</div>
                <div className="text-xs truncate">{user?.email}</div>
              </div>
              <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />
              <Link href="/profile" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800" role="menuitem">
                <User size={16} /> Profile
              </Link>
              <Link href="#" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800" role="menuitem">
                <Settings size={16} /> Settings
              </Link>
              <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />
              <button onClick={() => { setOpen(false); handleLogout(); }} className="w-full text-left flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800" role="menuitem">
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </header>
  );
}
