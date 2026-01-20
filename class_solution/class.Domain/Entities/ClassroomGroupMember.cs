namespace class_api.Domain
{
    public class ClassroomGroupMember
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid GroupId { get; set; }
        public ClassroomGroup? Group { get; set; }

        public Guid UserId { get; set; }
        public User? User { get; set; }

        public string Role { get; set; } = "Member";
        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    }
}
