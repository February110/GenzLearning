"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/api/client";
import Link from "next/link";
import { Bell, BookOpen, CalendarDays, ChevronRight, GraduationCap, Inbox, Users } from "lucide-react";

type Classroom = { classroomId: string; name: string; role?: string };
type NotificationItem = { id: string; title: string; message: string; createdAt: string };

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors
                  dark:border-slate-700 dark:bg-slate-900/70 dark:shadow-lg dark:shadow-slate-900/40 ${className}`}
    >
      {children}
    </div>
  );
}

export default function ClassroomsOverview() {
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: cls } = await api.get("/classrooms");
        setClasses(Array.isArray(cls) ? cls : []);
      } catch {}
      try {
        const { data: noti } = await api.get("/notifications");
        setNotifications(Array.isArray(noti?.items) ? noti.items : Array.isArray(noti) ? noti : []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const teachCount = useMemo(() => classes.filter((c) => (c.role || "").toLowerCase() === "teacher").length, [classes]);
  const learnCount = useMemo(() => classes.filter((c) => (c.role || "").toLowerCase() !== "teacher").length, [classes]);

  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
  const displayName = user.fullName || user.email || "bạn";

  return (
    <div className="space-y-4 pb-6 text-slate-900 dark:text-slate-50">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Chào mừng trở lại, {displayName}!</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">Cùng xem nhanh hoạt động chính của lớp học.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500 dark:text-slate-300">Chào mừng trở lại</div>
              <div className="text-xl font-semibold text-slate-900 dark:text-white">Chúc bạn một ngày hiệu quả!</div>
            </div>
            <div className="flex gap-3">
              <QuickStat icon={<GraduationCap className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />} label="Lớp đang dạy" value={teachCount} />
              <QuickStat icon={<Users className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />} label="Lớp đang học" value={learnCount} />
              <QuickStat icon={<CalendarDays className="h-5 w-5 text-amber-600 dark:text-amber-300" />} label="Thông báo mới" value={notifications.length} />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-slate-900 dark:text-white">Thông báo & cập nhật</div>
            <Link href="/notifications" className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline">Xem tất cả</Link>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {notifications.length === 0 && <EmptyState text="Chưa có thông báo mới." icon={<Bell className="h-5 w-5 text-slate-400" />} />}
            {notifications.slice(0, 4).map((n) => (
              <div key={n.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate">{n.title}</div>
                <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{n.message}</div>
                <div className="text-[11px] text-slate-500 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-slate-900 dark:text-white">Bài tập sắp tới</div>
            <Link href="/assignments/calendar" className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline">Xem tất cả</Link>
          </div>
          <div className="space-y-3">
            <EmptyState text="Chưa có bài tập sắp tới." icon={<BookOpen className="h-5 w-5 text-slate-400" />} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="font-semibold text-slate-900 dark:text-white mb-3">Hoạt động nhanh</div>
          <div className="space-y-2">
            <QuickLink href="/classrooms" icon={<Users className="h-4 w-4" />} label="Xem lớp của tôi" />
            <QuickLink href="/assignments/calendar" icon={<CalendarDays className="h-4 w-4" />} label="Xem lịch hạn nộp" />
            <QuickLink href="/submissions/my" icon={<Inbox className="h-4 w-4" />} label="Bài nộp của tôi" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function QuickStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm flex items-center gap-2 dark:border-slate-700 dark:bg-slate-900/70 dark:shadow-slate-900/40">
      <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">{icon}</div>
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-white">{value}</div>
        <div className="text-xs text-slate-600 dark:text-slate-300">{label}</div>
      </div>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 transition-colors hover:bg-indigo-50 hover:border-indigo-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-indigo-900/40 dark:hover:border-indigo-700"
    >
      <span className="flex items-center gap-2">{icon}{label}</span>
      <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-400" />
    </Link>
  );
}

function EmptyState({ text, icon }: { text: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 dark:text-slate-300 dark:border-slate-700 dark:bg-slate-900/40">
      {icon}
      <span>{text}</span>
    </div>
  );
}
