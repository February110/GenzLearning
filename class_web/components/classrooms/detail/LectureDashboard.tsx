"use client";

import { type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileText,
  Save,
  Upload,
  Users,
  Video,
} from "lucide-react";
import api from "@/api/client";
import Card from "@/components/ui/Card";
import RichTextEditor from "@/components/common/RichTextEditor";
import {
  normalizeLectureProgressSummary,
  normalizeLectureTree,
  type LectureLesson,
  type LectureProgressSummary,
  type LectureSection,
} from "@/lib/lectures";
import { resolveAvatar } from "@/utils/resolveAvatar";
import { toast } from "react-hot-toast";

const TEXT_SCROLL_THRESHOLD_PERCENT = 90;
const TEXT_ONLY_DWELL_THRESHOLD_SECONDS = 30;
const TEXT_WITH_VIDEO_DWELL_THRESHOLD_SECONDS = 60;
const VIDEO_COMPLETION_RATIO = 0.9;

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

function normalizeRichText(value: string) {
  const html = (value || "").trim();
  if (!html) return "";
  const textOnly = html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  return textOnly ? html : "";
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function stripHtml(value?: string | null) {
  return (value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function getInitials(name?: string) {
  if (!name) return "U";
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0]?.toUpperCase())
      .join("")
      .slice(0, 2) || "U"
  );
}

export default function LectureDashboard({
  classroomId,
  lessonId,
  classroomName,
  isTeacher = false,
}: LectureDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"content" | "progress">("content");
  const [sections, setSections] = useState<LectureSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [lessonNameDraft, setLessonNameDraft] = useState("");
  const [lessonDescriptionDraft, setLessonDescriptionDraft] = useState("");
  const [lessonVideoUrl, setLessonVideoUrl] = useState<string | null>(null);
  const [lessonVideoLoading, setLessonVideoLoading] = useState(false);
  const [lessonVideoError, setLessonVideoError] = useState<string | null>(null);
  const [uploadingLessonId, setUploadingLessonId] = useState<string | null>(null);
  const [progressSummary, setProgressSummary] = useState<LectureProgressSummary | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [textScrollPercent, setTextScrollPercent] = useState(0);
  const [textDwellSeconds, setTextDwellSeconds] = useState(0);
  const [videoWatchedSeconds, setVideoWatchedSeconds] = useState(0);
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastVideoTimeRef = useRef(0);
  const videoSeekingRef = useRef(false);
  const lastSyncedProgressRef = useRef<string>("");

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

  const loadProgressSummary = useCallback(async () => {
    if (!isTeacher) return;

    try {
      setProgressLoading(true);
      const { data } = await api.get(`/classrooms/${classroomId}/lectures/progress-summary`);
      setProgressSummary(normalizeLectureProgressSummary(data));
    } catch {
      setProgressSummary(null);
    } finally {
      setProgressLoading(false);
    }
  }, [classroomId, isTeacher]);

  const updateLessonInSections = useCallback(
    (targetLessonId: string, updater: (lesson: LectureLesson) => LectureLesson) => {
      setSections((prev) =>
        prev.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) => (lesson.id === targetLessonId ? updater(lesson) : lesson)),
        }))
      );
    },
    []
  );

  useEffect(() => {
    if (!classroomId) return;
    load();
  }, [classroomId, load]);

  useEffect(() => {
    if (!isTeacher) {
      setActiveTab("content");
    }
  }, [isTeacher]);

  useEffect(() => {
    if (!isTeacher || activeTab !== "progress") return;
    void loadProgressSummary();
  }, [activeTab, classroomId, isTeacher, loadProgressSummary]);

  const selectedEntry = useMemo(() => {
    for (const section of sections) {
      for (const lesson of section.lessons) {
        if (lesson.id === lessonId) return { section, lesson };
      }
    }
    return null;
  }, [lessonId, sections]);

  const selectedLessonPlainText = useMemo(
    () => stripHtml(selectedEntry?.lesson.description),
    [selectedEntry?.lesson.description]
  );
  const hasTextContent =
    selectedEntry?.lesson.hasTextContent !== undefined
      ? selectedEntry.lesson.hasTextContent
      : Boolean(selectedLessonPlainText);
  const hasVideoContent =
    selectedEntry?.lesson.hasVideoContent !== undefined
      ? selectedEntry.lesson.hasVideoContent
      : Boolean(selectedEntry?.lesson.videoKey);
  const hasTrackableContent = hasTextContent || hasVideoContent;
  const textRequiredSeconds =
    selectedEntry?.lesson.textRequiredSeconds && selectedEntry.lesson.textRequiredSeconds > 0
      ? selectedEntry.lesson.textRequiredSeconds
      : hasTextContent
        ? hasVideoContent
          ? TEXT_WITH_VIDEO_DWELL_THRESHOLD_SECONDS
          : TEXT_ONLY_DWELL_THRESHOLD_SECONDS
        : 0;
  const effectiveVideoDurationSeconds = videoDurationSeconds
    ?? selectedEntry?.lesson.videoDurationSeconds
    ?? selectedEntry?.lesson.durationSeconds
    ?? null;
  const textRequirementCompleted =
    !hasTextContent || (textScrollPercent >= TEXT_SCROLL_THRESHOLD_PERCENT && textDwellSeconds >= textRequiredSeconds);
  const videoRequirementCompleted =
    !hasVideoContent
    || !!(
      effectiveVideoDurationSeconds
      && effectiveVideoDurationSeconds > 0
      && videoWatchedSeconds >= effectiveVideoDurationSeconds * VIDEO_COMPLETION_RATIO
    );
  const currentLessonCompleted = isTeacher
    ? !!selectedEntry?.lesson.isCompleted
    : Boolean(hasTrackableContent && (selectedEntry?.lesson.isCompleted || (textRequirementCompleted && videoRequirementCompleted)));

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
  const totalLessons = flatLessons.length;
  const completedLessons = useMemo(
    () => {
      const count = flatLessons.filter((entry) => entry.lesson.isCompleted).length;
      if (!selectedEntry || isTeacher || selectedEntry.lesson.isCompleted || !currentLessonCompleted) return count;
      return count + 1;
    },
    [currentLessonCompleted, flatLessons, isTeacher, selectedEntry]
  );
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const previousLesson = selectedIndex > 0 ? flatLessons[selectedIndex - 1] : null;
  const nextLesson = selectedIndex >= 0 && selectedIndex < flatLessons.length - 1 ? flatLessons[selectedIndex + 1] : null;

  useEffect(() => {
    if (!selectedEntry) {
      setLessonNameDraft("");
      setLessonDescriptionDraft("");
      return;
    }

    setLessonNameDraft(selectedEntry.lesson.title || "");
    setLessonDescriptionDraft(selectedEntry.lesson.description || "");
  }, [selectedEntry]);

  useEffect(() => {
    if (!selectedEntry) {
      setTextScrollPercent(0);
      setTextDwellSeconds(0);
      setVideoWatchedSeconds(0);
      setVideoDurationSeconds(null);
      lastSyncedProgressRef.current = "";
      lastVideoTimeRef.current = 0;
      videoSeekingRef.current = false;
      return;
    }

    const initialVideoDuration = selectedEntry.lesson.videoDurationSeconds ?? selectedEntry.lesson.durationSeconds ?? null;
    const initialPayload = {
      textScrollPercent: selectedEntry.lesson.textScrollPercent ?? 0,
      textDwellSeconds: selectedEntry.lesson.textDwellSeconds ?? 0,
      videoWatchedSeconds: Number((selectedEntry.lesson.videoWatchedSeconds ?? 0).toFixed(1)),
      videoDurationSeconds: initialVideoDuration && initialVideoDuration > 0 ? Math.round(initialVideoDuration) : null,
    };

    setTextScrollPercent(initialPayload.textScrollPercent);
    setTextDwellSeconds(initialPayload.textDwellSeconds);
    setVideoWatchedSeconds(initialPayload.videoWatchedSeconds);
    setVideoDurationSeconds(initialPayload.videoDurationSeconds);
    lastSyncedProgressRef.current = JSON.stringify(initialPayload);
    lastVideoTimeRef.current = 0;
    videoSeekingRef.current = false;
  }, [selectedEntry?.lesson.id]);

  useEffect(() => {
    if (!effectiveVideoDurationSeconds || effectiveVideoDurationSeconds <= 0) return;
    setVideoWatchedSeconds((prev) => Math.min(prev, effectiveVideoDurationSeconds));
  }, [effectiveVideoDurationSeconds]);

  const updateTextScrollProgress = useCallback(() => {
    const element = contentRef.current;
    if (!element || isTeacher || !hasTextContent) return;

    const maxScroll = element.scrollHeight - element.clientHeight;
    if (maxScroll <= 8) {
      setTextScrollPercent((prev) => Math.max(prev, 100));
      return;
    }

    const scrolledPercent = Math.round(((element.scrollTop + element.clientHeight) / element.scrollHeight) * 100);
    setTextScrollPercent((prev) => Math.max(prev, Math.min(100, Math.max(0, scrolledPercent))));
  }, [hasTextContent, isTeacher]);

  useEffect(() => {
    if (isTeacher || !selectedEntry || !hasTextContent) return;
    const frameId = window.requestAnimationFrame(() => {
      updateTextScrollProgress();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [hasTextContent, isTeacher, selectedEntry?.lesson.id, updateTextScrollProgress]);

  useEffect(() => {
    if (isTeacher || !selectedEntry || !hasTextContent) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setTextDwellSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [hasTextContent, isTeacher, selectedEntry?.lesson.id]);

  const syncLessonProgress = useCallback(
    async (force = false) => {
      if (isTeacher || !selectedEntry) return;

      const payload = {
        textScrollPercent: Math.min(100, Math.max(0, Math.round(textScrollPercent))),
        textDwellSeconds: Math.max(0, Math.round(textDwellSeconds)),
        videoWatchedSeconds: Number(Math.max(0, videoWatchedSeconds).toFixed(1)),
        videoDurationSeconds:
          effectiveVideoDurationSeconds && effectiveVideoDurationSeconds > 0
            ? Math.round(effectiveVideoDurationSeconds)
            : null,
      };

      const payloadKey = JSON.stringify(payload);
      if (!force && payloadKey === lastSyncedProgressRef.current) return;

      try {
        const { data } = await api.patch(
          `/classrooms/${classroomId}/lectures/lessons/${selectedEntry.lesson.id}/progress`,
          payload
        );

        lastSyncedProgressRef.current = payloadKey;
        updateLessonInSections(selectedEntry.lesson.id, (lesson) => ({
          ...lesson,
          hasTextContent: Boolean(data?.hasTextContent ?? lesson.hasTextContent),
          hasVideoContent: Boolean(data?.hasVideoContent ?? lesson.hasVideoContent),
          textRequiredSeconds: Number(data?.textRequiredSeconds ?? lesson.textRequiredSeconds ?? 0),
          textScrollPercent: Number(data?.textScrollPercent ?? payload.textScrollPercent),
          textDwellSeconds: Number(data?.textDwellSeconds ?? payload.textDwellSeconds),
          textCompleted: Boolean(data?.textCompleted ?? lesson.textCompleted),
          videoWatchedSeconds: Number(data?.videoWatchedSeconds ?? payload.videoWatchedSeconds),
          videoDurationSeconds: data?.videoDurationSeconds ?? payload.videoDurationSeconds,
          videoCompleted: Boolean(data?.videoCompleted ?? lesson.videoCompleted),
          isCompleted: Boolean(data?.isCompleted ?? lesson.isCompleted),
          completedAt: data?.completedAt ?? lesson.completedAt ?? null,
        }));
      } catch {
        // Ignore background sync errors; the next interval will retry.
      }
    },
    [
      classroomId,
      effectiveVideoDurationSeconds,
      isTeacher,
      selectedEntry,
      textDwellSeconds,
      textScrollPercent,
      updateLessonInSections,
      videoWatchedSeconds,
    ]
  );

  useEffect(() => {
    if (isTeacher || !selectedEntry) return;
    const intervalId = window.setInterval(() => {
      void syncLessonProgress();
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [isTeacher, selectedEntry?.lesson.id, syncLessonProgress]);

  useEffect(() => {
    if (isTeacher || !selectedEntry || !currentLessonCompleted || selectedEntry.lesson.isCompleted) return;
    void syncLessonProgress(true);
  }, [currentLessonCompleted, isTeacher, selectedEntry, syncLessonProgress]);

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

    try {
      setBusy(true);
      await api.patch(`/classrooms/${classroomId}/lectures/lessons/${selectedEntry.lesson.id}`, {
        title,
        description: normalizeRichText(lessonDescriptionDraft),
      });
      toast.success("Đã cập nhật bài học.");
      await load();
      if (isTeacher && activeTab === "progress") await loadProgressSummary();
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

  function handleVideoLoadedMetadata(event: SyntheticEvent<HTMLVideoElement>) {
    const nextDuration = Math.round(event.currentTarget.duration || 0);
    if (nextDuration > 0) {
      setVideoDurationSeconds(nextDuration);
    }
    lastVideoTimeRef.current = event.currentTarget.currentTime || 0;
  }

  function handleVideoPlay(event: SyntheticEvent<HTMLVideoElement>) {
    videoSeekingRef.current = false;
    lastVideoTimeRef.current = event.currentTarget.currentTime || 0;
  }

  function handleVideoSeeking() {
    videoSeekingRef.current = true;
  }

  function handleVideoSeeked(event: SyntheticEvent<HTMLVideoElement>) {
    lastVideoTimeRef.current = event.currentTarget.currentTime || 0;
    videoSeekingRef.current = false;
  }

  function handleVideoTimeUpdate(event: SyntheticEvent<HTMLVideoElement>) {
    if (isTeacher || !selectedEntry || !hasVideoContent) return;

    const currentTime = event.currentTarget.currentTime || 0;
    const previousTime = lastVideoTimeRef.current;
    const delta = currentTime - previousTime;
    lastVideoTimeRef.current = currentTime;

    const nextDuration = Math.round(event.currentTarget.duration || 0);
    if (nextDuration > 0 && nextDuration !== videoDurationSeconds) {
      setVideoDurationSeconds(nextDuration);
    }

    if (videoSeekingRef.current) return;
    if (!Number.isFinite(delta) || delta <= 0 || delta > 3) return;

    setVideoWatchedSeconds((prev) => {
      const durationLimit = nextDuration > 0 ? nextDuration : effectiveVideoDurationSeconds ?? null;
      const nextValue = prev + delta;
      return durationLimit ? Math.min(durationLimit, nextValue) : nextValue;
    });
  }

  async function openLesson(nextLessonId: string) {
    if (!isTeacher && nextLessonId !== lessonId) {
      await syncLessonProgress(true);
    }
    router.push(`/classrooms/${classroomId}/lectures/${nextLessonId}`);
  }

  return (
    <div className="space-y-5">
      {isTeacher && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">Chọn tab để xem nội dung bài học hoặc tiến trình lớp.</div>
          </div>
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <button
              type="button"
              onClick={() => setActiveTab("content")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === "content"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
              }`}
            >
              Nội dung bài học
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("progress")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === "progress"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
              }`}
            >
              Tiến trình lớp học
            </button>
          </div>
        </div>
      )}

      {isTeacher && activeTab === "progress" ? (
        <Card className="overflow-hidden border border-slate-200 bg-white p-0 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-950 dark:text-white">Tiến trình lớp học</div>
                <div className="mt-1 text-sm text-slate-500">Tổng quan hoàn thành của toàn bộ học viên trong lớp.</div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <BarChart3 className="h-4 w-4" />
                {progressSummary?.completionRate ?? 0}% hoàn thành
              </div>
            </div>
          </div>

          {progressLoading ? (
            <div className="px-5 py-6 text-sm text-slate-500">Đang tải tiến trình lớp học...</div>
          ) : !progressSummary ? (
            <div className="px-5 py-6 text-sm text-slate-500">Chưa có dữ liệu tiến trình.</div>
          ) : (
            <div className="space-y-5 px-5 py-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    <Users className="h-4 w-4" />
                    Học viên
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{progressSummary.studentCount}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    <BookOpen className="h-4 w-4" />
                    Bài học
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{progressSummary.totalLessons}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    <CheckCircle2 className="h-4 w-4" />
                    Hoàn thành 100%
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                    {progressSummary.completedStudentsCount}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    <BarChart3 className="h-4 w-4" />
                    Tỉ lệ chung
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                    {progressSummary.completionRate}%
                  </div>
                </div>
              </div>

              {progressSummary.students.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
                  Lớp chưa có học viên.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_120px] gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
                    <div>Học viên</div>
                    <div>Tiến độ</div>
                    <div className="text-right">Hoàn thành</div>
                  </div>
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {progressSummary.students.map((student) => (
                      <div
                        key={student.userId}
                        className="grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_120px] md:items-center"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {resolveAvatar(student.avatar) ? (
                            <img
                              src={resolveAvatar(student.avatar)}
                              alt={student.fullName || "Student"}
                              className="h-10 w-10 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-800"
                            />
                          ) : (
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                              {getInitials(student.fullName)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-950 dark:text-white">{student.fullName}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              Cập nhật: {formatDateTime(student.lastUpdatedAt || student.lastCompletedAt)}
                            </div>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                            <span>
                              {student.completedLessons}/{student.totalLessons} bài
                            </span>
                            <span>{student.progressPercent}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            <div className="h-full rounded-full bg-sky-600 dark:bg-sky-400" style={{ width: `${student.progressPercent}%` }} />
                          </div>
                        </div>

                        <div className="text-right text-sm font-semibold text-slate-900 dark:text-white">
                          {student.progressPercent}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      ) : (
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
                                    : lesson.isCompleted
                                      ? "bg-emerald-50/80 text-emerald-900 ring-1 ring-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-100 dark:ring-emerald-900/50"
                                      : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                                }`}
                              >
                                <div
                                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${
                                    lesson.isCompleted
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                                      : "border-current/15 bg-slate-50/80 text-slate-500 dark:bg-slate-900 dark:text-slate-300"
                                  }`}
                                >
                                  {lesson.isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium">{lesson.title}</div>
                                  <div className="mt-1 text-xs opacity-75">
                                    {lesson.isCompleted
                                      ? "Đã hoàn thành"
                                      : lesson.hasTextContent && lesson.hasVideoContent
                                        ? "Bài học văn bản + video"
                                        : lesson.hasTextContent
                                          ? "Bài học văn bản"
                                          : lesson.hasVideoContent
                                            ? "Bài học video"
                                            : "Chưa có nội dung"}
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
            <div className="space-y-4 border-b border-slate-200 pb-5 dark:border-slate-800">
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
              </div>

              {!isTeacher && (
                <div className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60 lg:ml-auto lg:max-w-md">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Video className="h-3.5 w-3.5" />
                    {hasTextContent && hasVideoContent
                      ? "Bài học có cả nội dung văn bản và video"
                      : hasTextContent
                        ? "Bài học dạng văn bản"
                        : hasVideoContent
                          ? "Bài học dạng video"
                          : "Bài học chưa có nội dung"}
                  </div>
                  <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tiến trình học tập</div>
                        <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                          {completedLessons}/{totalLessons} bài đã hoàn thành
                        </div>
                      </div>
                      <div className="text-lg font-semibold text-sky-600 dark:text-sky-300">{progressPercent}%</div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-sky-600 transition-[width] dark:bg-sky-400"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="mt-3 space-y-2">
                      {hasTextContent && (
                        <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/40">
                          <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-700 dark:text-slate-200">
                            <span>Đọc nội dung</span>
                            <span className={textRequirementCompleted ? "text-emerald-600 dark:text-emerald-300" : "text-slate-500"}>
                              {textRequirementCompleted ? "Đã ghi nhận" : "Đang theo dõi"}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">Hệ thống tự theo dõi tiến trình đọc nội dung.</div>
                        </div>
                      )}

                      {hasVideoContent && (
                        <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/40">
                          <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-700 dark:text-slate-200">
                            <span>Xem video</span>
                            <span className={videoRequirementCompleted ? "text-emerald-600 dark:text-emerald-300" : "text-slate-500"}>
                              {videoRequirementCompleted ? "Đã ghi nhận" : "Đang theo dõi"}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">Hệ thống tự theo dõi thời gian xem video thực tế.</div>
                        </div>
                      )}

                      <div
                        className={`rounded-xl border px-3 py-2 text-xs font-medium ${
                          currentLessonCompleted
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                            : "border-slate-200 bg-white/80 text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300"
                        }`}
                      >
                        {!hasTrackableContent
                          ? "Bài học này chưa có đủ nội dung để hệ thống tính tiến độ."
                          : currentLessonCompleted
                            ? "Bài học đã được hệ thống tự động ghi nhận hoàn thành."
                            : "Bài học sẽ tự hoàn thành khi bạn hoàn tất nội dung."}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {isTeacher ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Nội dung hoặc mục tiêu bài học</div>
                <RichTextEditor
                  value={lessonDescriptionDraft}
                  onChange={setLessonDescriptionDraft}
                  placeholder="Mô tả mục tiêu, nội dung chính hoặc hướng dẫn cho sinh viên..."
                  disabled={busy}
                  editorClassName="min-h-[220px] rounded-xl border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  toolbarClassName="rounded-xl border border-slate-200 bg-white/90 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950/60"
                />
                <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-slate-500">Lưu thay đổi để cập nhật bài học cho lớp.</div>
                  <button
                    type="button"
                    onClick={handleSaveLessonInfo}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    Lưu bài học
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Nội dung bài học</div>
                <div
                  ref={contentRef}
                  onScroll={updateTextScrollProgress}
                  className="max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 bg-white px-4 py-3 pr-2 dark:border-slate-700 dark:bg-slate-950/50"
                >
                  <div
                    className="prose prose-sm max-w-none text-sm leading-6 text-slate-600 dark:prose-invert dark:text-slate-300"
                    dangerouslySetInnerHTML={{
                      __html: selectedEntry.lesson.description || "<p>Giáo viên chưa bổ sung mô tả cho bài học này.</p>",
                    }}
                  />
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
                      <video
                        key={selectedEntry.lesson.id}
                        ref={videoRef}
                        controls
                        src={lessonVideoUrl}
                        className="w-full rounded-xl bg-black"
                        onLoadedMetadata={handleVideoLoadedMetadata}
                        onPlay={handleVideoPlay}
                        onSeeking={handleVideoSeeking}
                        onSeeked={handleVideoSeeked}
                        onTimeUpdate={handleVideoTimeUpdate}
                      />
                    ) : (
                      <div className="text-sm text-slate-500">Không tìm thấy video.</div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
                    {hasTextContent ? "Bài học này không yêu cầu video." : "Bài học này chưa được gắn video."}
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
      )}
    </div>
  );
}
