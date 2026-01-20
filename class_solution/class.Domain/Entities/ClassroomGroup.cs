namespace class_api.Domain
{
    public class ClassroomGroup
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ClassroomId { get; set; }
        public Classroom? Classroom { get; set; }

        public string Name { get; set; } = default!;

        public Guid LeaderId { get; set; }
        public User? Leader { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<ClassroomGroupMember> Members { get; set; } = new List<ClassroomGroupMember>();
    }
}
