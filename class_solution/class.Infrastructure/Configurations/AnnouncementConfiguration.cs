using class_api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace class_api.Infrastructure.Configurations
{
    public class AnnouncementConfiguration : IEntityTypeConfiguration<Announcement>
    {
        public void Configure(EntityTypeBuilder<Announcement> builder)
        {
            builder.HasKey(a => a.Id);
            builder.Property(a => a.Content).HasMaxLength(4000).IsRequired();
            builder.Property(a => a.TargetUserIdsJson).HasMaxLength(4000);
            builder.Property(a => a.CreatedAt).IsRequired();

            builder.HasIndex(a => new { a.ClassroomId, a.CreatedAt });

            builder.HasOne(a => a.Classroom)
                .WithMany()
                .HasForeignKey(a => a.ClassroomId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(a => a.User)
                .WithMany()
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.NoAction);
        }
    }
}
