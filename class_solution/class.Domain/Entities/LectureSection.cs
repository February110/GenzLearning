namespace class_api.Domain
{
    public class LectureSection
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ClassroomId { get; set; }
        public Classroom? Classroom { get; set; }

        public string Title { get; set; } = default!;
        public int OrderIndex { get; set; }

        public Guid CreatedBy { get; set; }
        public User? Creator { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<LectureLesson> Lessons { get; set; } = new List<LectureLesson>();
    }
}
