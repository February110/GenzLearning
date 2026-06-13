namespace class_api.Domain
{
    public class LectureLessonProgress
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid LessonId { get; set; }
        public LectureLesson? Lesson { get; set; }

        public Guid UserId { get; set; }
        public User? User { get; set; }

        public int TextScrollPercent { get; set; }
        public int TextDwellSeconds { get; set; }
        public bool TextCompleted { get; set; }

        public double VideoWatchedSeconds { get; set; }
        public int? VideoDurationSeconds { get; set; }
        public bool VideoCompleted { get; set; }

        public bool IsCompleted { get; set; }
        public DateTime? CompletedAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
