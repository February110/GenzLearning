namespace class_api.Domain
{
    public class MeetingParticipant
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid MeetingId { get; set; }
        public Meeting? Meeting { get; set; }

        public Guid UserId { get; set; }
        public User? User { get; set; }

        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LeftAt { get; set; }
    }
}
