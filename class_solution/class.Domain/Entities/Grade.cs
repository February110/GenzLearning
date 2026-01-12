namespace class_api.Domain
{
    public class Grade
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid AssignmentId { get; set; }
        public Assignment? Assignment { get; set; }

        public Guid UserId { get; set; }
        public User? User { get; set; }

        public Guid? SubmissionId { get; set; }
        public Submission? Submission { get; set; }

        public double Score { get; set; }
        public string? Feedback { get; set; }
        public string Status { get; set; } = "pending";

        public string? ReturnedFileKey { get; set; }
        public string? ReturnedFileName { get; set; }
        public string? ReturnedContentType { get; set; }
        public long? ReturnedFileSize { get; set; }
        public DateTime? ReturnedAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
