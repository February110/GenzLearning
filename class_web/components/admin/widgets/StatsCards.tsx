"use client";

import { Activity, FileText, GraduationCap, NotebookPen, TrendingUp, Users } from "lucide-react";
import clsx from "clsx";

type Card = {
  title: string;
  value: string | number;
  description?: string;
  icon: any;
  color: "emerald" | "amber" | "purple" | "sky" | "rose" | "indigo";
};

const colorStyles: Record<Card["color"], { badge: string; icon: string }> = {
  emerald: {
    badge: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  amber: {
    badge: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300",
    icon: "text-amber-600 dark:text-amber-400",
  },
  purple: {
    badge: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300",
    icon: "text-purple-600 dark:text-purple-400",
  },
  sky: {
    badge: "bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300",
    icon: "text-sky-600 dark:text-sky-400",
  },
  rose: {
    badge: "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300",
    icon: "text-rose-600 dark:text-rose-400",
  },
  indigo: {
    badge: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300",
    icon: "text-indigo-600 dark:text-indigo-400",
  },
};

export default function StatsCards({
  totals,
}: {
  totals: {
    users: number;
    classes: number;
    assignments: number;
    submissions: number;
    dailyVisits: number;
    weeklyVisits: number;
    growthRate: number;
  };
}) {
  const cards: Card[] = [
    { title: "Người dùng", value: totals.users, description: "Tổng số tài khoản hoạt động", icon: Users, color: "emerald" },
    { title: "Lớp học", value: totals.classes, description: "Không gian Classroom đang mở", icon: GraduationCap, color: "amber" },
    { title: "Bài tập", value: totals.assignments, description: "Đã được tạo bởi giáo viên", icon: NotebookPen, color: "purple" },
    { title: "Bài nộp", value: totals.submissions, description: "Học viên đã nộp trong hệ thống", icon: FileText, color: "sky" },
    { title: "Lượt truy cập (ngày)", value: totals.dailyVisits, description: `Tuần: ${totals.weeklyVisits}`, icon: Activity, color: "rose" },
    { title: "Tăng trưởng", value: `${totals.growthRate}%`, description: "So với tháng trước", icon: TrendingUp, color: "indigo" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((c, idx) => (
        <div key={idx} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center gap-3">
            <div className={clsx("h-9 w-9 grid place-items-center rounded-lg", colorStyles[c.color].badge)}>
              <c.icon size={18} className={colorStyles[c.color].icon} />
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{c.title}</div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-2xl font-semibold">{c.value}</div>
          </div>
          {c.description && <div className="text-xs text-gray-500 dark:text-gray-400">{c.description}</div>}
        </div>
      ))}
    </div>
  );
}
