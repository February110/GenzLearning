using class_api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace class_api.Infrastructure.Configurations
{
    public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
    {
        public void Configure(EntityTypeBuilder<Notification> builder)
        {
            builder.HasKey(n => n.Id);
            builder.Property(n => n.Title).HasMaxLength(150).IsRequired();
            builder.Property(n => n.Message).HasMaxLength(500).IsRequired();
            builder.Property(n => n.Type).HasMaxLength(50).IsRequired();
            builder.Property(n => n.CreatedAt).IsRequired();

            builder.HasIndex(n => new { n.UserId, n.IsRead });
        }
    }
}
