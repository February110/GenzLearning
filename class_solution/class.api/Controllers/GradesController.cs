using class_api.Infrastructure.Data;
using class_api.Domain;
using class_api.Application.Dtos;
using class_api.Services;
using class_api.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;

namespace class_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class GradesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUser _me;
        private readonly IActivityStream _activityStream;
        private readonly IHubContext<NotificationHub> _hub;

        public GradesController(ApplicationDbContext db, ICurrentUser me, IActivityStream activityStream, IHubContext<NotificationHub> hub)
        {
            _db = db;
            _me = me;
            _activityStream = activityStream;
            _hub = hub;
        }

        [HttpPut("{submissionId:guid}")]
        public async Task<IActionResult> Grade(Guid submissionId, [FromBody] GradeDto dto, CancellationToken ct)
        {
            if (dto == null) return BadRequest(new { message = "Thiếu dữ liệu chấm điểm." });

            var sub = await _db.Submissions
                .Include(s => s.Assignment)
                .ThenInclude(a => a.Classroom)
                .Include(s => s.User)
                .FirstOrDefaultAsync(s => s.Id == submissionId, ct);

            if (sub == null) return NotFound("Submission not found");
            if (sub.Assignment == null) return NotFound("Assignment not found for submission");

            var member = await _db.Enrollments.Include(e => e.User).FirstOrDefaultAsync(e =>
                e.ClassroomId == sub.Assignment!.ClassroomId && e.UserId == _me.UserId, ct);

            if (member == null || member.Role != "Teacher") return Forbid();

            var grade = await _db.Grades
                .FirstOrDefaultAsync(g => g.AssignmentId == sub.AssignmentId && g.UserId == sub.UserId, ct);

            var now = DateTime.UtcNow;
            var status = string.IsNullOrWhiteSpace(dto.Status) ? "graded" : dto.Status.Trim();

            if (grade == null)
            {
                grade = new Grade
                {
                    AssignmentId = sub.AssignmentId,
                    UserId = sub.UserId,
                    SubmissionId = sub.Id,
                    Score = dto.Grade,
                    Feedback = dto.Feedback,
                    Status = status,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                _db.Grades.Add(grade);
            }
            else
            {
                grade.Score = dto.Grade;
                grade.Feedback = dto.Feedback;
                grade.Status = status;
                grade.SubmissionId = sub.Id;
                grade.UpdatedAt = now;
            }

            await _db.SaveChangesAsync(ct);
            var studentName = sub.User?.FullName ?? "học viên";
            var className = sub.Assignment?.Title ?? string.Empty;
            await _activityStream.PublishAsync(new ActivityEvent("grade",
                member.User?.FullName ?? "Giáo viên",
                $"chấm {studentName} {dto.Grade} điểm",
                className,
                DateTime.UtcNow));
            try
            {
                var realtimePayload = new
                {
                    assignmentId = sub.AssignmentId,
                    submissionId = sub.Id,
                    grade = grade.Score,
                    feedback = grade.Feedback,
                    gradeStatus = grade.Status,
                    updatedAt = DateTime.SpecifyKind(grade.UpdatedAt, DateTimeKind.Utc)
                };
                await _hub.Clients.Group($"user:{sub.UserId}").SendAsync("GradeUpdated", realtimePayload, ct);
            }
            catch
            {
            }
            return Ok(new
            {
                message = "Graded successfully",
                grade = grade.Score,
                feedback = grade.Feedback,
                gradeStatus = grade.Status
            });
        }
    }
}

