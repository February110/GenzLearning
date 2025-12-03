namespace class_api.Domain
{
    public class Submission
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid AssignmentId { get; set; }
        public Assignment? Assignment { get; set; }

        public Guid UserId { get; set; }
        public User? User { get; set; }

        public string FileKey { get; set; } = default!;
        public string? ContentType { get; set; }
        public long FileSize { get; set; }

        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
        public ICollection<Grade> Grades { get; set; } = new List<Grade>();
    }
}
