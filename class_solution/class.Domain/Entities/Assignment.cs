namespace class_api.Domain
{
    public class Assignment
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ClassroomId { get; set; }
        public Classroom? Classroom { get; set; }

        public string Title { get; set; } = default!;

        public string? Instructions { get; set; }
        public DateTime? DueAt { get; set; }

        public int MaxPoints { get; set; } = 100;

        public string? FileKey { get; set; }
        public string? ContentType { get; set; }

        public Guid CreatedBy { get; set; }
        public User? Creator { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<Submission> Submissions { get; set; } = new List<Submission>();
        public ICollection<Grade> Grades { get; set; } = new List<Grade>();
    }
}
