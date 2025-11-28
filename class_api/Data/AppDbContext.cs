using class_api.Domain;
using Microsoft.EntityFrameworkCore;

namespace class_api.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> o) : base(o)
        {
        }

        public DbSet<User> Users => Set<User>();
        public DbSet<Classroom> Classrooms => Set<Classroom>();
        public DbSet<Enrollment> Enrollments => Set<Enrollment>();
        public DbSet<Assignment> Assignments => Set<Assignment>();
        public DbSet<Submission> Submissions => Set<Submission>();
        public DbSet<Comment> Comments => Set<Comment>();
        public DbSet<Announcement> Announcements => Set<Announcement>();
        public DbSet<AnnouncementComment> AnnouncementComments => Set<AnnouncementComment>();
        public DbSet<Grade> Grades => Set<Grade>();
        public DbSet<Meeting> Meetings => Set<Meeting>();
        public DbSet<MeetingParticipant> MeetingParticipants => Set<MeetingParticipant>();
        public DbSet<Notification> Notifications => Set<Notification>();

        protected override void OnModelCreating(ModelBuilder b)
        {
            // User
            b.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();
            b.Entity<User>()
                .HasCheckConstraint("CK_User_Password_NotNull_When_Local",
                    "(Provider <> 'local') OR (PasswordHash IS NOT NULL)");
            // Classroom
            b.Entity<Classroom>()
                .HasIndex(x => x.InviteCode).IsUnique();

            b.Entity<Classroom>()
                .HasOne(c => c.Teacher)
                .WithMany()
                .HasForeignKey(c => c.TeacherId)
                .OnDelete(DeleteBehavior.Restrict); // không xoá lớp khi xoá teacher

            // Enrollment
            b.Entity<Enrollment>()
                .HasIndex(x => new { x.ClassroomId, x.UserId }).IsUnique();

            b.Entity<Enrollment>()
                .HasOne(e => e.Classroom)
                .WithMany(c => c.Enrollments)
                .HasForeignKey(e => e.ClassroomId)
                .OnDelete(DeleteBehavior.Cascade);

            b.Entity<Enrollment>()
                .HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.NoAction); // tránh multiple cascade paths

            // Assignment
            b.Entity<Assignment>()
                .HasOne(a => a.Classroom)
                .WithMany(c => c.Assignments)
                .HasForeignKey(a => a.ClassroomId)
                .OnDelete(DeleteBehavior.Cascade);

            // Submission
            b.Entity<Submission>()
                .HasOne(s => s.Assignment)
                .WithMany()
                .HasForeignKey(s => s.AssignmentId)
                .OnDelete(DeleteBehavior.Cascade);

            b.Entity<Submission>()
                .HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.NoAction);

            // Comment
            b.Entity<Comment>()
                .HasOne(c => c.Assignment)
                .WithMany()
                .HasForeignKey(c => c.AssignmentId)
                .OnDelete(DeleteBehavior.Cascade);

            b.Entity<Comment>()
                .HasOne(c => c.User)
                .WithMany()
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.NoAction);

            // Announcement
            b.Entity<Announcement>()
                .HasOne(a => a.Classroom)
                .WithMany()
                .HasForeignKey(a => a.ClassroomId)
                .OnDelete(DeleteBehavior.Cascade);

            b.Entity<Announcement>()
                .HasOne(a => a.User)
                .WithMany()
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.NoAction);

            b.Entity<Announcement>()
                .HasIndex(a => new { a.ClassroomId, a.CreatedAt });

            // AnnouncementComment
            b.Entity<AnnouncementComment>()
                .HasOne(c => c.Announcement)
                .WithMany()
                .HasForeignKey(c => c.AnnouncementId)
                .OnDelete(DeleteBehavior.Cascade);

            b.Entity<AnnouncementComment>()
                .HasOne(c => c.User)
                .WithMany()
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.NoAction);

            b.Entity<Grade>()
                .HasIndex(g => new { g.AssignmentId, g.UserId })
                .IsUnique();

            b.Entity<Grade>()
                .HasOne(g => g.Assignment)
                .WithMany(a => a.Grades)
                .HasForeignKey(g => g.AssignmentId)
                .OnDelete(DeleteBehavior.Cascade);

            b.Entity<Grade>()
                .HasOne(g => g.User)
                .WithMany()
                .HasForeignKey(g => g.UserId)
                .OnDelete(DeleteBehavior.NoAction);

            b.Entity<Grade>()
                .HasOne(g => g.Submission)
                .WithMany(s => s.Grades)
                .HasForeignKey(g => g.SubmissionId)
                .OnDelete(DeleteBehavior.NoAction);

            // Meeting
            b.Entity<Meeting>()
                .HasIndex(m => m.RoomCode)
                .IsUnique();

            b.Entity<Meeting>()
                .HasIndex(m => new { m.ClassroomId, m.Status });

            b.Entity<Meeting>()
                .HasOne(m => m.Classroom)
                .WithMany()
                .HasForeignKey(m => m.ClassroomId)
                .OnDelete(DeleteBehavior.Cascade);

            b.Entity<Meeting>()
                .HasOne(m => m.Creator)
                .WithMany()
                .HasForeignKey(m => m.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict);

            // MeetingParticipant
            b.Entity<MeetingParticipant>()
                .HasIndex(mp => new { mp.MeetingId, mp.UserId })
                .IsUnique();

            b.Entity<MeetingParticipant>()
                .HasOne(mp => mp.Meeting)
                .WithMany(m => m.Participants)
                .HasForeignKey(mp => mp.MeetingId)
                .OnDelete(DeleteBehavior.Cascade);

            b.Entity<MeetingParticipant>()
                .HasOne(mp => mp.User)
                .WithMany()
                .HasForeignKey(mp => mp.UserId)
                .OnDelete(DeleteBehavior.NoAction);

            b.Entity<Notification>()
                .HasIndex(n => new { n.UserId, n.IsRead });

            b.Entity<Notification>()
                .Property(n => n.Title)
                .HasMaxLength(150);

            b.Entity<Notification>()
                .Property(n => n.Type)
                .HasMaxLength(50);
        }
    }
}
