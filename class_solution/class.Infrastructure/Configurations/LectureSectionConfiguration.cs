using class_api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace class_api.Infrastructure.Configurations
{
    public class LectureSectionConfiguration : IEntityTypeConfiguration<LectureSection>
    {
        public void Configure(EntityTypeBuilder<LectureSection> builder)
        {
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Title).HasMaxLength(200).IsRequired();
            builder.Property(x => x.OrderIndex).IsRequired();
            builder.Property(x => x.CreatedAt).IsRequired();
            builder.Property(x => x.UpdatedAt).IsRequired();

            builder.HasOne(x => x.Classroom)
                .WithMany(c => c.LectureSections)
                .HasForeignKey(x => x.ClassroomId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(x => x.Creator)
                .WithMany()
                .HasForeignKey(x => x.CreatedBy)
                .OnDelete(DeleteBehavior.NoAction);

            builder.HasIndex(x => new { x.ClassroomId, x.OrderIndex }).IsUnique();
        }
    }
}
