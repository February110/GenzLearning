using class_api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace class_api.Infrastructure.Configurations
{
    public class UserConfiguration : IEntityTypeConfiguration<User>
    {
        public void Configure(EntityTypeBuilder<User> builder)
        {
            builder.HasKey(u => u.Id);
            builder.Property(u => u.Email).HasMaxLength(255).IsRequired();
            builder.Property(u => u.PasswordHash).HasMaxLength(500);
            builder.Property(u => u.FullName).HasMaxLength(200).IsRequired();
            builder.Property(u => u.Provider).HasMaxLength(50).HasDefaultValue("local");
            builder.Property(u => u.ProviderId).HasMaxLength(255);
            builder.Property(u => u.SystemRole).HasMaxLength(20).HasDefaultValue("User");
            builder.Property(u => u.CreatedAt).IsRequired();
            builder.Property(u => u.UpdatedAt).IsRequired();

            builder.HasIndex(u => u.Email).IsUnique();
            builder.HasCheckConstraint("CK_User_Password_NotNull_When_Local", "(Provider <> 'local') OR (PasswordHash IS NOT NULL)");
        }
    }
}
