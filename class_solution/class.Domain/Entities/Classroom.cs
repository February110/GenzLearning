namespace class_api.Domain
{
    public class Classroom
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public string Name { get; set; } = default!;

        public string? Description { get; set; }

        public Guid TeacherId { get; set; }
        public User? Teacher { get; set; }

        public string InviteCode { get; set; } = default!;

        public string? BannerUrl { get; set; }

        public bool InviteCodeVisible { get; set; } = true;

        public string? Section { get; set; }
        public string? Room { get; set; }
        public string? Schedule { get; set; }

        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<Enrollment> Enrollments { get; set; } = new List<Enrollment>();
        public ICollection<Assignment> Assignments { get; set; } = new List<Assignment>();
    }
}
