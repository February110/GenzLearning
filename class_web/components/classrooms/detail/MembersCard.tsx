"use client";

import Card from "@/components/ui/Card";
import React from "react";
import { resolveAvatar } from "@/utils/resolveAvatar";

interface MembersCardProps {
  members: any[];
}

export default function MembersCard({ members }: MembersCardProps) {
  const normalized = members || [];
  const teachers = normalized.filter((m: any) => (m.Role || m.role) === "Teacher");
  const students = normalized.filter((m: any) => (m.Role || m.role) !== "Teacher");

  function getInitials(name?: string) {
    if (!name) return "??";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(-2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  function getAvatar(member: any) {
    const raw =
      member?.Avatar ||
      member?.avatar ||
      member?.User?.Avatar ||
      member?.user?.avatar ||
      member?.photoUrl ||
      member?.PhotoUrl ||
      member?.image ||
      member?.picture;
    if (!raw) return undefined;
    return resolveAvatar(raw) || raw;
  }

  return (
    <Card className="p-5 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Thành viên</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {normalized.length} người tham gia · {teachers.length} giáo viên · {students.length} học viên
          </p>
        </div>
       
      </div>

      {teachers.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Giáo viên</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {teachers.map((m: any, idx: number) => (
              <div
                key={`teacher-${m.UserId || m.userId || idx}`}
                className="flex items-center gap-3 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/70 dark:bg-indigo-900/20 px-4 py-3"
              >
                {getAvatar(m) ? (
                  <img
                    src={getAvatar(m)}
                    alt={m.FullName || m.fullName || "Teacher"}
                    className="h-10 w-10 rounded-full object-cover border border-white/40"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold text-sm">
                    {getInitials(m.FullName || m.fullName || "")}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {m.FullName || m.fullName}
                  </div>
                  <div className="text-xs text-indigo-700 dark:text-indigo-200">Teacher</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">
            Học viên ({students.length})
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Sắp xếp theo tên</span>
        </div>
        {students.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-sm">Chưa có học viên nào.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {students.map((m: any, idx: number) => (
              <div
                key={`student-${m.UserId || m.userId || idx}`}
                className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950 px-4 py-3 shadow-sm"
              >
                {getAvatar(m) ? (
                  <img
                    src={getAvatar(m)}
                    alt={m.FullName || m.fullName || "Member"}
                    className="h-9 w-9 rounded-full object-cover border border-white/30"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 flex items-center justify-center text-xs font-semibold">
                    {getInitials(m.FullName || m.fullName || m.Email || m.email)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {m.FullName || m.fullName || "Không rõ"}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{m.Email || m.email || "—"}</div>
                </div>
                <span className="text-[11px] uppercase tracking-wide rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-gray-600 dark:text-gray-300">
                  Student
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
