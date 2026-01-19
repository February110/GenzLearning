namespace class_api.Domain
{
    public class AssignmentGroup
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid AssignmentId { get; set; }
        public Assignment? Assignment { get; set; }

        public string Name { get; set; } = default!;

        public Guid LeaderId { get; set; }
        public User? Leader { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<AssignmentGroupMember> Members { get; set; } = new List<AssignmentGroupMember>();
        public ICollection<Submission> Submissions { get; set; } = new List<Submission>();
    }
}
