 "use client";

 import Card from "@/components/ui/Card";
 import { useRouter } from "next/navigation";
 import React, { useEffect, useMemo, useState } from "react";
 import dayjs from "dayjs";
 import relativeTime from "dayjs/plugin/relativeTime";
 import { ClipboardList, MoreVertical } from "lucide-react";

 dayjs.extend(relativeTime);

 interface AssignmentDto {
   id?: string;
   Id?: string;
   title?: string;
   Title?: string;
   dueAt?: string | null;
   DueAt?: string | null;
   createdAt?: string;
   CreatedAt?: string;
   instructions?: string;
   Instructions?: string;
   maxPoints?: number;
   MaxPoints?: number;
 }

interface AssignmentsCardProps {
  assignments: AssignmentDto[];
  submissions?: Record<string, any>;
  isTeacher: boolean;
  onEdit: (assignment: AssignmentDto) => void;
  onDelete: (assignmentId: string) => void;
}

export default function AssignmentsCard({
  assignments,
  submissions = {},
  isTeacher,
  onEdit,
  onDelete,
}: AssignmentsCardProps) {
   const router = useRouter();
   const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

   useEffect(() => {
     const handleDocClick = (event: MouseEvent) => {
       const target = event.target as HTMLElement;
       if (!target.closest("[data-assignment-menu]")) {
         setMenuOpenId(null);
       }
     };

     document.addEventListener("click", handleDocClick);
     return () => document.removeEventListener("click", handleDocClick);
   }, []);

   const normalizedAssignments = useMemo(() => {
     return [...(assignments ?? [])]
       .map((item) => ({
         ...item,
         normalizedId: item.id ?? item.Id ?? "",
         normalizedTitle: item.title ?? item.Title ?? "Bài tập",
         normalizedDue: item.dueAt ?? item.DueAt ?? null,
         normalizedCreated: item.createdAt ?? item.CreatedAt ?? null,
         normalizedInstructions: item.instructions ?? item.Instructions ?? "",
         normalizedPoints: item.maxPoints ?? item.MaxPoints ?? 100,
       }))
       .sort((a, b) => {
         const ta = new Date(a.normalizedCreated || 0).getTime();
         const tb = new Date(b.normalizedCreated || 0).getTime();
         return tb - ta;
       });
   }, [assignments]);

   const handleCardClick = (assignmentId: string) => {
     if (!assignmentId) return;
     router.push(`/assignments/${assignmentId}`);
   };

   return (
     <Card className="lg:col-span-2 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-500">Tổng cộng</p>
          <h2 className="text-xl font-semibold">{normalizedAssignments.length} bài tập</h2>
        </div>
      </div>

      {normalizedAssignments.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">Chưa có bài tập nào.</p>
      ) : (
        <div className="space-y-3">
          {normalizedAssignments.map((assignment) => {
            const {
              normalizedId,
              normalizedTitle,
              normalizedDue,
              normalizedInstructions,
              normalizedPoints,
            } = assignment;

            const due = normalizedDue ? dayjs(normalizedDue) : null;
            const overdueRaw = due ? due.isBefore(dayjs()) : false;
            const dueSoonRaw = due ? !overdueRaw && due.diff(dayjs(), "hour") <= 48 : false;
            const overdue = isTeacher ? false : overdueRaw;
            const dueSoon = isTeacher ? false : dueSoonRaw;

            const submissionKey = normalizedId.toLowerCase();
            const submission = submissions[submissionKey];
            const submittedAt = submission?.submittedAt ?? submission?.SubmittedAt;
            const submitted = Boolean(submission);

            const iconVariants = submitted
              ? "text-gray-400 bg-gray-100 border-gray-200"
              : overdue
              ? "text-rose-500 bg-rose-100 border-rose-200"
              : dueSoon
              ? "text-amber-600 bg-amber-50 border-amber-200"
              : "text-indigo-600 bg-indigo-50 border-indigo-100";

            const rowAccent = overdue
              ? "border-rose-200 bg-rose-50 dark:bg-rose-950/20"
              : dueSoon
              ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20"
              : "border-gray-100 bg-white dark:bg-zinc-900/40";

            let badgeStyles = overdue
              ? "bg-rose-100 text-rose-600"
              : dueSoon
              ? "bg-amber-100 text-amber-700"
              : "bg-emerald-100 text-emerald-700";

            let badgeText: string | null = null;
            if (due) {
              if (isTeacher) {
                if (overdueRaw) {
                  badgeText = "Đã kết thúc";
                  badgeStyles = "bg-gray-100 text-gray-600";
                } else if (dueSoonRaw) {
                  badgeText = "Sắp đến hạn";
                  badgeStyles = "bg-amber-100 text-amber-700";
                } else {
                  badgeText = null;
                }
              } else {
                badgeText = overdue ? "Đã quá hạn" : dueSoon ? "Sắp đến hạn" : "Đang mở";
              }
            }

            const sanitizedInstructions =
              normalizedInstructions?.replace(/<[^>]+>/g, "").trim() ?? "";

            return (
              <div
                key={normalizedId}
                className={`relative rounded-2xl border ${rowAccent} px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/20 cursor-pointer`}
                onClick={() => handleCardClick(normalizedId)}
                data-assignment-card
              >
                <div className="flex items-start gap-3 pr-10">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border ${iconVariants}`}
                  >
                    <ClipboardList size={18} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {normalizedTitle}
                      </span>
                      {badgeText && (
                        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${badgeStyles}`}>
                          {badgeText}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex flex-wrap gap-2">
                      <span>Hạn: {due ? due.format("HH:mm DD/MM") : "Không có"}</span>
                      <span>·</span>
                      <span>{normalizedPoints} điểm tối đa</span>
                      {!isTeacher && submitted && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            Đã nộp {submittedAt ? dayjs(submittedAt).fromNow() : ""}
                          </span>
                        </>
                      )}
                    </div>
                    {sanitizedInstructions && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                        {sanitizedInstructions}
                      </p>
                    )}
                  </div>
                </div>

                {isTeacher && (
                  <div
                    className="absolute top-2 right-2"
                    data-assignment-menu
                  >
                    <button
                      type="button"
                      aria-label="Tùy chọn bài tập"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-zinc-900 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setMenuOpenId((prev) => (prev === normalizedId ? null : normalizedId));
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>

                    {menuOpenId === normalizedId && (
                      <div className="absolute right-0 mt-2 w-40 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-950 shadow-lg py-1 z-20">
                        <button
                          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setMenuOpenId(null);
                            onEdit(assignment);
                          }}
                        >
                          Chỉnh sửa
                        </button>
                        <button
                          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setMenuOpenId(null);
                            onDelete(normalizedId);
                          }}
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
 }
