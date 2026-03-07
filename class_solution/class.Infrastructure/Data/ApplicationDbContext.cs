using class_api.Domain;
using Microsoft.EntityFrameworkCore;
using System.Reflection;

namespace class_api.Infrastructure.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users => Set<User>();
        public DbSet<Classroom> Classrooms => Set<Classroom>();
        public DbSet<ClassroomGroup> ClassroomGroups => Set<ClassroomGroup>();
        public DbSet<ClassroomGroupMember> ClassroomGroupMembers => Set<ClassroomGroupMember>();
        public DbSet<Enrollment> Enrollments => Set<Enrollment>();
        public DbSet<Assignment> Assignments => Set<Assignment>();
        public DbSet<AssignmentGroup> AssignmentGroups => Set<AssignmentGroup>();
        public DbSet<AssignmentGroupMember> AssignmentGroupMembers => Set<AssignmentGroupMember>();
        public DbSet<Submission> Submissions => Set<Submission>();
        public DbSet<Comment> Comments => Set<Comment>();
        public DbSet<Announcement> Announcements => Set<Announcement>();
        public DbSet<AnnouncementComment> AnnouncementComments => Set<AnnouncementComment>();
        public DbSet<LectureSection> LectureSections => Set<LectureSection>();
        public DbSet<LectureLesson> LectureLessons => Set<LectureLesson>();
        public DbSet<Grade> Grades => Set<Grade>();
        public DbSet<Meeting> Meetings => Set<Meeting>();
        public DbSet<MeetingParticipant> MeetingParticipants => Set<MeetingParticipant>();
        public DbSet<Notification> Notifications => Set<Notification>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
        }
    }
}
