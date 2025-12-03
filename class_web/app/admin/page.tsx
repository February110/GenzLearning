"use client";

import Link from "next/link";
import StatsCards from "@/components/admin/widgets/StatsCards";
import useAdminOverview from "@/hooks/useAdminOverview";
import {
  Activity,
  AlertTriangle,
  ArrowUpRightSquare,
  Bell,
  CheckCircle2,
  GraduationCap,
  LogIn,
  MessageCircle,
  NotebookPen,
  Target,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";

type ActivityMeta = {
  label: string;
  icon: any;
  iconBg: string;
  badge: string;
  iconColor: string;
};

const activityMeta: Record<string, ActivityMeta> = {
  assignment: { label: "Bài tập mới", icon: NotebookPen, iconBg: "bg-amber-50", badge: "bg-amber-100 text-amber-700 border border-amber-200", iconColor: "text-amber-600" },
  submission: { label: "Bài nộp", icon: Users, iconBg: "bg-sky-50", badge: "bg-sky-100 text-sky-700 border border-sky-200", iconColor: "text-sky-600" },
  grade: { label: "Chấm điểm", icon: CheckCircle2, iconBg: "bg-emerald-50", badge: "bg-emerald-100 text-emerald-700 border border-emerald-200", iconColor: "text-emerald-600" },
  class: { label: "Lớp học", icon: GraduationCap, iconBg: "bg-indigo-50", badge: "bg-indigo-100 text-indigo-700 border border-indigo-200", iconColor: "text-indigo-600" },
  login: { label: "Đăng nhập", icon: LogIn, iconBg: "bg-teal-50", badge: "bg-teal-100 text-teal-700 border border-teal-200", iconColor: "text-teal-600" },
  register: { label: "Đăng ký", icon: UserPlus, iconBg: "bg-fuchsia-50", badge: "bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200", iconColor: "text-fuchsia-600" },
  announcement: { label: "Thông báo", icon: Bell, iconBg: "bg-orange-50", badge: "bg-orange-100 text-orange-700 border border-orange-200", iconColor: "text-orange-600" },
  "announcement-comment": { label: "Nhận xét thông báo", icon: MessageCircle, iconBg: "bg-purple-50", badge: "bg-purple-100 text-purple-700 border border-purple-200", iconColor: "text-purple-600" },
};

export default function AdminDashboard() {
  const { overview, loading } = useAdminOverview();
  const activityList = overview.activities.slice(0, 12);

  const parseUtcDate = (value: string) => {
    if (!value) return new Date();
    return new Date(value.endsWith("Z") ? value : `${value}Z`);
  };

  const formatTime = (value: string) =>
    parseUtcDate(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });

  const qualityCards = [
    { title: "Điểm trung bình", value: `${overview.quality.averageScore || 0}/100`, description: "Tất cả bài đã chấm", icon: Target, tint: "bg-gradient-to-r from-emerald-50 to-white" },
    { title: "Tỉ lệ hoàn thành", value: `${overview.quality.completionRate}%`, description: "Bài nộp / Bài tập", icon: Trophy, tint: "bg-gradient-to-r from-sky-50 to-white" },
    { title: "Bài tập quá hạn", value: overview.quality.overdueAssignments, description: "Chưa có bài nộp", icon: AlertTriangle, tint: "bg-gradient-to-r from-rose-50 to-white" },
    {
      title: "Lớp nổi bật",
      value: overview.quality.mostActiveClass ? overview.quality.mostActiveClass.name : "Chưa có dữ liệu",
      description: overview.quality.mostActiveClass ? `${overview.quality.mostActiveClass.submissions} bài nộp tuần này` : "Chờ dữ liệu mới",
      icon: GraduationCap,
      tint: "bg-gradient-to-r from-indigo-50 to-white",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {loading && (
            <span className="flex items-center gap-1">
              <Activity size={14} /> Đang cập nhật...
            </span>
          )}
        </div>
      </div>

      <StatsCards totals={overview.totals} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-700 font-semibold">Hoạt động gần đây</p>
              <div className="text-sm text-gray-500">Realtime feed</div>
            </div>
          </div>
          {activityList.length === 0 ? (
            <p className="text-sm text-gray-500">Chưa ghi nhận hoạt động.</p>
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-3 top-6 bottom-6 w-px bg-gray-100 dark:bg-zinc-800" />
              <ul className="space-y-4">
                {activityList.map((item, idx) => {
                  const meta = activityMeta[item.type] ?? { label: "Hoạt động", icon: Activity, iconBg: "bg-gray-100", badge: "bg-gray-100 text-gray-600 border border-gray-200", iconColor: "text-gray-500" };
                  const Icon = meta.icon;
                  return (
                    <li key={`${item.type}-${item.timestamp}-${idx}`} className="relative pl-4">
                      <div className="absolute -left-[30px] top-1 h-9 w-9 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-900 grid place-items-center">
                        <div className={`h-7 w-7 rounded-full ${meta.iconBg} grid place-items-center`}>
                          <Icon size={16} className={meta.iconColor} />
                        </div>
                      </div>
                      <article className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-4 py-3">
                        <div className="flex items-start gap-4">
                          <div className="text-xs text-gray-400 whitespace-nowrap w-24">{formatTime(item.timestamp)}</div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.actor}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{item.action}</p>
                            <p className="text-xs text-gray-500">{item.context || "Hệ thống"}</p>
                          </div>
                          <div className={`inline-flex items-center rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-[11px] font-medium ${meta.badge}`}>{meta.label}</div>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="mt-4 text-right">
            <Link href="/admin/analytics" className="text-xs font-medium text-indigo-600 hover:underline">
              Đi tới bảng phân tích →
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-4 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-700 font-semibold">Chỉ số chất lượng</p>
            <div className="text-sm text-gray-500">Hiệu quả học tập</div>
          </div>
          <div className="grid gap-3">
            {qualityCards.map((card) => (
              <article key={card.title} className={`flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 ${card.tint} p-3`}>
                <div className="h-9 w-9 rounded-lg bg-white/90 dark:bg-zinc-900/70 grid place-items-center shadow-sm">
                  <card.icon size={18} className="text-gray-600 dark:text-gray-300" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">{card.title}</div>
                  <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{card.value}</div>
                  <div className="text-xs text-gray-500">{card.description}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
