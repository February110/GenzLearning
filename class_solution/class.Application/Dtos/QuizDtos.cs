namespace class_api.Application.Dtos
{
    public class GenerateQuizRequest
    {
        public string Title { get; set; } = string.Empty;
        public string Topic { get; set; } = string.Empty;
        public string LessonContent { get; set; } = string.Empty;
        public int NumberOfQuestions { get; set; } = 10;
        public string Difficulty { get; set; } = "Trung bình";
        public int AnswersPerQuestion { get; set; } = 4;
    }

    public class GenerateQuizFromLectureRequest
    {
        public Guid ClassroomId { get; set; }
        public Guid LessonId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Topic { get; set; } = string.Empty;
        public int NumberOfQuestions { get; set; } = 10;
        public string Difficulty { get; set; } = "Trung bình";
        public int AnswersPerQuestion { get; set; } = 4;
    }

    public class SaveAiQuizRequest
    {
        public Guid? ClassId { get; set; }
        public Guid? ClassroomId { get; set; }
        public string Title { get; set; } = string.Empty;
        public int? TimeLimitMinutes { get; set; }
        public DateTime? DueAt { get; set; }
        public int? MaxPoints { get; set; }
        public bool Publish { get; set; }
        public QuizDataDto QuizData { get; set; } = new();
    }

    public class SubmitQuizRequest
    {
        public List<QuizAnswerDto> Answers { get; set; } = new();
    }

    public class QuizDataDto
    {
        public Guid? AssignmentId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Topic { get; set; } = string.Empty;
        public string Difficulty { get; set; } = string.Empty;
        public int QuestionCount { get; set; }
        public List<QuizQuestionDto> Questions { get; set; } = new();
    }

    public class QuizQuestionDto
    {
        public string Id { get; set; } = string.Empty;
        public string Question { get; set; } = string.Empty;
        public List<QuizOptionDto> Options { get; set; } = new();
        public string? CorrectOptionId { get; set; }
        public string? Explanation { get; set; }
    }

    public class QuizOptionDto
    {
        public string Id { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }

    public class QuizAnswerDto
    {
        public string QuestionId { get; set; } = string.Empty;
        public string SelectedOptionId { get; set; } = string.Empty;
    }

    public sealed record QuizGradeResult(int CorrectCount, int TotalQuestions, double Score);
}
