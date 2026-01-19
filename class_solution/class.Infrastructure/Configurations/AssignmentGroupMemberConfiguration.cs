using class_api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace class_api.Infrastructure.Configurations
{
    public class AssignmentGroupMemberConfiguration : IEntityTypeConfiguration<AssignmentGroupMember>
    {
        public void Configure(EntityTypeBuilder<AssignmentGroupMember> builder)
        {
            builder.HasKey(m => m.Id);
            builder.Property(m => m.Role).HasMaxLength(32).IsRequired();
            builder.Property(m => m.JoinedAt).IsRequired();

            builder.HasOne(m => m.Group)
                .WithMany(g => g.Members)
                .HasForeignKey(m => m.GroupId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(m => m.User)
                .WithMany()
                .HasForeignKey(m => m.UserId)
                .OnDelete(DeleteBehavior.NoAction);

            builder.HasOne(m => m.Assignment)
                .WithMany()
                .HasForeignKey(m => m.AssignmentId)
                .OnDelete(DeleteBehavior.NoAction);

            builder.HasIndex(m => new { m.AssignmentId, m.UserId }).IsUnique();
        }
    }
}
