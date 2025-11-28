"use client";

import React from "react";
import { resolveAvatar } from "@/utils/resolveAvatar";

interface GradesTableProps {
  assignments: any[];
  members: any[];
}

export default function GradesTable({ assignments, members }: GradesTableProps) {
  const normalizedAssignments = assignments || [];
  const normalizedMembers = members || [];
  const assignmentCount = normalizedAssignments.length || 1;
  const studentColWidth = 220;
  const assignmentColWidth = 220;

  function renderCell(a: any, m: any) {
    const grade = (a.grades || a.Grades || []).find(
      (g: any) =>
        String(g.userId || g.UserId || "").toLowerCase() ===
        String(m.userId || m.UserId || "").toLowerCase()
    );
    if (!grade) return <span className="text-xs text-gray-500">Chưa nộp</span>;
    if (grade.status === "draft")
      return <span className="text-xs text-emerald-600">Bản nháp</span>;
    return (
      <div className="text-sm font-semibold text-gray-900 dark:text-white">
        {grade.score ?? grade.grade ?? "—"}
        <span className="text-xs text-gray-500">
          /{a.maxPoints ?? a.MaxPoints ?? 100}
        </span>
        <div className="text-xs text-gray-500">
          {grade.status === "pending" ? "Đang chấm" : "Hoàn thành"}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 w-full max-w-full overflow-hidden min-w-0">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-4 py-3">
        <div className="font-semibold text-gray-900 dark:text-white">Điểm bài tập</div>
        <button className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
          Sắp xếp theo họ
        </button>
      </div>

      <div className="w-full max-w-full overflow-x-auto">
        <div className="inline-block align-top pb-1">
          <div
            className="grid border-b border-gray-100 dark:border-gray-800 text-xs uppercase text-gray-500 dark:text-gray-400"
            style={{
              gridTemplateColumns: `${studentColWidth}px repeat(${assignmentCount}, ${assignmentColWidth}px)`,
            }}
          >
            <div className="px-4 py-3">Học viên</div>
            {normalizedAssignments.map((assignment) => (
              <div
                key={assignment.id || assignment.Id}
                className="px-4 py-3 border-l border-gray-100 dark:border-gray-800"
              >
                <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {assignment.title || assignment.Title || "Bài tập"}
                </div>
                <div className="text-xs text-gray-500">
                  Trên {assignment.maxPoints ?? assignment.MaxPoints ?? 100}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            {normalizedMembers.map((member) => (
              <div
                key={member.userId || member.UserId || member.email || member.Email}
                className="grid border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-zinc-950 last:border-none"
                style={{
                  gridTemplateColumns: `${studentColWidth}px repeat(${assignmentCount}, ${assignmentColWidth}px)`,
                }}
              >
                <div className="px-4 py-3 flex items-center gap-3 text-sm font-medium text-gray-900 dark:text-white">
                  {member.avatar || member.Avatar ? (
                    <img
                      src={
                        resolveAvatar(member.avatar || member.Avatar) ||
                        member.avatar ||
                        member.Avatar
                      }
                      alt={member.fullName || member.FullName || "Thành viên"}
                      className="h-8 w-8 rounded-full object-cover border border-white/30"
                    />
                  ) : (
                    <span className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 grid place-items-center text-xs uppercase">
                      {(
                        (member.fullName || member.FullName || "??").slice(0, 2) ||
                        "??"
                      ).toUpperCase()}
                    </span>
                  )}
                  <span>{member.fullName || member.FullName || "Không xác định"}</span>
                </div>
                {normalizedAssignments.map((assignment) => (
                  <div
                    key={(assignment.id || assignment.Id) + (member.userId || member.UserId || "")}
                    className="px-4 py-3 border-l border-gray-100 dark:border-gray-800"
                  >
                    {renderCell(assignment, member)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
