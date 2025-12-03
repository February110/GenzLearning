namespace class_api.Domain
{
    public class Comment
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid AssignmentId { get; set; }
        public Assignment? Assignment { get; set; }
        public Guid UserId { get; set; }
        public User? User { get; set; }
        public Guid? TargetUserId { get; set; }
        public User? TargetUser { get; set; }

        public string Content { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
