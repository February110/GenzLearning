using System.ComponentModel.DataAnnotations;

namespace class_api.Domain
{
    public class User
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        [MaxLength(255)]
        public string Email { get; set; } = default!;

        [MaxLength(500)]
        public string? PasswordHash { get; set; }   

        [MaxLength(200)]
        public string FullName { get; set; } = default!;

        public string? Avatar { get; set; }

        [MaxLength(50)]
        public string Provider { get; set; } = "local"; 

        [MaxLength(255)]
        public string? ProviderId { get; set; }

        public bool IsActive { get; set; } = true;

        [MaxLength(20)]
        public string SystemRole { get; set; } = "User";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastLoginAt { get; set; }

        public ICollection<Enrollment> Enrollments { get; set; } = new List<Enrollment>();
        public ICollection<Assignment> CreatedAssignments { get; set; } = new List<Assignment>();
        public ICollection<Submission> Submissions { get; set; } = new List<Submission>();
    }

    public class Classroom
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        [MaxLength(200)]
        public string Name { get; set; } = default!;

        public string? Description { get; set; }

        public Guid TeacherId { get; set; }
        public User? Teacher { get; set; }

        [MaxLength(50)]
        public string InviteCode { get; set; } = default!;

        // Banner image url (e.g. /images/banners/banner-1.svg)
        [MaxLength(500)]
        public string? BannerUrl { get; set; }

        public bool InviteCodeVisible { get; set; } = true;

        public string? Section { get; set; }
        public string? Room { get; set; }
        public string? Schedule { get; set; }

        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // 🔹 Navigation
        public ICollection<Enrollment> Enrollments { get; set; } = new List<Enrollment>();
        public ICollection<Assignment> Assignments { get; set; } = new List<Assignment>();
    }

    public class Enrollment
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ClassroomId { get; set; }
        public Classroom? Classroom { get; set; }

        public Guid UserId { get; set; }
        public User? User { get; set; }

        // Role của người trong lớp ("Teacher" hoặc "Student")
        [MaxLength(20)]
        public string Role { get; set; } = "Student";

        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    }

    public class Assignment
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ClassroomId { get; set; }
        public Classroom? Classroom { get; set; }

        [MaxLength(200)]
        public string Title { get; set; } = default!;

        public string? Instructions { get; set; }
        public DateTime? DueAt { get; set; }

        public int MaxPoints { get; set; } = 100;

        // Ai tạo bài tập
        public Guid CreatedBy { get; set; }
        public User? Creator { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // 🔹 Navigation
        public ICollection<Submission> Submissions { get; set; } = new List<Submission>();
        public ICollection<Grade> Grades { get; set; } = new List<Grade>();
    }

    public class Submission
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid AssignmentId { get; set; }
        public Assignment? Assignment { get; set; }

        public Guid UserId { get; set; }
        public User? User { get; set; }

        // File lưu trên Azure Blob
        [MaxLength(500)]
        public string FileKey { get; set; } = default!;
        public string? ContentType { get; set; }
        public long FileSize { get; set; }

        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
        public ICollection<Grade> Grades { get; set; } = new List<Grade>();

        // Legacy grading columns (kept for backwards compatibility)
    }

    public class Grade
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid AssignmentId { get; set; }
        public Assignment? Assignment { get; set; }

        public Guid UserId { get; set; }
        public User? User { get; set; }

        public Guid? SubmissionId { get; set; }
        public Submission? Submission { get; set; }

        public double Score { get; set; }
        public string? Feedback { get; set; }
        public string Status { get; set; } = "pending";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Comment
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid AssignmentId { get; set; }
        public Assignment? Assignment { get; set; }
        public Guid UserId { get; set; }
        public User? User { get; set; }
        public Guid? TargetUserId { get; set; }
        public User? TargetUser { get; set; }

        [MaxLength(2000)]
        public string Content { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    // Thông báo trong lớp học
    public class Announcement
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ClassroomId { get; set; }
        public Classroom? Classroom { get; set; }

        // Người tạo (giáo viên)
        public Guid UserId { get; set; }
        public User? User { get; set; }

        [MaxLength(4000)]
        public string Content { get; set; } = string.Empty;

        // true = tất cả học viên; false = chỉ một số học viên
        public bool IsForAll { get; set; } = true;

        // lưu danh sách userId dạng JSON khi IsForAll=false
        [MaxLength(4000)]
        public string? TargetUserIdsJson { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class AnnouncementComment
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid AnnouncementId { get; set; }
        public Announcement? Announcement { get; set; }

        public Guid UserId { get; set; }
        public User? User { get; set; }

        [MaxLength(2000)]
        public string Content { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Meeting
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ClassroomId { get; set; }
        public Classroom? Classroom { get; set; }

        public Guid CreatedBy { get; set; }
        public User? Creator { get; set; }

        [MaxLength(100)]
        public string RoomCode { get; set; } = default!;

        [MaxLength(200)]
        public string? Title { get; set; }

        public DateTime StartedAt { get; set; } = DateTime.UtcNow;
        public DateTime? EndedAt { get; set; }

        [MaxLength(20)]
        public string Status { get; set; } = "active";

        public ICollection<MeetingParticipant> Participants { get; set; } = new List<MeetingParticipant>();
    }

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

    public class Notification
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public User? User { get; set; }

        [MaxLength(150)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(500)]
        public string Message { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Type { get; set; } = string.Empty; // announcement, assignment, assignment-due

        public Guid? ClassroomId { get; set; }
        public Guid? AssignmentId { get; set; }
        public string? MetadataJson { get; set; }

        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ReadAt { get; set; }
    }
}
