"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, BookOpen, ChevronDown, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import api from "@/api/client";
import Card from "@/components/ui/Card";
import { normalizeLectureTree, type LectureSection } from "@/lib/lectures";
import { toast } from "react-hot-toast";

type LecturePanelProps = {
  classroomId: string;
  isTeacher?: boolean;
};

export default function LecturePanel({ classroomId, isTeacher = false }: LecturePanelProps) {
  const router = useRouter();
  const [sections, setSections] = useState<LectureSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, string>>({});
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/classrooms/${classroomId}/lectures/tree`);
      const nextSections = normalizeLectureTree(data);
      setSections(nextSections);
      setSectionDrafts(Object.fromEntries(nextSections.map((section) => [section.id, section.title])));
      setExpanded((prev) => {
        const next = { ...prev };
        nextSections.forEach((section) => {
          if (next[section.id] === undefined) next[section.id] = nextSections.length <= 3;
        });
        return next;
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Không thể tải bài giảng.");
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => {
    if (!classroomId) return;
    load();
  }, [classroomId, load]);

  const allExpanded = useMemo(
    () => sections.length > 0 && sections.every((section) => expanded[section.id] !== false),
    [expanded, sections]
  );

  async function handleCreateSection() {
    const title = sectionTitle.trim();
    if (!title || busy) return;

    try {
      setBusy(true);
      await api.post(`/classrooms/${classroomId}/lectures/sections`, { title });
      setSectionTitle("");
      toast.success("Đã thêm chương.");
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Tạo chương thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSection(sectionId: string) {
    const title = (sectionDrafts[sectionId] || "").trim();
    if (!title || busy) return;

    try {
      setBusy(true);
      await api.patch(`/classrooms/${classroomId}/lectures/sections/${sectionId}`, { title });
      setEditingSectionId(null);
      toast.success("Đã cập nhật tên chương.");
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Cập nhật chương thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMoveSection(sectionId: string, direction: -1 | 1) {
    const currentIndex = sections.findIndex((section) => section.id === sectionId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sections.length || busy) return;

    try {
      setBusy(true);
      await api.patch(`/classrooms/${classroomId}/lectures/sections/${sectionId}`, {
        orderIndex: targetIndex + 1,
      });
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Không thể đổi vị trí chương.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSection(sectionId: string) {
    if (busy || !confirm("Bạn có chắc muốn xóa chương này?")) return;

    try {
      setBusy(true);
      await api.delete(`/classrooms/${classroomId}/lectures/sections/${sectionId}`);
      toast.success("Đã xóa chương.");
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Xóa chương thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateLesson(sectionId: string) {
    const title = (lessonTitle[sectionId] || "").trim();
    if (!title || busy) return;

    try {
      setBusy(true);
      const { data } = await api.post(`/classrooms/${classroomId}/lectures/sections/${sectionId}/lessons`, { title });
      const createdLessonId = String(data?.id ?? data?.Id ?? "");
      setLessonTitle((prev) => ({ ...prev, [sectionId]: "" }));
      toast.success("Đã thêm bài học.");
      await load();
      if (createdLessonId) {
        router.push(`/classrooms/${classroomId}/lectures/${createdLessonId}`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Thêm bài học thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMoveLesson(section: LectureSection, lessonId: string, direction: -1 | 1) {
    const currentIndex = section.lessons.findIndex((lesson) => lesson.id === lessonId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= section.lessons.length || busy) return;

    try {
      setBusy(true);
      await api.patch(`/classrooms/${classroomId}/lectures/lessons/${lessonId}`, {
        orderIndex: targetIndex + 1,
      });
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Không thể đổi vị trí bài học.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteLesson(lessonId: string) {
    if (busy || !confirm("Bạn có chắc muốn xóa bài học này?")) return;

    try {
      setBusy(true);
      await api.delete(`/classrooms/${classroomId}/lectures/lessons/${lessonId}`);
      toast.success("Đã xóa bài học.");
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Xóa bài học thất bại.");
    } finally {
      setBusy(false);
    }
  }

  function toggleAllSections() {
    const nextExpanded = !allExpanded;
    setExpanded(Object.fromEntries(sections.map((section) => [section.id, nextExpanded])));
  }

  function openLessonDashboard(lessonId: string) {
    router.push(`/classrooms/${classroomId}/lectures/${lessonId}`);
  }

  return (
    <Card className="overflow-hidden border border-slate-200 bg-white p-0 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-950 dark:text-white">Mục lục bài giảng</div>
            <div className="text-sm text-slate-500">Bấm vào từng bài học để mở dashboard nội dung riêng.</div>
          </div>

          {sections.length > 0 && (
            <button
              type="button"
              onClick={toggleAllSections}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              {allExpanded ? "Thu gọn tất cả" : "Mở rộng tất cả"}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-5 p-5">
        {isTeacher && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Tạo chương mới</div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={sectionTitle}
                onChange={(event) => setSectionTitle(event.target.value)}
                placeholder="Nhập tên chương"
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <button
                type="button"
                onClick={handleCreateSection}
                disabled={!sectionTitle.trim() || busy}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Thêm chương
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40">
            Đang tải danh sách bài giảng...
          </div>
        ) : sections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
            {isTeacher
              ? "Chưa có chương nào. Hãy tạo chương đầu tiên rồi thêm bài học vào bên trong."
              : "Giáo viên chưa thiết lập bài giảng cho lớp này."}
          </div>
        ) : (
          <div className="space-y-3">
            {sections.map((section, sectionIndex) => {
              const isExpanded = expanded[section.id] !== false;

              return (
                <div
                  key={section.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex items-center gap-3 px-4 py-4">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpanded((prev) => ({ ...prev, [section.id]: !isExpanded }))}
                      onKeyDown={(event) => {
                        const target = event.target as HTMLElement;
                        if (["INPUT", "TEXTAREA", "BUTTON", "SELECT", "A"].includes(target.tagName)) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setExpanded((prev) => ({ ...prev, [section.id]: !isExpanded }));
                        }
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300">
                        <BookOpen className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        {editingSectionId === section.id ? (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                              value={sectionDrafts[section.id] ?? ""}
                              onChange={(event) =>
                                setSectionDrafts((prev) => ({ ...prev, [section.id]: event.target.value }))
                              }
                              onClick={(event) => event.stopPropagation()}
                              className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                              placeholder="Tên chương"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleSaveSection(section.id);
                                }}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                              >
                                <Save className="h-3.5 w-3.5" />
                                Lưu
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setEditingSectionId(null);
                                  setSectionDrafts((prev) => ({ ...prev, [section.id]: section.title }));
                                }}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                              >
                                <X className="h-3.5 w-3.5" />
                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="truncate text-base font-semibold text-slate-950 dark:text-white">
                              {section.title}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">{section.lessons.length} bài học</div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isTeacher && editingSectionId !== section.id && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleMoveSection(section.id, -1)}
                            disabled={sectionIndex === 0 || busy}
                            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                            aria-label="Di chuyển chương lên"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveSection(section.id, 1)}
                            disabled={sectionIndex === sections.length - 1 || busy}
                            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                            aria-label="Di chuyển chương xuống"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSectionId(section.id);
                              setSectionDrafts((prev) => ({ ...prev, [section.id]: section.title }));
                            }}
                            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                            aria-label="Sửa chương"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSection(section.id)}
                            className="rounded-full border border-rose-200 p-2 text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/70 dark:hover:bg-rose-950/40"
                            aria-label="Xóa chương"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => ({ ...prev, [section.id]: !isExpanded }))}
                        className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                        aria-label={isExpanded ? "Thu gọn chương" : "Mở rộng chương"}
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/30">
                      <div className="space-y-2">
                        {section.lessons.map((lesson, lessonIndex) => (
                          <div
                            key={lesson.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => openLessonDashboard(lesson.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openLessonDashboard(lesson.id);
                              }
                            }}
                            className="flex cursor-pointer flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-sky-200 hover:bg-sky-50/40 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-sky-900 dark:hover:bg-sky-950/20 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                <BookOpen className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                  {lesson.title}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {lesson.videoKey ? "Có video nội dung" : "Chưa có video"} · Bấm để xem chi tiết
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {isTeacher && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleMoveLesson(section, lesson.id, -1);
                                    }}
                                    disabled={lessonIndex === 0 || busy}
                                    className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                                    aria-label="Di chuyển bài lên"
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleMoveLesson(section, lesson.id, 1);
                                    }}
                                    disabled={lessonIndex === section.lessons.length - 1 || busy}
                                    className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                                    aria-label="Di chuyển bài xuống"
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleDeleteLesson(lesson.id);
                                    }}
                                    className="rounded-full border border-rose-200 p-2 text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/70 dark:hover:bg-rose-950/40"
                                    aria-label="Xóa bài học"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}

                        {section.lessons.length === 0 && (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950">
                            Chương này chưa có bài học nào.
                          </div>
                        )}

                        {isTeacher && (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <input
                                value={lessonTitle[section.id] || ""}
                                onChange={(event) =>
                                  setLessonTitle((prev) => ({ ...prev, [section.id]: event.target.value }))
                                }
                                placeholder="Nhập tên bài học"
                                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={() => handleCreateLesson(section.id)}
                                disabled={!lessonTitle[section.id]?.trim() || busy}
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                              >
                                <Plus className="h-4 w-4" />
                                Thêm bài
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
