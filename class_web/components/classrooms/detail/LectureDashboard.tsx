"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Clock3, Save, Upload, Video } from "lucide-react";
import api from "@/api/client";
import Card from "@/components/ui/Card";
import { normalizeLectureTree, type LectureSection } from "@/lib/lectures";
import { toast } from "react-hot-toast";

type LectureDashboardProps = {
  classroomId: string;
  lessonId: string;
  classroomName?: string;
  isTeacher?: boolean;
};

function bytesToSize(value?: number | null) {
  if (!value || value <= 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "Chưa ước tính";
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} giờ ${minutes} phút`;
  if (hours > 0) return `${hours} giờ`;
  return `${totalMinutes} phút`;
}

export default function LectureDashboard({
  classroomId,
  lessonId,
  classroomName,
  isTeacher = false,
}: LectureDashboardProps) {
  const router = useRouter();
  const [sections, setSections] = useState<LectureSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [lessonNameDraft, setLessonNameDraft] = useState("");
  const [lessonDescriptionDraft, setLessonDescriptionDraft] = useState("");
  const [lessonDurationMinutesDraft, setLessonDurationMinutesDraft] = useState("");
  const [lessonVideoUrl, setLessonVideoUrl] = useState<string | null>(null);
  const [lessonVideoLoading, setLessonVideoLoading] = useState(false);
  const [lessonVideoError, setLessonVideoError] = useState<string | null>(null);
  const [uploadingLessonId, setUploadingLessonId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/classrooms/${classroomId}/lectures/tree`);
      const nextSections = normalizeLectureTree(data);
      setSections(nextSections);
      setExpanded((prev) => {
        const next = { ...prev };
        nextSections.forEach((section) => {
          const hasCurrentLesson = section.lessons.some((lesson) => lesson.id === lessonId);
          if (next[section.id] === undefined || hasCurrentLesson) {
            next[section.id] = hasCurrentLesson;
          }
        });
        return next;
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Không thể tải dashboard bài giảng.");
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, [classroomId, lessonId]);

  useEffect(() => {
    if (!classroomId) return;
    load();
  }, [classroomId, load]);

  const selectedEntry = useMemo(() => {
    for (const section of sections) {
      for (const lesson of section.lessons) {
        if (lesson.id === lessonId) return { section, lesson };
      }
    }
    return null;
  }, [lessonId, sections]);

  const flatLessons = useMemo(
    () =>
      sections.flatMap((section) =>
        section.lessons.map((lesson) => ({
          section,
          lesson,
        }))
      ),
    [sections]
  );

  const selectedIndex = useMemo(
    () => flatLessons.findIndex((entry) => entry.lesson.id === lessonId),
    [flatLessons, lessonId]
  );

  const previousLesson = selectedIndex > 0 ? flatLessons[selectedIndex - 1] : null;
  const nextLesson = selectedIndex >= 0 && selectedIndex < flatLessons.length - 1 ? flatLessons[selectedIndex + 1] : null;

  useEffect(() => {
    if (!selectedEntry) {
      setLessonNameDraft("");
      setLessonDescriptionDraft("");
      setLessonDurationMinutesDraft("");
      return;
    }

    setLessonNameDraft(selectedEntry.lesson.title || "");
    setLessonDescriptionDraft(selectedEntry.lesson.description || "");
    setLessonDurationMinutesDraft(
      selectedEntry.lesson.durationSeconds && selectedEntry.lesson.durationSeconds > 0
        ? String(Math.max(1, Math.round(selectedEntry.lesson.durationSeconds / 60)))
        : ""
    );
  }, [selectedEntry]);

  useEffect(() => {
    let active = true;

    async function loadVideoUrl() {
      const key = selectedEntry?.lesson.videoKey;
      if (!key) {
        if (!active) return;
        setLessonVideoUrl(null);
        setLessonVideoError(null);
        setLessonVideoLoading(false);
        return;
      }

      try {
        if (!active) return;
        setLessonVideoLoading(true);
        setLessonVideoError(null);
        const { data } = await api.get("/submissions/public-url", { params: { key } });
        if (!active) return;
        setLessonVideoUrl(data?.url || data?.downloadUrl || null);
      } catch {
        if (!active) return;
        setLessonVideoUrl(null);
        setLessonVideoError("Không tải được video.");
      } finally {
        if (active) setLessonVideoLoading(false);
      }
    }

    loadVideoUrl();
    return () => {
      active = false;
    };
  }, [selectedEntry?.lesson.videoKey]);

  async function handleSaveLessonInfo() {
    if (!selectedEntry || busy) return;

    const title = lessonNameDraft.trim();
    if (!title) {
      toast.error("Tên bài học không được để trống.");
      return;
    }

    let durationSeconds = 0;
    if (lessonDurationMinutesDraft.trim()) {
      const minutes = Number(lessonDurationMinutesDraft);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        toast.error("Thời lượng phải là số phút hợp lệ.");
        return;
      }
      durationSeconds = Math.round(minutes * 60);
    }

    try {
      setBusy(true);
      await api.patch(`/classrooms/${classroomId}/lectures/lessons/${selectedEntry.lesson.id}`, {
        title,
        description: lessonDescriptionDraft,
        durationSeconds,
      });
      toast.success("Đã cập nhật bài học.");
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Lưu bài học thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadVideo(file: File | null) {
    if (!selectedEntry || !file || busy) return;

    try {
      setBusy(true);
      setUploadingLessonId(selectedEntry.lesson.id);
      const formData = new FormData();
      formData.append("file", file);
      await api.post(`/classrooms/${classroomId}/lectures/lessons/${selectedEntry.lesson.id}/video`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Đã tải video lên.");
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Tải video thất bại.");
    } finally {
      setBusy(false);
      setUploadingLessonId(null);
    }
  }

  async function handleDeleteVideo() {
    if (!selectedEntry || busy || !confirm("Bạn có chắc muốn gỡ video của bài học này?")) return;

    try {
      setBusy(true);
      await api.delete(`/classrooms/${classroomId}/lectures/lessons/${selectedEntry.lesson.id}/video`);
      toast.success("Đã gỡ video khỏi bài học.");
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Gỡ video thất bại.");
    } finally {
      setBusy(false);
    }
  }

  function openLesson(nextLessonId: string) {
    router.push(`/classrooms/${classroomId}/lectures/${nextLessonId}`);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="overflow-hidden border border-slate-200 bg-white p-0 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Danh sách bài giảng</div>
          <div className="mt-1 text-xs text-slate-500">{classroomName || "Lớp học"} </div>
        </div>

        <div className="space-y-2 p-3">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40">
              Đang tải bài giảng...
            </div>
          ) : sections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
              Chưa có bài giảng nào.
            </div>
          ) : (
            sections.map((section) => {
              const isExpanded = expanded[section.id] !== false;

              return (
                <div
                  key={section.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                >
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [section.id]: !isExpanded }))}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{section.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{section.lessons.length} bài học</div>
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50/70 p-2 dark:border-slate-800 dark:bg-slate-900/30">
                      {section.lessons.length === 0 ? (
                        <div className="rounded-xl px-3 py-3 text-sm text-slate-500">Chương này chưa có bài học.</div>
                      ) : (
                        <div className="space-y-1">
                          {section.lessons.map((lesson) => {
                            const active = lesson.id === lessonId;

                            return (
                              <button
                                key={lesson.id}
                                type="button"
                                onClick={() => openLesson(lesson.id)}
                                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                                  active
                                    ? "bg-sky-50 text-sky-900 ring-1 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-100 dark:ring-sky-900"
                                    : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                                }`}
                              >
                                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-current/15">
                                  <BookOpen className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium">{lesson.title}</div>
                                  <div className="mt-1 text-xs opacity-75">
                                    {lesson.videoKey ? "Có video nội dung" : "Chưa có video"}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Card className="border border-slate-200 bg-white p-0 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-500">Đang tải nội dung bài học...</div>
        ) : !selectedEntry ? (
          <div className="space-y-3 px-5 py-6">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Không tìm thấy bài học</div>
            <div className="text-sm text-slate-500">Bài học này có thể đã bị xóa hoặc đường dẫn không còn hợp lệ.</div>
            <button
              type="button"
              onClick={() => router.push(`/classrooms/${classroomId}?tab=lectures`)}
              className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Quay lại mục lục
            </button>
          </div>
        ) : (
          <div className="space-y-5 px-5 py-5">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <BookOpen className="h-3.5 w-3.5" />
                  Thuộc chương: {selectedEntry.section.title}
                </div>

                {isTeacher ? (
                  <input
                    value={lessonNameDraft}
                    onChange={(event) => setLessonNameDraft(event.target.value)}
                    placeholder="Tên bài học"
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-2xl font-semibold text-slate-950 outline-none transition focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                ) : (
                  <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">{selectedEntry.lesson.title}</h1>
                )}

                {classroomName && <div className="mt-2 text-sm text-slate-500">{classroomName}</div>}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <Clock3 className="h-4 w-4" />
                  {formatDuration(selectedEntry.lesson.durationSeconds)}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <Video className="h-3.5 w-3.5" />
                  {selectedEntry.lesson.videoKey ? "Đã gắn video bài giảng" : "Chưa có video"}
                </div>
              </div>
            </div>

            {isTeacher ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Nội dung hoặc mục tiêu bài học</div>
                  <textarea
                    value={lessonDescriptionDraft}
                    onChange={(event) => setLessonDescriptionDraft(event.target.value)}
                    placeholder="Mô tả mục tiêu, nội dung chính hoặc hướng dẫn cho sinh viên..."
                    rows={8}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Thời lượng ước tính</div>
                    <div className="mt-1 text-xs text-slate-500">Nhập theo phút để sinh viên dễ theo dõi.</div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={lessonDurationMinutesDraft}
                    onChange={(event) => setLessonDurationMinutesDraft(event.target.value)}
                    placeholder="Ví dụ: 45"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleSaveLessonInfo}
                    disabled={busy}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    Lưu bài học
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Nội dung bài học</div>
                <div className="whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {selectedEntry.lesson.description || "Giáo viên chưa bổ sung mô tả cho bài học này."}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Video nội dung bài học</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {selectedEntry.lesson.videoName || selectedEntry.lesson.title} · {bytesToSize(selectedEntry.lesson.videoSizeBytes)}
                  </div>
                </div>

                {isTeacher && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900">
                      <Upload className="h-4 w-4" />
                      {uploadingLessonId === selectedEntry.lesson.id
                        ? "Đang tải..."
                        : selectedEntry.lesson.videoKey
                        ? "Thay video"
                        : "Tải video"}
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          handleUploadVideo(file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>

                    {selectedEntry.lesson.videoKey && (
                      <button
                        type="button"
                        onClick={handleDeleteVideo}
                        className="rounded-full border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/70 dark:hover:bg-rose-950/40"
                      >
                        Gỡ video
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4">
                {selectedEntry.lesson.videoKey ? (
                  <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-3 dark:border-sky-950/80 dark:bg-sky-950/20">
                    {lessonVideoLoading ? (
                      <div className="text-sm text-slate-500">Đang tải video...</div>
                    ) : lessonVideoError ? (
                      <div className="text-sm text-rose-600">{lessonVideoError}</div>
                    ) : lessonVideoUrl ? (
                      <video key={selectedEntry.lesson.id} controls src={lessonVideoUrl} className="w-full rounded-xl bg-black" />
                    ) : (
                      <div className="text-sm text-slate-500">Không tìm thấy video.</div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
                    Bài học này chưa được gắn video.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => previousLesson && openLesson(previousLesson.lesson.id)}
                disabled={!previousLesson}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Bài trước
              </button>

              <button
                type="button"
                onClick={() => nextLesson && openLesson(nextLesson.lesson.id)}
                disabled={!nextLesson}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Bài tiếp theo
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
