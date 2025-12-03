"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/api/client";
import Link from "next/link";
import { Bell, BookOpen, CalendarDays, ChevronRight, GraduationCap, Inbox, Users } from "lucide-react";

type Classroom = { classroomId: string; name: string; role?: string };
type NotificationItem = { id: string; title: string; message: string; createdAt: string };

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm ${className}`}>
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
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Chào mừng trở lại, {displayName}!</h1>
          <p className="text-sm text-gray-500">Cùng xem nhanh hoạt động chính của lớp học.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Chào mừng trở lại</div>
              <div className="text-xl font-semibold text-gray-900">Chúc bạn một ngày hiệu quả!</div>
            </div>
            <div className="flex gap-3">
              <QuickStat icon={<GraduationCap className="h-5 w-5 text-indigo-600" />} label="Lớp đang dạy" value={teachCount} />
              <QuickStat icon={<Users className="h-5 w-5 text-emerald-600" />} label="Lớp đang học" value={learnCount} />
              <QuickStat icon={<CalendarDays className="h-5 w-5 text-amber-600" />} label="Thông báo mới" value={notifications.length} />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-gray-900">Thông báo & cập nhật</div>
            <Link href="/notifications" className="text-xs text-indigo-600 hover:underline">Xem tất cả</Link>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {notifications.length === 0 && <EmptyState text="Chưa có thông báo mới." icon={<Bell className="h-5 w-5 text-gray-400" />} />}
            {notifications.slice(0, 4).map((n) => (
              <div key={n.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <div className="text-sm font-semibold text-gray-800 truncate">{n.title}</div>
                <div className="text-xs text-gray-500 line-clamp-2">{n.message}</div>
                <div className="text-[11px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-gray-900">Bài tập sắp tới</div>
            <Link href="/assignments/calendar" className="text-xs text-indigo-600 hover:underline">Xem tất cả</Link>
          </div>
          <div className="space-y-3">
            <EmptyState text="Chưa có bài tập sắp tới." icon={<BookOpen className="h-5 w-5 text-gray-400" />} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="font-semibold text-gray-900 mb-3">Hoạt động nhanh</div>
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
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm flex items-center gap-2">
      <div className="rounded-lg bg-gray-50 p-2">{icon}</div>
      <div>
        <div className="text-sm font-semibold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-800 hover:bg-indigo-50 hover:border-indigo-100"
    >
      <span className="flex items-center gap-2">{icon}{label}</span>
      <ChevronRight className="h-4 w-4 text-gray-400" />
    </Link>
  );
}

function EmptyState({ text, icon }: { text: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2">
      {icon}
      <span>{text}</span>
    </div>
  );
}
