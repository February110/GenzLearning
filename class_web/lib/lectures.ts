export type LectureLesson = {
  id: string;
  title: string;
  description?: string | null;
  orderIndex: number;
  hasTextContent?: boolean;
  hasVideoContent?: boolean;
  textRequiredSeconds?: number;
  textScrollPercent?: number;
  textDwellSeconds?: number;
  textCompleted?: boolean;
  videoWatchedSeconds?: number;
  videoDurationSeconds?: number | null;
  videoCompleted?: boolean;
  isCompleted?: boolean;
  completedAt?: string | null;
  videoKey?: string | null;
  videoName?: string | null;
  videoSizeBytes?: number | null;
  durationSeconds?: number | null;
};

export type LectureSection = {
  id: string;
  title: string;
  orderIndex: number;
  lessons: LectureLesson[];
};

export type LectureStudentProgress = {
  userId: string;
  fullName: string;
  avatar?: string | null;
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
  lastCompletedAt?: string | null;
  lastUpdatedAt?: string | null;
};

export type LectureProgressSummary = {
  totalLessons: number;
  studentCount: number;
  totalCompletedLessons: number;
  completionRate: number;
  completedStudentsCount: number;
  students: LectureStudentProgress[];
};

export function normalizeLectureTree(data: unknown): LectureSection[] {
  const list = Array.isArray(data) ? data : [];

  return list
    .map((section: any) => ({
      id: String(section.id ?? section.Id ?? ""),
      title: String(section.title ?? section.Title ?? ""),
      orderIndex: Number(section.orderIndex ?? section.OrderIndex ?? 0),
      lessons: (Array.isArray(section.lessons) ? section.lessons : [])
        .map((lesson: any) => {
          const rawHasTextContent = lesson.hasTextContent ?? lesson.HasTextContent;
          const rawHasVideoContent = lesson.hasVideoContent ?? lesson.HasVideoContent;
          const rawTextRequiredSeconds = lesson.textRequiredSeconds ?? lesson.TextRequiredSeconds;

          return {
            id: String(lesson.id ?? lesson.Id ?? ""),
            title: String(lesson.title ?? lesson.Title ?? ""),
            description: lesson.description ?? lesson.Description ?? "",
            orderIndex: Number(lesson.orderIndex ?? lesson.OrderIndex ?? 0),
            hasTextContent: typeof rawHasTextContent === "boolean" ? rawHasTextContent : undefined,
            hasVideoContent: typeof rawHasVideoContent === "boolean" ? rawHasVideoContent : undefined,
            textRequiredSeconds: rawTextRequiredSeconds == null ? undefined : Number(rawTextRequiredSeconds),
            textScrollPercent: Number(lesson.textScrollPercent ?? lesson.TextScrollPercent ?? 0),
            textDwellSeconds: Number(lesson.textDwellSeconds ?? lesson.TextDwellSeconds ?? 0),
            textCompleted: Boolean(lesson.textCompleted ?? lesson.TextCompleted ?? false),
            videoWatchedSeconds: Number(lesson.videoWatchedSeconds ?? lesson.VideoWatchedSeconds ?? 0),
            videoDurationSeconds: lesson.videoDurationSeconds ?? lesson.VideoDurationSeconds ?? null,
            videoCompleted: Boolean(lesson.videoCompleted ?? lesson.VideoCompleted ?? false),
            isCompleted: Boolean(lesson.isCompleted ?? lesson.IsCompleted ?? false),
            completedAt: lesson.completedAt ?? lesson.CompletedAt ?? null,
            videoKey: lesson.videoKey ?? lesson.VideoKey ?? null,
            videoName: lesson.videoName ?? lesson.VideoName ?? null,
            videoSizeBytes: lesson.videoSizeBytes ?? lesson.VideoSizeBytes ?? null,
            durationSeconds: lesson.durationSeconds ?? lesson.DurationSeconds ?? null,
          };
        })
        .sort((a: LectureLesson, b: LectureLesson) => a.orderIndex - b.orderIndex),
    }))
    .sort((a: LectureSection, b: LectureSection) => a.orderIndex - b.orderIndex);
}

export function normalizeLectureProgressSummary(data: unknown): LectureProgressSummary | null {
  if (!data || typeof data !== "object") return null;

  const source = data as any;
  const students = Array.isArray(source.students ?? source.Students) ? source.students ?? source.Students : [];

  return {
    totalLessons: Number(source.totalLessons ?? source.TotalLessons ?? 0),
    studentCount: Number(source.studentCount ?? source.StudentCount ?? 0),
    totalCompletedLessons: Number(source.totalCompletedLessons ?? source.TotalCompletedLessons ?? 0),
    completionRate: Number(source.completionRate ?? source.CompletionRate ?? 0),
    completedStudentsCount: Number(source.completedStudentsCount ?? source.CompletedStudentsCount ?? 0),
    students: students.map((student: any) => ({
      userId: String(student.userId ?? student.UserId ?? ""),
      fullName: String(student.fullName ?? student.FullName ?? ""),
      avatar: student.avatar ?? student.Avatar ?? null,
      completedLessons: Number(student.completedLessons ?? student.CompletedLessons ?? 0),
      totalLessons: Number(student.totalLessons ?? student.TotalLessons ?? 0),
      progressPercent: Number(student.progressPercent ?? student.ProgressPercent ?? 0),
      lastCompletedAt: student.lastCompletedAt ?? student.LastCompletedAt ?? null,
      lastUpdatedAt: student.lastUpdatedAt ?? student.LastUpdatedAt ?? null,
    })),
  };
}
