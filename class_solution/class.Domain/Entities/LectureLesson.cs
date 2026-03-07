namespace class_api.Domain
{
    public class LectureLesson
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid SectionId { get; set; }
        public LectureSection? Section { get; set; }

        public string Title { get; set; } = default!;
        public string? Description { get; set; }
        public int OrderIndex { get; set; }

        public string? VideoKey { get; set; }
        public string? VideoName { get; set; }
        public long? VideoSizeBytes { get; set; }
        public int? DurationSeconds { get; set; }

        public Guid CreatedBy { get; set; }
        public User? Creator { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
