"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Circle, ChevronDown, Plus, Trash2, PlayCircle, Upload, BookOpen } from "lucide-react";
import api from "@/api/client";
import Card from "@/components/ui/Card";
import { toast } from "react-hot-toast";
import { openFileViewer } from "@/utils/fileViewer";

type Lesson = {
  id: string;
  title: string;
  description?: string | null;
  orderIndex: number;
  videoKey?: string | null;
  videoName?: string | null;
  videoSizeBytes?: number | null;
  durationSeconds?: number | null;
};

type Section = {
  id: string;
  title: string;
  orderIndex: number;
  lessons: Lesson[];
};

function bytesToSize(value?: number | null) {
  if (!value || value <= 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "Chưa cập nhật";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, "0")} phút`;
}

export default function LecturePanel({
  classroomId,
  isTeacher = false,
}: {
  classroomId: string;
  isTeacher?: boolean;
}) {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sectionTitle, setSectionTitle] = useState("");
  const [lessonTitle, setLessonTitle] = useState<Record<string, string>>({});
  const [uploadingLessonId, setUploadingLessonId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [lessonDescriptionDraft, setLessonDescriptionDraft] = useState("");
  const [durationDraft, setDurationDraft] = useState<string>("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/classrooms/${classroomId}/lectures/tree`);
      const list = (Array.isArray(data) ? data : []).map((s: any) => ({
        id: String(s.id ?? s.Id),
        title: String(s.title ?? s.Title ?? ""),
        orderIndex: Number(s.orderIndex ?? s.OrderIndex ?? 0),
        lessons: (Array.isArray(s.lessons) ? s.lessons : []).map((l: any) => ({
          id: String(l.id ?? l.Id),
          title: String(l.title ?? l.Title ?? ""),
          description: l.description ?? l.Description ?? "",
          orderIndex: Number(l.orderIndex ?? l.OrderIndex ?? 0),
          videoKey: l.videoKey ?? l.VideoKey ?? null,
          videoName: l.videoName ?? l.VideoName ?? null,
          videoSizeBytes: l.videoSizeBytes ?? l.VideoSizeBytes ?? null,
          durationSeconds: l.durationSeconds ?? l.DurationSeconds ?? null,
        })),
      })) as Section[];
      setSections(list);
      setExpanded((prev) => {
        const next = { ...prev };
        list.forEach((section) => {
          if (next[section.id] === undefined) next[section.id] = true;
        });
        return next;
      });

      if (!selectedLessonId) {
        const first = list.find((s) => s.lessons.length > 0)?.lessons[0];
        if (first) setSelectedLessonId(first.id);
      } else {
        const exists = list.some((s) => s.lessons.some((l) => l.id === selectedLessonId));
        if (!exists) {
          const first = list.find((s) => s.lessons.length > 0)?.lessons[0];
          setSelectedLessonId(first ? first.id : null);
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Không thể tải bài giảng.";
      toast.error(msg);
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, [classroomId, selectedLessonId]);

  useEffect(() => {
    if (!classroomId) return;
    load();
  }, [classroomId, load]);

  const selectedLesson = useMemo(() => {
    for (const section of sections) {
      for (const lesson of section.lessons) {
        if (lesson.id === selectedLessonId) return { section, lesson };
      }
    }
    return null;
  }, [sections, selectedLessonId]);

  useEffect(() => {
    if (!selectedLesson) {
      setLessonDescriptionDraft("");
      setDurationDraft("");
      return;
    }
    setLessonDescriptionDraft(selectedLesson.lesson.description || "");
    setDurationDraft(
      selectedLesson.lesson.durationSeconds && selectedLesson.lesson.durationSeconds > 0
        ? String(selectedLesson.lesson.durationSeconds)
        : ""
    );
  }, [selectedLesson]);

  async function handleCreateSection() {
    if (!sectionTitle.trim() || busy) return;
    try {
      setBusy(true);
      await api.post(`/classrooms/${classroomId}/lectures/sections`, {
        title: sectionTitle.trim(),
      });
      toast.success("Đã tạo chương.");
      setSectionTitle("");
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Tạo chương thất bại.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSection(sectionId: string) {
    if (busy) return;
    if (!confirm("Bạn có chắc muốn xóa chương này?")) return;
    try {
      setBusy(true);
      await api.delete(`/classrooms/${classroomId}/lectures/sections/${sectionId}`);
      toast.success("Đã xóa chương.");
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Xóa chương thất bại.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateLesson(sectionId: string) {
    const title = (lessonTitle[sectionId] || "").trim();
    if (!title || busy) return;
    try {
      setBusy(true);
      await api.post(`/classrooms/${classroomId}/lectures/sections/${sectionId}/lessons`, {
        title,
      });
      toast.success("Đã thêm bài học.");
      setLessonTitle((prev) => ({ ...prev, [sectionId]: "" }));
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Thêm bài học thất bại.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteLesson(lessonId: string) {
    if (busy) return;
    if (!confirm("Bạn có chắc muốn xóa bài học này?")) return;
    try {
      setBusy(true);
      await api.delete(`/classrooms/${classroomId}/lectures/lessons/${lessonId}`);
      toast.success("Đã xóa bài học.");
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Xóa bài học thất bại.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadVideo(lessonId: string, file: File | null) {
    if (!file) return;
    try {
      setBusy(true);
      setUploadingLessonId(lessonId);
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/classrooms/${classroomId}/lectures/lessons/${lessonId}/video`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Đã tải video lên.");
      await load();
      setSelectedLessonId(lessonId);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Tải video thất bại.";
      toast.error(msg);
    } finally {
      setBusy(false);
      setUploadingLessonId(null);
    }
  }

  async function handleSaveLessonInfo() {
    if (!selectedLesson || busy) return;
    const lessonId = selectedLesson.lesson.id;
    try {
      setBusy(true);
      const duration = Number(durationDraft);
      await api.patch(`/classrooms/${classroomId}/lectures/lessons/${lessonId}`, {
        description: lessonDescriptionDraft,
        durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : null,
      });
      toast.success("Đã lưu mô tả bài học.");
      await load();
      setSelectedLessonId(lessonId);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Lưu mô tả thất bại.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Bài giảng</h2>
      </div>

      {isTeacher && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 space-y-3">
          <div className="text-sm font-semibold">Tạo chương mới</div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              placeholder="Ví dụ: Bài 1 - Tổng quan"
              className="flex-1 min-w-[240px] rounded-full border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleCreateSection}
              disabled={!sectionTitle.trim() || busy}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              Thêm chương
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Đang tải bài giảng...</div>
      ) : sections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-4 text-sm text-gray-500">
          Chưa có bài giảng nào.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-2">
            {sections.map((section, sIdx) => {
              const isExpanded = expanded[section.id] ?? true;
              return (
                <div key={section.id} className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="flex items-center gap-3 px-3 py-3 bg-white dark:bg-zinc-900">
                    <Circle className="h-4 w-4 text-gray-500 shrink-0" />
                    <button
                      type="button"
                      className="flex-1 text-left font-semibold"
                      onClick={() => setExpanded((prev) => ({ ...prev, [section.id]: !isExpanded }))}
                    >
                      {section.title || `Bài ${sIdx + 1}`}
                    </button>
                    <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    {isTeacher && (
                      <button
                        type="button"
                        className="text-rose-600 hover:underline text-xs"
                        onClick={() => handleDeleteSection(section.id)}
                      >
                        Xóa
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-zinc-950/50 p-2 space-y-2">
                      {section.lessons.map((lesson, lIdx) => {
                        const active = lesson.id === selectedLessonId;
                        return (
                          <div
                            key={lesson.id}
                            className={`rounded-lg border px-2 py-2 ${active ? "border-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/40" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900"}`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedLessonId(lesson.id)}
                              className="w-full text-left"
                            >
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {`Bài ${sIdx + 1}.${lIdx + 1}: ${lesson.title}`}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {lesson.videoKey ? "Đã có video" : "Chưa có video"}
                              </div>
                            </button>
                            {isTeacher && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-xs hover:bg-gray-50 dark:hover:bg-zinc-800">
                                  <Upload className="h-3.5 w-3.5" />
                                  {uploadingLessonId === lesson.id ? "Đang tải..." : "Upload video"}
                                  <input
                                    type="file"
                                    accept="video/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] || null;
                                      handleUploadVideo(lesson.id, file);
                                      e.currentTarget.value = "";
                                    }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLesson(lesson.id)}
                                  className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Xóa bài
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {isTeacher && (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            value={lessonTitle[section.id] || ""}
                            onChange={(e) => setLessonTitle((prev) => ({ ...prev, [section.id]: e.target.value }))}
                            placeholder="Tên bài học..."
                            className="flex-1 rounded-full border border-gray-200 dark:border-gray-800 px-3 py-1.5 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => handleCreateLesson(section.id)}
                            disabled={!lessonTitle[section.id]?.trim() || busy}
                            className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700 disabled:opacity-60"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Thêm bài
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-7 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-4">
            {!selectedLesson ? (
              <div className="text-sm text-gray-500">Chọn một bài học để xem nội dung.</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {selectedLesson.lesson.title}
                    </h3>
                    <div className="text-sm text-gray-500 mt-1">
                      {selectedLesson.section.title}
                    </div>
                  </div>
                  <BookOpen className="h-5 w-5 text-gray-400" />
                </div>

                <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-zinc-950 p-3">
                  {isTeacher ? (
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 text-xs font-medium text-gray-500">Mô tả bài học</div>
                        <textarea
                          value={lessonDescriptionDraft}
                          onChange={(e) => setLessonDescriptionDraft(e.target.value)}
                          placeholder="Nhập mô tả cho bài học này..."
                          rows={4}
                          className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <div className="mb-1 text-xs font-medium text-gray-500">Thời lượng (giây)</div>
                          <input
                            type="number"
                            min={0}
                            value={durationDraft}
                            onChange={(e) => setDurationDraft(e.target.value)}
                            placeholder="Ví dụ: 840"
                            className="w-40 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleSaveLessonInfo}
                          disabled={busy}
                          className="rounded-full bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                          Lưu mô tả
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {selectedLesson.lesson.description || "Chưa có mô tả bài học."}
                    </div>
                  )}
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Video nội dung bài học [{formatDuration(selectedLesson.lesson.durationSeconds)}]
                </div>

                {selectedLesson.lesson.videoKey ? (
                  <button
                    type="button"
                    onClick={() =>
                      openFileViewer({
                        key: selectedLesson.lesson.videoKey || undefined,
                        name: selectedLesson.lesson.videoName || selectedLesson.lesson.title,
                      })
                    }
                    className="w-full rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/30 px-4 py-4 text-left hover:bg-indigo-50"
                  >
                    <div className="flex items-center gap-3">
                      <PlayCircle className="h-10 w-10 text-indigo-600" />
                      <div>
                        <div className="font-semibold text-indigo-700 dark:text-indigo-200">Xem video bài giảng</div>
                        <div className="text-xs text-indigo-600/90 dark:text-indigo-300/80">
                          {selectedLesson.lesson.videoName || selectedLesson.lesson.title} · {bytesToSize(selectedLesson.lesson.videoSizeBytes)}
                        </div>
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-4 text-sm text-gray-500">
                    Bài học này chưa có video.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
