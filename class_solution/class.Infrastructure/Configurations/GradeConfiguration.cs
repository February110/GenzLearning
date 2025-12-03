using class_api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace class_api.Infrastructure.Configurations
{
    public class GradeConfiguration : IEntityTypeConfiguration<Grade>
    {
        public void Configure(EntityTypeBuilder<Grade> builder)
        {
            builder.HasKey(g => g.Id);
            builder.Property(g => g.Status).HasMaxLength(50).HasDefaultValue("pending");
            builder.Property(g => g.CreatedAt).IsRequired();
            builder.Property(g => g.UpdatedAt).IsRequired();

            builder.HasIndex(g => new { g.AssignmentId, g.UserId }).IsUnique();

            builder.HasOne(g => g.Assignment)
                .WithMany(a => a.Grades)
                .HasForeignKey(g => g.AssignmentId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(g => g.User)
                .WithMany()
                .HasForeignKey(g => g.UserId)
                .OnDelete(DeleteBehavior.NoAction);

            builder.HasOne(g => g.Submission)
                .WithMany(s => s.Grades)
                .HasForeignKey(g => g.SubmissionId)
                .OnDelete(DeleteBehavior.NoAction);
        }
    }
}
