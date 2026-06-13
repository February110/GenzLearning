namespace class_api.Domain
{
    public class QuizSubmission
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid AssignmentId { get; set; }
        public Assignment? Assignment { get; set; }

        public Guid UserId { get; set; }
        public User? User { get; set; }

        public string AnswersJson { get; set; } = default!;
        public int CorrectCount { get; set; }
        public int TotalQuestions { get; set; }
        public double Score { get; set; }

        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    }
}
