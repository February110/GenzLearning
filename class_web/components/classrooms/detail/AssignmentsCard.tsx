 "use client";

import api from "@/api/client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
 import { useRouter } from "next/navigation";
 import React, { useEffect, useMemo, useState } from "react";
 import dayjs from "dayjs";
 import relativeTime from "dayjs/plugin/relativeTime";
import { ArrowLeft, ClipboardList, MoreVertical, Plus, Repeat2, X } from "lucide-react";
import { toast } from "react-hot-toast";

 dayjs.extend(relativeTime);

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "L";
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  return (first + last).toUpperCase();
}

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
   assignmentType?: string;
   AssignmentType?: string;
   status?: string;
   Status?: string;
   quizQuestionCount?: number;
   QuizQuestionCount?: number;
    quizTimeLimitMinutes?: number;
    QuizTimeLimitMinutes?: number;
    allowedFileTypes?: string | null;
    AllowedFileTypes?: string | null;
    maxFileSizeBytes?: number | null;
    MaxFileSizeBytes?: number | null;
    groupEnabled?: boolean;
    GroupEnabled?: boolean;
    groupMinMembers?: number | null;
    GroupMinMembers?: number | null;
    groupMaxMembers?: number | null;
    GroupMaxMembers?: number | null;
    groupMode?: string | null;
    GroupMode?: string | null;
  }

type ClassOption = {
  id: string;
  name: string;
  teacherName?: string;
  createdAt?: string;
};

type AssignmentReuseDraft = {
  sourceId: string;
  title: string;
  instructions?: string | null;
  dueAt?: string | null;
  maxPoints?: number;
  allowedFileTypes?: string | null;
  maxFileSizeMb?: number | "";
  groupEnabled?: boolean;
  groupMinMembers?: number | "";
  groupMaxMembers?: number | "";
  groupMode?: "student" | "random";
  assignmentType?: string;
  materials?: any[];
};

  interface AssignmentsCardProps {
  classroomId: string;
  assignments: AssignmentDto[];
  submissions?: Record<string, any>;
  isTeacher: boolean;
  onCreate: () => void;
  onReuse?: (draft: AssignmentReuseDraft) => void;
  onEdit: (assignment: AssignmentDto) => void;
  onDelete: (assignmentId: string) => void;
}

export default function AssignmentsCard({
  classroomId,
  assignments,
  submissions = {},
  isTeacher,
  onCreate,
  onReuse,
  onEdit,
  onDelete,
}: AssignmentsCardProps) {
   const router = useRouter();
   const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
   const [reuseOpen, setReuseOpen] = useState(false);
   const [reuseStep, setReuseStep] = useState<"class" | "assignment">("class");
   const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
   const [classLoading, setClassLoading] = useState(false);
   const [selectedClass, setSelectedClass] = useState<ClassOption | null>(null);
   const [reuseAssignments, setReuseAssignments] = useState<AssignmentDto[]>([]);
   const [selectedReuseAssignment, setSelectedReuseAssignment] = useState<AssignmentDto | null>(null);
   const [reuseLoading, setReuseLoading] = useState(false);
   const [reuseSubmitting, setReuseSubmitting] = useState(false);

   const getAssignmentId = (assignment: AssignmentDto | null | undefined) => assignment?.id ?? assignment?.Id ?? "";
   const getAssignmentTitle = (assignment: AssignmentDto | null | undefined) => assignment?.title ?? assignment?.Title ?? "Bài tập";

   useEffect(() => {
     if (!reuseOpen) return;
     setReuseStep("class");
     setSelectedClass(null);
     setReuseAssignments([]);
     setSelectedReuseAssignment(null);
     (async () => {
       try {
         setClassLoading(true);
         const { data } = await api.get("/classrooms");
         const currentId = String(classroomId || "").toLowerCase();
         const options = (Array.isArray(data) ? data : [])
           .map((c: any) => ({
             id: String(c.classroomId || c.ClassroomId || c.id || c.Id || ""),
             name: c.name || c.Name || "",
             role: (c.role || c.Role || "").toString().toLowerCase(),
             teacherName:
               c.teacherName ||
               c.TeacherName ||
               c.ownerName ||
               c.OwnerName ||
               c.teacher?.fullName ||
               c.Teacher?.FullName ||
               "",
             createdAt: c.createdAt || c.CreatedAt || "",
           }))
           .filter((c: any) => c.id && c.role === "teacher" && c.id.toLowerCase() !== currentId)
           .map((c: any) => ({
             id: c.id,
             name: c.name,
             teacherName: c.teacherName,
             createdAt: c.createdAt,
           }));
         setClassOptions(options);
       } catch {
         setClassOptions([]);
       } finally {
         setClassLoading(false);
       }
     })();
   }, [classroomId, reuseOpen]);

   async function loadReuseAssignments(cls: ClassOption) {
     try {
       setReuseLoading(true);
       const { data } = await api.get(`/assignments/classroom/${cls.id}`);
       setReuseAssignments(Array.isArray(data) ? data : []);
     } catch {
       setReuseAssignments([]);
     } finally {
       setReuseLoading(false);
     }
   }

   async function handleSelectClass(cls: ClassOption) {
     setSelectedClass(cls);
     setReuseStep("assignment");
     setSelectedReuseAssignment(null);
     await loadReuseAssignments(cls);
   }

   function handleSelectAssignment(assignment: AssignmentDto) {
     const assignmentId = getAssignmentId(assignment);
     setSelectedReuseAssignment((prev) => (getAssignmentId(prev) === assignmentId ? null : assignment));
   }

   async function handleUseSelectedAssignment() {
     const sourceId = getAssignmentId(selectedReuseAssignment);
     if (!sourceId || !onReuse) return;

     try {
       setReuseSubmitting(true);
       const [detailResp, materialsResp] = await Promise.all([
         api.get(`/assignments/${sourceId}`),
         api.get(`/assignments/${sourceId}/materials`).catch(() => ({ data: [] })),
       ]);
       const detail = detailResp.data || {};
       const maxBytes = detail.maxFileSizeBytes ?? detail.MaxFileSizeBytes ?? selectedReuseAssignment?.maxFileSizeBytes ?? selectedReuseAssignment?.MaxFileSizeBytes;
       const groupModeRaw = (detail.groupMode ?? detail.GroupMode ?? selectedReuseAssignment?.groupMode ?? selectedReuseAssignment?.GroupMode ?? "student").toString().toLowerCase();

       onReuse({
         sourceId,
         title: detail.title ?? detail.Title ?? getAssignmentTitle(selectedReuseAssignment),
         instructions: detail.instructions ?? detail.Instructions ?? selectedReuseAssignment?.instructions ?? selectedReuseAssignment?.Instructions ?? "",
         dueAt: detail.dueAt ?? detail.DueAt ?? selectedReuseAssignment?.dueAt ?? selectedReuseAssignment?.DueAt ?? null,
         maxPoints: detail.maxPoints ?? detail.MaxPoints ?? selectedReuseAssignment?.maxPoints ?? selectedReuseAssignment?.MaxPoints ?? 100,
         allowedFileTypes: detail.allowedFileTypes ?? detail.AllowedFileTypes ?? selectedReuseAssignment?.allowedFileTypes ?? selectedReuseAssignment?.AllowedFileTypes ?? "",
         maxFileSizeMb: maxBytes ? Math.round(Number(maxBytes) / (1024 * 1024)) : "",
         groupEnabled: !!(detail.groupEnabled ?? detail.GroupEnabled ?? selectedReuseAssignment?.groupEnabled ?? selectedReuseAssignment?.GroupEnabled),
         groupMinMembers: detail.groupMinMembers ?? detail.GroupMinMembers ?? selectedReuseAssignment?.groupMinMembers ?? selectedReuseAssignment?.GroupMinMembers ?? 2,
         groupMaxMembers: detail.groupMaxMembers ?? detail.GroupMaxMembers ?? selectedReuseAssignment?.groupMaxMembers ?? selectedReuseAssignment?.GroupMaxMembers ?? "",
         groupMode: groupModeRaw === "random" ? "random" : "student",
         assignmentType: detail.assignmentType ?? detail.AssignmentType ?? selectedReuseAssignment?.assignmentType ?? selectedReuseAssignment?.AssignmentType ?? "standard",
         materials: Array.isArray(materialsResp.data) ? materialsResp.data : [],
       });
       setReuseOpen(false);
     } catch (err: any) {
       toast.error(err?.response?.data?.message || "Không thể sử dụng lại bài tập này.");
     } finally {
       setReuseSubmitting(false);
     }
   }

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
         normalizedType: item.assignmentType ?? item.AssignmentType ?? "standard",
         normalizedStatus: item.status ?? item.Status ?? "published",
         normalizedQuizQuestionCount: item.quizQuestionCount ?? item.QuizQuestionCount ?? null,
         normalizedQuizTimeLimitMinutes: item.quizTimeLimitMinutes ?? item.QuizTimeLimitMinutes ?? null,
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
        {isTeacher && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="md" className="!rounded-full" onClick={onCreate}>
              <Plus className="h-4 w-4 mr-2" /> Tạo bài tập
            </Button>
            <Button variant="outline" size="md" className="!rounded-full" onClick={() => setReuseOpen(true)}>
              <Repeat2 className="h-4 w-4 mr-2" /> Đăng lại
            </Button>
          </div>
        )}
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
              normalizedType,
              normalizedStatus,
              normalizedQuizQuestionCount,
              normalizedQuizTimeLimitMinutes,
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
            const isAiQuiz = String(normalizedType).toLowerCase() === "ai_quiz";
            const statusLower = String(normalizedStatus || "published").toLowerCase();
            const statusText = statusLower === "draft" ? "Nháp" : statusLower === "closed" ? "Đã đóng" : null;
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
                      {isAiQuiz && (
                        <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-violet-100 text-violet-700">
                          Trắc nghiệm
                        </span>
                      )}
                      {statusText && (
                        <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-gray-100 text-gray-600">
                          {statusText}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex flex-wrap gap-2">
                      <span>Hạn: {due ? due.format("HH:mm DD/MM") : "Không có"}</span>
                      <span>·</span>
                      <span>{isAiQuiz ? `${normalizedQuizQuestionCount || 0} câu` : `${normalizedPoints} điểm tối đa`}</span>
                      {isAiQuiz && normalizedQuizTimeLimitMinutes ? (
                        <>
                          <span>·</span>
                          <span>{normalizedQuizTimeLimitMinutes} phút</span>
                        </>
                      ) : null}
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
      {reuseOpen && (
        <ReuseAssignmentModal
          step={reuseStep}
          classOptions={classOptions}
          classLoading={classLoading}
          selectedClass={selectedClass}
          assignments={reuseAssignments}
          assignmentsLoading={reuseLoading}
          selectedAssignmentId={getAssignmentId(selectedReuseAssignment)}
          submitting={reuseSubmitting}
          onSelectClass={handleSelectClass}
          onSelectAssignment={handleSelectAssignment}
          onUse={handleUseSelectedAssignment}
          onBack={() => {
            setReuseStep("class");
            setSelectedReuseAssignment(null);
          }}
          onClose={() => setReuseOpen(false)}
        />
      )}
    </Card>
  );
 }

function ReuseAssignmentModal({
  step,
  classOptions,
  classLoading,
  selectedClass,
  assignments,
  assignmentsLoading,
  selectedAssignmentId,
  submitting,
  onSelectClass,
  onSelectAssignment,
  onUse,
  onBack,
  onClose,
}: {
  step: "class" | "assignment";
  classOptions: ClassOption[];
  classLoading: boolean;
  selectedClass: ClassOption | null;
  assignments: AssignmentDto[];
  assignmentsLoading: boolean;
  selectedAssignmentId: string;
  submitting: boolean;
  onSelectClass: (cls: ClassOption) => void;
  onSelectAssignment: (assignment: AssignmentDto) => void;
  onUse: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const getAssignmentId = (assignment: AssignmentDto) => assignment.id ?? assignment.Id ?? "";
  const getAssignmentTitle = (assignment: AssignmentDto) => assignment.title ?? assignment.Title ?? "Bài tập";
  const stepLabel = step === "class" ? "Chọn lớp" : "Chọn bài tập";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative mx-auto max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-slate-50 px-5 py-4 dark:border-gray-800 dark:bg-zinc-950/80">
          <div className="flex min-w-0 items-start gap-3">
            {step === "assignment" ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-zinc-900 dark:text-gray-300 dark:hover:bg-zinc-800"
                title="Chọn lớp khác"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                <Repeat2 className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold text-gray-900 dark:text-gray-100">Đăng lại bài tập</div>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100 dark:bg-zinc-900 dark:text-indigo-300 dark:ring-indigo-900">
                  {stepLabel}
                </span>
              </div>
              <div className="mt-1 truncate text-xs text-gray-600 dark:text-gray-400">
                {step === "class" ? "Sử dụng lại các bài tập trong lớp học bạn giảng dạy." : selectedClass?.name || "Lớp học"}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-zinc-800 dark:hover:text-gray-100"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "class" ? (
          <div className="p-5">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-zinc-900">
              <div className="overflow-x-auto">
                <div className="min-w-[620px]">
                  <div className="grid grid-cols-[1.6fr_1fr_0.9fr] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-zinc-950 dark:text-gray-400">
                    <div>Lớp học</div>
                    <div>Giáo viên</div>
                    <div>Ngày tạo</div>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                    {classLoading ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">Đang tải lớp...</div>
                    ) : classOptions.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">Không có lớp để chọn.</div>
                    ) : (
                      classOptions.map((c) => {
                        const teacherName = c.teacherName || "Giáo viên";
                        const dateLabel = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "-";
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => onSelectClass(c)}
                            className="grid w-full grid-cols-[1.6fr_1fr_0.9fr] items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-indigo-50/70 focus:bg-indigo-50 focus:outline-none dark:hover:bg-indigo-950/30 dark:focus:bg-indigo-950/30"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white shadow-sm">
                                {getInitials(c.name || "L")}
                              </div>
                              <span className="truncate font-medium text-gray-900 dark:text-gray-100">{c.name}</span>
                            </div>
                            <div className="truncate text-xs text-gray-600 dark:text-gray-300">{teacherName}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{dateLabel}</div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-zinc-900">
              <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                  <div className="grid grid-cols-[36px_1.6fr_0.9fr_0.9fr] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-zinc-950 dark:text-gray-400">
                    <div />
                    <div>Bài tập</div>
                    <div>Hạn nộp</div>
                    <div>Loại</div>
                  </div>
                  <div className="max-h-[360px] min-h-[240px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                    {assignmentsLoading ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">Đang tải bài tập...</div>
                    ) : assignments.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">Lớp này chưa có bài tập.</div>
                    ) : (
                      assignments.map((assignment) => {
                        const id = getAssignmentId(assignment);
                        const due = assignment.dueAt ?? assignment.DueAt ?? null;
                        const type = String(assignment.assignmentType ?? assignment.AssignmentType ?? "standard").toLowerCase();
                        const checked = selectedAssignmentId === id;

                        return (
                          <label
                            key={id}
                            className={`grid cursor-pointer grid-cols-[36px_1.6fr_0.9fr_0.9fr] items-center gap-3 px-4 py-3 text-sm transition ${
                              checked
                                ? "bg-indigo-50 dark:bg-indigo-950/30"
                                : "hover:bg-gray-50 dark:hover:bg-zinc-800/60"
                            }`}
                          >
                            <input
                              type="radio"
                              name="reuseAssignment"
                              className="h-4 w-4 text-indigo-600"
                              checked={checked}
                              onChange={() => onSelectAssignment(assignment)}
                            />
                            <div className="min-w-0">
                              <div className="truncate font-medium text-gray-900 dark:text-gray-100">{getAssignmentTitle(assignment)}</div>
                              <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                                {type === "ai_quiz" ? `${assignment.quizQuestionCount ?? assignment.QuizQuestionCount ?? 0} câu hỏi` : `${assignment.maxPoints ?? assignment.MaxPoints ?? 100} điểm tối đa`}
                              </div>
                            </div>
                            <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                              {due ? dayjs(due).format("HH:mm DD/MM") : "Không có"}
                            </div>
                            <div className="truncate text-xs text-gray-600 dark:text-gray-300">
                              {type === "ai_quiz" ? "Trắc nghiệm" : "Nộp file"}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-zinc-950">
              <Button type="button" size="md" className="!rounded-full" disabled={!selectedAssignmentId || submitting} onClick={onUse}>
                {submitting ? "Đang mở..." : "Sử dụng lại"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
