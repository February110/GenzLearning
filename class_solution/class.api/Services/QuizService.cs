using System.Text.Json;

namespace class_api.Services
{
    public static class QuizService
    {
        private static readonly string[] OptionIds = ["A", "B", "C", "D"];

        public static List<string> ValidateQuiz(QuizDataDto quiz, int? expectedQuestionCount = null, int answersPerQuestion = 4)
        {
            var errors = new List<string>();

            if (string.IsNullOrWhiteSpace(quiz.Title)) errors.Add("Thiếu tiêu đề bài trắc nghiệm.");
            if (string.IsNullOrWhiteSpace(quiz.Topic)) errors.Add("Thiếu chủ đề bài trắc nghiệm.");
            if (string.IsNullOrWhiteSpace(quiz.Difficulty)) errors.Add("Thiếu mức độ bài trắc nghiệm.");
            if (quiz.Questions == null || quiz.Questions.Count == 0)
            {
                errors.Add("Danh sách câu hỏi không hợp lệ.");
                return errors;
            }

            if (expectedQuestionCount.HasValue && Math.Abs(quiz.Questions.Count - expectedQuestionCount.Value) > 1)
            {
                errors.Add($"Số câu hỏi AI trả về là {quiz.Questions.Count}, không gần với yêu cầu {expectedQuestionCount.Value}.");
            }

            var seenQuestions = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var allowedOptionIds = OptionIds.Take(Math.Clamp(answersPerQuestion, 2, OptionIds.Length)).ToHashSet(StringComparer.OrdinalIgnoreCase);

            for (var i = 0; i < quiz.Questions.Count; i++)
            {
                var q = quiz.Questions[i];
                var label = $"Câu {i + 1}";

                if (string.IsNullOrWhiteSpace(q.Id)) errors.Add($"{label}: thiếu id.");
                if (string.IsNullOrWhiteSpace(q.Question)) errors.Add($"{label}: thiếu nội dung câu hỏi.");
                if (!string.IsNullOrWhiteSpace(q.Question))
                {
                    var normalized = NormalizeText(q.Question);
                    if (!seenQuestions.Add(normalized)) errors.Add($"{label}: câu hỏi bị trùng lặp.");
                }

                if (q.Options == null || q.Options.Count != answersPerQuestion)
                {
                    errors.Add($"{label}: phải có đúng {answersPerQuestion} đáp án.");
                    continue;
                }

                var seenOptionIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var option in q.Options)
                {
                    if (string.IsNullOrWhiteSpace(option.Id))
                    {
                        errors.Add($"{label}: có đáp án thiếu id.");
                        continue;
                    }

                    var optionId = option.Id.Trim().ToUpperInvariant();
                    if (!allowedOptionIds.Contains(optionId))
                        errors.Add($"{label}: id đáp án '{option.Id}' không nằm trong {string.Join("/", allowedOptionIds)}.");
                    if (!seenOptionIds.Add(optionId))
                        errors.Add($"{label}: id đáp án '{option.Id}' bị trùng.");
                    if (string.IsNullOrWhiteSpace(option.Content))
                        errors.Add($"{label}: đáp án {option.Id} bị rỗng.");
                }

                if (string.IsNullOrWhiteSpace(q.CorrectOptionId))
                {
                    errors.Add($"{label}: thiếu đáp án đúng.");
                }
                else if (!allowedOptionIds.Contains(q.CorrectOptionId.Trim().ToUpperInvariant()))
                {
                    errors.Add($"{label}: correctOptionId phải nằm trong {string.Join("/", allowedOptionIds)}.");
                }
            }

            return errors.Distinct().ToList();
        }

        public static QuizDataDto NormalizeQuiz(QuizDataDto quiz)
        {
            quiz.Title = quiz.Title?.Trim() ?? string.Empty;
            quiz.Topic = quiz.Topic?.Trim() ?? string.Empty;
            quiz.Difficulty = quiz.Difficulty?.Trim() ?? string.Empty;
            quiz.Questions ??= new List<QuizQuestionDto>();
            quiz.QuestionCount = quiz.Questions.Count;

            for (var i = 0; i < quiz.Questions.Count; i++)
            {
                var question = quiz.Questions[i];
                question.Id = string.IsNullOrWhiteSpace(question.Id) ? $"q{i + 1}" : question.Id.Trim();
                question.Question = question.Question?.Trim() ?? string.Empty;
                question.CorrectOptionId = question.CorrectOptionId?.Trim().ToUpperInvariant();
                question.Explanation = string.IsNullOrWhiteSpace(question.Explanation) ? null : question.Explanation.Trim();
                question.Options ??= new List<QuizOptionDto>();

                for (var j = 0; j < question.Options.Count; j++)
                {
                    var option = question.Options[j];
                    option.Id = string.IsNullOrWhiteSpace(option.Id)
                        ? OptionIds[Math.Min(j, OptionIds.Length - 1)]
                        : option.Id.Trim().ToUpperInvariant();
                    option.Content = option.Content?.Trim() ?? string.Empty;
                }
            }

            return quiz;
        }

        public static QuizDataDto RemoveCorrectAnswers(QuizDataDto quiz)
        {
            return new QuizDataDto
            {
                AssignmentId = quiz.AssignmentId,
                Title = quiz.Title,
                Topic = quiz.Topic,
                Difficulty = quiz.Difficulty,
                QuestionCount = quiz.QuestionCount,
                Questions = quiz.Questions.Select(q => new QuizQuestionDto
                {
                    Id = q.Id,
                    Question = q.Question,
                    Options = q.Options.Select(o => new QuizOptionDto
                    {
                        Id = o.Id,
                        Content = o.Content
                    }).ToList()
                }).ToList()
            };
        }

        public static QuizGradeResult GradeQuiz(QuizDataDto quiz, IEnumerable<QuizAnswerDto> studentAnswers)
        {
            var answerMap = studentAnswers
                .Where(a => !string.IsNullOrWhiteSpace(a.QuestionId))
                .GroupBy(a => a.QuestionId.Trim(), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.Last().SelectedOptionId?.Trim().ToUpperInvariant() ?? string.Empty, StringComparer.OrdinalIgnoreCase);

            var correctCount = 0;
            foreach (var question in quiz.Questions)
            {
                if (!answerMap.TryGetValue(question.Id, out var selected)) continue;
                if (string.Equals(selected, question.CorrectOptionId, StringComparison.OrdinalIgnoreCase))
                    correctCount++;
            }

            var total = quiz.Questions.Count;
            var score = total > 0 ? Math.Round(correctCount / (double)total * 10d, 2) : 0d;
            return new QuizGradeResult(correctCount, total, score);
        }

        public static string ToJson(QuizDataDto quiz)
        {
            return JsonSerializer.Serialize(quiz, new JsonSerializerOptions(JsonSerializerDefaults.Web)
            {
                WriteIndented = true
            });
        }

        private static string NormalizeText(string input)
        {
            return string.Join(" ", input.Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));
        }
    }
}
