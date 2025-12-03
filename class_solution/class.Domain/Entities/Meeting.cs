namespace class_api.Domain
{
    public class Meeting
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ClassroomId { get; set; }
        public Classroom? Classroom { get; set; }

        public Guid CreatedBy { get; set; }
        public User? Creator { get; set; }

        public string RoomCode { get; set; } = default!;

        public string? Title { get; set; }

        public DateTime StartedAt { get; set; } = DateTime.UtcNow;
        public DateTime? EndedAt { get; set; }

        public string Status { get; set; } = "active";

        public ICollection<MeetingParticipant> Participants { get; set; } = new List<MeetingParticipant>();
    }
}
