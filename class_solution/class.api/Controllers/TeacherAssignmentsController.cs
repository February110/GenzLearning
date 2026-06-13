using System.Text.Json;
using class_api.Infrastructure.Data;
using class_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace class_api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/teacher/assignments")]
    public class TeacherAssignmentsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IStorage _storage;
        private readonly ICurrentUser _me;

        public TeacherAssignmentsController(ApplicationDbContext db, IStorage storage, ICurrentUser me)
        {
            _db = db;
            _storage = storage;
            _me = me;
        }

        [HttpGet("{assignmentId:guid}")]
        public async Task<IActionResult> GetFullQuiz(Guid assignmentId, CancellationToken ct)
        {
            var assignment = await _db.Assignments
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
            if (assignment == null) return NotFound(new { message = "Không tìm thấy bài tập." });

            var isTeacher = await _db.Enrollments.AnyAsync(e =>
                e.ClassroomId == assignment.ClassroomId &&
                e.UserId == _me.UserId &&
                e.Role == "Teacher", ct);
            var isAdmin = await _db.Users.AnyAsync(u => u.Id == _me.UserId && u.SystemRole == "Admin" && u.IsActive, ct);
            if (!isTeacher && !isAdmin) return Forbid();

            if (!string.Equals(assignment.AssignmentType, "ai_quiz", StringComparison.OrdinalIgnoreCase) ||
                string.IsNullOrWhiteSpace(assignment.QuizBlobKey))
            {
                return BadRequest(new { message = "Bài tập này không phải bài trắc nghiệm." });
            }

            var quiz = await ReadQuiz(assignment.QuizBlobKey, ct);
            quiz.AssignmentId = assignment.Id;

            return Ok(new
            {
                message = "Lấy bài tập thành công",
                data = new
                {
                    assignment.Id,
                    assignment.Title,
                    assignment.Status,
                    assignment.QuizTimeLimitMinutes,
                    quiz
                }
            });
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
