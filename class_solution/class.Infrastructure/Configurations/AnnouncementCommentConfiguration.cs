using class_api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace class_api.Infrastructure.Configurations
{
    public class AnnouncementCommentConfiguration : IEntityTypeConfiguration<AnnouncementComment>
    {
        public void Configure(EntityTypeBuilder<AnnouncementComment> builder)
        {
            builder.HasKey(ac => ac.Id);
            builder.Property(ac => ac.Content).HasMaxLength(2000).IsRequired();
            builder.Property(ac => ac.CreatedAt).IsRequired();

            builder.HasOne(ac => ac.Announcement)
                .WithMany()
                .HasForeignKey(ac => ac.AnnouncementId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(ac => ac.User)
                .WithMany()
                .HasForeignKey(ac => ac.UserId)
                .OnDelete(DeleteBehavior.NoAction);
        }
    }
}
