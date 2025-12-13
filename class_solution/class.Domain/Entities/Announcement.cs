namespace class_api.Domain
{
    public class Announcement
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ClassroomId { get; set; }
        public Classroom? Classroom { get; set; }

        public Guid UserId { get; set; }
        public User? User { get; set; }

        public string Content { get; set; } = string.Empty;

        public bool IsForAll { get; set; } = true;

        public string? TargetUserIdsJson { get; set; }

        public string? FileKey { get; set; }
        public string? ContentType { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
