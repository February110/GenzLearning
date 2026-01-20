using class_api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace class_api.Infrastructure.Configurations
{
    public class ClassroomGroupConfiguration : IEntityTypeConfiguration<ClassroomGroup>
    {
        public void Configure(EntityTypeBuilder<ClassroomGroup> builder)
        {
            builder.HasKey(g => g.Id);
            builder.Property(g => g.Name).HasMaxLength(200).IsRequired();
            builder.Property(g => g.CreatedAt).IsRequired();
            builder.Property(g => g.UpdatedAt).IsRequired();

            builder.HasOne(g => g.Classroom)
                .WithMany(c => c.Groups)
                .HasForeignKey(g => g.ClassroomId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(g => g.Leader)
                .WithMany()
                .HasForeignKey(g => g.LeaderId)
                .OnDelete(DeleteBehavior.NoAction);
        }
    }
}
