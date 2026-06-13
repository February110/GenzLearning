using System.Text.Json;
using class_api.Domain;
using class_api.Infrastructure.Data;
using class_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace class_api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/student/assignments")]
    public class StudentAssignmentsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IStorage _storage;
        private readonly ICurrentUser _me;
        private readonly IActivityStream _activityStream;

        public StudentAssignmentsController(
            ApplicationDbContext db,
            IStorage storage,
            ICurrentUser me,
            IActivityStream activityStream)
        {
            _db = db;
            _storage = storage;
            _me = me;
            _activityStream = activityStream;
        }

        [HttpGet("{assignmentId:guid}")]
        public async Task<IActionResult> GetQuizForStudent(Guid assignmentId, CancellationToken ct)
        {
            var access = await LoadStudentAssignment(assignmentId, ct);
            if (access.Result != null) return access.Result;

            var assignment = access.Assignment!;
            var existingSubmission = await _db.QuizSubmissions
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.AssignmentId == assignmentId && s.UserId == _me.UserId, ct);

            var quiz = await ReadQuiz(assignment.QuizBlobKey!, ct);
            quiz.AssignmentId = assignment.Id;
            var safeQuiz = QuizService.RemoveCorrectAnswers(quiz);

            return Ok(new
            {
                message = "Lấy bài tập thành công",
                data = new
                {
                    assignment.Id,
                    assignment.Title,
                    assignment.Status,
                    assignment.DueAt,
                    assignment.QuizTimeLimitMinutes,
                    quiz = safeQuiz,
                    submission = existingSubmission == null ? null : new
                    {
                        existingSubmission.Id,
                        existingSubmission.CorrectCount,
                        existingSubmission.TotalQuestions,
                        existingSubmission.Score,
                        existingSubmission.SubmittedAt
                    }
                }
            });
        }

        [HttpPost("{assignmentId:guid}/submit")]
        public async Task<IActionResult> SubmitQuiz(Guid assignmentId, [FromBody] SubmitQuizRequest request, CancellationToken ct)
        {
            var access = await LoadStudentAssignment(assignmentId, ct);
            if (access.Result != null) return access.Result;

            var assignment = access.Assignment!;
            if (assignment.DueAt.HasValue && assignment.DueAt.Value <= DateTime.UtcNow)
                return BadRequest(new { message = "Bài tập đã quá hạn nộp." });

            var existingSubmission = await _db.QuizSubmissions
                .FirstOrDefaultAsync(s => s.AssignmentId == assignmentId && s.UserId == _me.UserId, ct);
            if (existingSubmission != null)
                return BadRequest(new { message = "Bạn đã nộp bài trắc nghiệm này." });

            if (request.Answers == null || request.Answers.Count == 0)
                return BadRequest(new { message = "Chưa có câu trả lời để nộp." });

            var quiz = await ReadQuiz(assignment.QuizBlobKey!, ct);
            var grade = QuizService.GradeQuiz(quiz, request.Answers);
            var answersJson = JsonSerializer.Serialize(request.Answers, new JsonSerializerOptions(JsonSerializerDefaults.Web));
            var now = DateTime.UtcNow;

            var submission = new QuizSubmission
            {
                AssignmentId = assignmentId,
                UserId = _me.UserId,
                AnswersJson = answersJson,
                CorrectCount = grade.CorrectCount,
                TotalQuestions = grade.TotalQuestions,
                Score = grade.Score,
                SubmittedAt = now
            };
            _db.QuizSubmissions.Add(submission);

            var gradeRow = await _db.Grades
                .FirstOrDefaultAsync(g => g.AssignmentId == assignmentId && g.UserId == _me.UserId, ct);
            if (gradeRow == null)
            {
                gradeRow = new Grade
                {
                    AssignmentId = assignmentId,
                    UserId = _me.UserId,
                    CreatedAt = now
                };
                _db.Grades.Add(gradeRow);
            }

            gradeRow.Score = grade.Score;
            gradeRow.Status = "returned";
            gradeRow.Feedback = $"Trắc nghiệm: {grade.CorrectCount}/{grade.TotalQuestions} câu đúng.";
            gradeRow.UpdatedAt = now;

            await _db.SaveChangesAsync(ct);

            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == _me.UserId, ct);
            await _activityStream.PublishAsync(new ActivityEvent("submission",
                user?.FullName ?? _me.Email,
                $"nộp trắc nghiệm \"{assignment.Title}\"",
                assignment.Classroom?.Name,
                now));

            return Ok(new
            {
                message = "Nộp bài thành công",
                data = new
                {
                    assignmentId = assignment.Id,
                    studentId = _me.UserId,
                    grade.CorrectCount,
                    grade.TotalQuestions,
                    grade.Score
                }
            });
        }

        private async Task<(Assignment? Assignment, IActionResult? Result)> LoadStudentAssignment(Guid assignmentId, CancellationToken ct)
        {
            var assignment = await _db.Assignments
                .Include(a => a.Classroom)
                .FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
            if (assignment == null)
                return (null, NotFound(new { message = "Không tìm thấy bài tập." }));

            var membership = await _db.Enrollments
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.ClassroomId == assignment.ClassroomId && e.UserId == _me.UserId, ct);
            if (membership == null)
                return (null, Forbid());
            if (!string.Equals(membership.Role, "Student", StringComparison.OrdinalIgnoreCase))
                return (null, Forbid());

            if (!string.Equals(assignment.AssignmentType, "ai_quiz", StringComparison.OrdinalIgnoreCase) ||
                string.IsNullOrWhiteSpace(assignment.QuizBlobKey))
            {
                return (null, BadRequest(new { message = "Bài tập này không phải bài trắc nghiệm." }));
            }

            if (!string.Equals(assignment.Status, "published", StringComparison.OrdinalIgnoreCase))
                return (null, BadRequest(new { message = "Bài trắc nghiệm chưa được giao." }));

            return (assignment, null);
        }

        private async Task<QuizDataDto> ReadQuiz(string blobKey, CancellationToken ct)
        {
            var json = await _storage.ReadTextAsync(blobKey, ct);
            if (string.IsNullOrWhiteSpace(json))
                throw new FileNotFoundException("Không tìm thấy file quiz.json trên Azure Blob.");

            var quiz = JsonSerializer.Deserialize<QuizDataDto>(
                json,
                new JsonSerializerOptions(JsonSerializerDefaults.Web)
                {
                    PropertyNameCaseInsensitive = true
                }) ?? new QuizDataDto();

            return QuizService.NormalizeQuiz(quiz);
        }
    }
}
