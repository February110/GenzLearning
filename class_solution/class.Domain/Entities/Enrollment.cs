namespace class_api.Domain
{
    public class Enrollment
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ClassroomId { get; set; }
        public Classroom? Classroom { get; set; }

        public Guid UserId { get; set; }
        public User? User { get; set; }

        public string Role { get; set; } = "Student";

        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    }
}
