using class_api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace class_api.Infrastructure.Configurations
{
    public class QuizSubmissionConfiguration : IEntityTypeConfiguration<QuizSubmission>
    {
        public void Configure(EntityTypeBuilder<QuizSubmission> builder)
        {
            builder.HasKey(x => x.Id);
            builder.Property(x => x.AnswersJson).HasColumnType("nvarchar(max)").IsRequired();
            builder.Property(x => x.CorrectCount).IsRequired();
            builder.Property(x => x.TotalQuestions).IsRequired();
            builder.Property(x => x.Score).IsRequired();
            builder.Property(x => x.SubmittedAt).IsRequired();

            builder.HasOne(x => x.Assignment)
                .WithMany(a => a.QuizSubmissions)
                .HasForeignKey(x => x.AssignmentId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.NoAction);

            builder.HasIndex(x => new { x.AssignmentId, x.UserId }).IsUnique();
        }
    }
}
