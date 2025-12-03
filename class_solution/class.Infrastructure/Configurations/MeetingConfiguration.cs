using class_api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace class_api.Infrastructure.Configurations
{
    public class MeetingConfiguration : IEntityTypeConfiguration<Meeting>
    {
        public void Configure(EntityTypeBuilder<Meeting> builder)
        {
            builder.HasKey(m => m.Id);
            builder.Property(m => m.RoomCode).HasMaxLength(100).IsRequired();
            builder.Property(m => m.Title).HasMaxLength(200);
            builder.Property(m => m.Status).HasMaxLength(20).HasDefaultValue("active");
            builder.Property(m => m.StartedAt).IsRequired();

            builder.HasIndex(m => m.RoomCode).IsUnique();
            builder.HasIndex(m => new { m.ClassroomId, m.Status });

            builder.HasOne(m => m.Classroom)
                .WithMany()
                .HasForeignKey(m => m.ClassroomId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(m => m.Creator)
                .WithMany()
                .HasForeignKey(m => m.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
