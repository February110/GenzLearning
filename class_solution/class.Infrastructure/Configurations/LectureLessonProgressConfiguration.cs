using class_api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace class_api.Infrastructure.Configurations
{
    public class LectureLessonProgressConfiguration : IEntityTypeConfiguration<LectureLessonProgress>
    {
        public void Configure(EntityTypeBuilder<LectureLessonProgress> builder)
        {
            builder.HasKey(x => x.Id);
            builder.Property(x => x.TextScrollPercent).IsRequired();
            builder.Property(x => x.TextDwellSeconds).IsRequired();
            builder.Property(x => x.TextCompleted).IsRequired();
            builder.Property(x => x.VideoWatchedSeconds).IsRequired();
            builder.Property(x => x.VideoDurationSeconds);
            builder.Property(x => x.VideoCompleted).IsRequired();
            builder.Property(x => x.IsCompleted).IsRequired();
            builder.Property(x => x.CompletedAt);
            builder.Property(x => x.CreatedAt).IsRequired();
            builder.Property(x => x.UpdatedAt).IsRequired();

            builder.HasOne(x => x.Lesson)
                .WithMany()
                .HasForeignKey(x => x.LessonId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(x => new { x.LessonId, x.UserId }).IsUnique();
        }
    }
}
