export type LectureLesson = {
  id: string;
  title: string;
  description?: string | null;
  orderIndex: number;
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

export function normalizeLectureTree(data: unknown): LectureSection[] {
  const list = Array.isArray(data) ? data : [];

  return list
    .map((section: any) => ({
      id: String(section.id ?? section.Id ?? ""),
      title: String(section.title ?? section.Title ?? ""),
      orderIndex: Number(section.orderIndex ?? section.OrderIndex ?? 0),
      lessons: (Array.isArray(section.lessons) ? section.lessons : [])
        .map((lesson: any) => ({
          id: String(lesson.id ?? lesson.Id ?? ""),
          title: String(lesson.title ?? lesson.Title ?? ""),
          description: lesson.description ?? lesson.Description ?? "",
          orderIndex: Number(lesson.orderIndex ?? lesson.OrderIndex ?? 0),
          videoKey: lesson.videoKey ?? lesson.VideoKey ?? null,
          videoName: lesson.videoName ?? lesson.VideoName ?? null,
          videoSizeBytes: lesson.videoSizeBytes ?? lesson.VideoSizeBytes ?? null,
          durationSeconds: lesson.durationSeconds ?? lesson.DurationSeconds ?? null,
        }))
        .sort((a: LectureLesson, b: LectureLesson) => a.orderIndex - b.orderIndex),
    }))
    .sort((a: LectureSection, b: LectureSection) => a.orderIndex - b.orderIndex);
}
