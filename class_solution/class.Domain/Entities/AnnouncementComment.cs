namespace class_api.Domain
{
    public class AnnouncementComment
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid AnnouncementId { get; set; }
        public Announcement? Announcement { get; set; }

        public Guid UserId { get; set; }
        public User? User { get; set; }

        public string Content { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
