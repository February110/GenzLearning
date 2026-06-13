using class_api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace class_api.Infrastructure.Configurations
{
    public class LectureLessonConfiguration : IEntityTypeConfiguration<LectureLesson>
    {
        public void Configure(EntityTypeBuilder<LectureLesson> builder)
        {
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Title).HasMaxLength(200).IsRequired();
            builder.Property(x => x.Description).HasColumnType("nvarchar(max)");
            builder.Property(x => x.OrderIndex).IsRequired();
            builder.Property(x => x.VideoKey).HasMaxLength(500);
            builder.Property(x => x.VideoName).HasMaxLength(255);
            builder.Property(x => x.CreatedAt).IsRequired();
            builder.Property(x => x.UpdatedAt).IsRequired();

            builder.HasOne(x => x.Section)
                .WithMany(s => s.Lessons)
                .HasForeignKey(x => x.SectionId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(x => x.Creator)
                .WithMany()
                .HasForeignKey(x => x.CreatedBy)
                .OnDelete(DeleteBehavior.NoAction);

            builder.HasIndex(x => new { x.SectionId, x.OrderIndex }).IsUnique();
        }
    }
}
