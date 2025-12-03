namespace class_api.Domain
{
    public class User
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Email { get; set; } = default!;
        public string? PasswordHash { get; set; }
        public string FullName { get; set; } = default!;

        public string? Avatar { get; set; }
        public string Provider { get; set; } = "local";
        public string? ProviderId { get; set; }

        public bool IsActive { get; set; } = true;
        public string SystemRole { get; set; } = "User";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastLoginAt { get; set; }

        public ICollection<Enrollment> Enrollments { get; set; } = new List<Enrollment>();
        public ICollection<Assignment> CreatedAssignments { get; set; } = new List<Assignment>();
        public ICollection<Submission> Submissions { get; set; } = new List<Submission>();
    }
}
