namespace class_api.Domain
{
    public class AssignmentGroupMember
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid AssignmentId { get; set; }
        public Assignment? Assignment { get; set; }

        public Guid GroupId { get; set; }
        public AssignmentGroup? Group { get; set; }

        public Guid UserId { get; set; }
        public User? User { get; set; }

        public string Role { get; set; } = "Member";
        public bool CanSubmit { get; set; } = false;

        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    }
}
