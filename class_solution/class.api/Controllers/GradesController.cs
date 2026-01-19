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
        private readonly IStorage _storage;

        public GradesController(ApplicationDbContext db, ICurrentUser me, IActivityStream activityStream, IHubContext<NotificationHub> hub, IStorage storage)
        {
            _db = db;
            _me = me;
            _activityStream = activityStream;
            _hub = hub;
            _storage = storage;
        }

        [HttpPut("{submissionId:guid}")]
        public async Task<IActionResult> Grade(Guid submissionId, [FromBody] GradeDto dto, CancellationToken ct)
        {
            if (dto == null) return BadRequest(new { message = "Thiếu dữ liệu chấm điểm." });

            var sub = await _db.Submissions
                .Include(s => s.Assignment)
                .ThenInclude(a => a.Classroom)
                .Include(s => s.User)
                .Include(s => s.Group)
                .FirstOrDefaultAsync(s => s.Id == submissionId, ct);

            if (sub == null) return NotFound("Submission not found");
            if (sub.Assignment == null) return NotFound("Assignment not found for submission");

            var member = await _db.Enrollments.Include(e => e.User).FirstOrDefaultAsync(e =>
                e.ClassroomId == sub.Assignment!.ClassroomId && e.UserId == _me.UserId, ct);

            if (member == null || member.Role != "Teacher") return Forbid();

            var now = DateTime.UtcNow;
            var status = string.IsNullOrWhiteSpace(dto.Status) ? "graded" : dto.Status.Trim();
            var isReturned = string.Equals(status, "returned", StringComparison.OrdinalIgnoreCase);

            var targetUserIds = new List<Guid> { sub.UserId };
            if (sub.GroupId.HasValue)
            {
                targetUserIds = await _db.AssignmentGroupMembers
                    .Where(m => m.GroupId == sub.GroupId.Value)
                    .Select(m => m.UserId)
                    .ToListAsync(ct);
            }

            var existingGrades = await _db.Grades
                .Where(g => g.AssignmentId == sub.AssignmentId && targetUserIds.Contains(g.UserId))
                .ToListAsync(ct);

            var gradeMap = existingGrades.ToDictionary(g => g.UserId, g => g);
            foreach (var uid in targetUserIds)
            {
                if (!gradeMap.TryGetValue(uid, out var grade))
                {
                    grade = new Grade
                    {
                        AssignmentId = sub.AssignmentId,
                        UserId = uid,
                        SubmissionId = sub.Id,
                        Score = dto.Grade,
                        Feedback = dto.Feedback,
                        Status = status,
                        CreatedAt = now,
                        UpdatedAt = now,
                        ReturnedAt = isReturned ? now : null
                    };
                    _db.Grades.Add(grade);
                    gradeMap[uid] = grade;
                }
                else
                {
                    grade.Score = dto.Grade;
                    grade.Feedback = dto.Feedback;
                    grade.Status = status;
                    grade.SubmissionId = sub.Id;
                    grade.UpdatedAt = now;
                    if (isReturned)
                    {
                        grade.ReturnedAt = now;
                    }
                }
            }

            await _db.SaveChangesAsync(ct);
            var studentName = sub.User?.FullName ?? "học viên";
            var className = sub.Assignment?.Title ?? string.Empty;
            await _activityStream.PublishAsync(new ActivityEvent("grade",
                member.User?.FullName ?? "Giáo viên",
                sub.GroupId.HasValue ? $"chấm nhóm \"{sub.Group?.Name ?? "nhóm"}\" {dto.Grade} điểm" : $"chấm {studentName} {dto.Grade} điểm",
                className,
                DateTime.UtcNow));
            try
            {
                foreach (var uid in targetUserIds)
                {
                    if (!gradeMap.TryGetValue(uid, out var g)) continue;
                    var realtimePayload = new
                    {
                        assignmentId = sub.AssignmentId,
                        submissionId = sub.Id,
                        grade = g.Score,
                        feedback = g.Feedback,
                        gradeStatus = g.Status,
                        updatedAt = DateTime.SpecifyKind(g.UpdatedAt, DateTimeKind.Utc),
                        returnedFileKey = g.ReturnedFileKey,
                        returnedFileName = g.ReturnedFileName,
                        returnedFileSize = g.ReturnedFileSize,
                        returnedAt = g.ReturnedAt.HasValue
                            ? DateTime.SpecifyKind(g.ReturnedAt.Value, DateTimeKind.Utc)
                            : (DateTime?)null
                    };
                    await _hub.Clients.Group($"user:{uid}").SendAsync("GradeUpdated", realtimePayload, ct);
                }
            }
            catch
            {
            }
            return Ok(new
            {
                message = "Graded successfully",
                grade = dto.Grade,
                feedback = dto.Feedback,
                gradeStatus = status,
                groupApplied = sub.GroupId.HasValue,
                recipients = targetUserIds.Count
            });
        }

        [HttpPost("{submissionId:guid}/return-file")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> ReturnFile(
            Guid submissionId,
            IFormFile file,
            [FromForm] double? grade,
            [FromForm] string? feedback,
            CancellationToken ct)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Chưa chọn tệp đã chấm." });

            var sub = await _db.Submissions
                .Include(s => s.Assignment)
                .ThenInclude(a => a.Classroom)
                .Include(s => s.User)
                .Include(s => s.Group)
                .FirstOrDefaultAsync(s => s.Id == submissionId, ct);

            if (sub == null) return NotFound(new { message = "Không tìm thấy bài nộp." });
            if (sub.Assignment == null) return NotFound(new { message = "Không tìm thấy bài tập." });

            var member = await _db.Enrollments.Include(e => e.User).FirstOrDefaultAsync(e =>
                e.ClassroomId == sub.Assignment!.ClassroomId && e.UserId == _me.UserId, ct);

            if (member == null || member.Role != "Teacher") return Forbid();

            var targetUserIds = new List<Guid> { sub.UserId };
            if (sub.GroupId.HasValue)
            {
                targetUserIds = await _db.AssignmentGroupMembers
                    .Where(m => m.GroupId == sub.GroupId.Value)
                    .Select(m => m.UserId)
                    .ToListAsync(ct);
            }

            var existingGrades = await _db.Grades
                .Where(g => g.AssignmentId == sub.AssignmentId && targetUserIds.Contains(g.UserId))
                .ToListAsync(ct);

            if (existingGrades.Count == 0 && grade == null)
                return BadRequest(new { message = "Vui lòng chấm điểm trước khi trả bài." });

            string Slug(string? s)
            {
                if (string.IsNullOrWhiteSpace(s)) return "unknown";
                var cleaned = new string(s.Trim().Select(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_' ? ch : '-').ToArray());
                while (cleaned.Contains("--")) cleaned = cleaned.Replace("--", "-");
                return cleaned.Trim('-').ToLowerInvariant();
            }

            var classPart = Slug(sub.Assignment.Classroom?.Name) + "-" + sub.Assignment.ClassroomId.ToString().Substring(0, 8);
            var assignPart = Slug(sub.Assignment.Title) + "-" + sub.AssignmentId.ToString().Substring(0, 8);
            var studentPart = Slug(sub.User?.FullName ?? sub.User?.Email ?? sub.UserId.ToString());
            var groupPart = sub.GroupId.HasValue ? $"group-{Slug(sub.Group?.Name)}-{sub.GroupId.Value.ToString().Substring(0, 6)}" : studentPart;
            var prefix = $"returns/{classPart}/{assignPart}/{groupPart}";

            await using var stream = file.OpenReadStream();
            var (key, sizeBytes) = await _storage.UploadAsync(
                stream,
                file.ContentType ?? "application/octet-stream",
                prefix,
                file.FileName,
                ct
            );

            var now = DateTime.UtcNow;
            var gradeMap = existingGrades.ToDictionary(g => g.UserId, g => g);
            foreach (var uid in targetUserIds)
            {
                if (!gradeMap.TryGetValue(uid, out var existing))
                {
                    existing = new Grade
                    {
                        AssignmentId = sub.AssignmentId,
                        UserId = uid,
                        SubmissionId = sub.Id,
                        Score = grade ?? 0,
                        Feedback = feedback,
                        Status = "returned",
                        CreatedAt = now,
                        UpdatedAt = now,
                        ReturnedFileKey = key,
                        ReturnedFileName = file.FileName,
                        ReturnedContentType = file.ContentType,
                        ReturnedFileSize = sizeBytes,
                        ReturnedAt = now
                    };
                    _db.Grades.Add(existing);
                    gradeMap[uid] = existing;
                }
                else
                {
                    if (grade.HasValue) existing.Score = grade.Value;
                    if (feedback != null) existing.Feedback = feedback;
                    existing.Status = "returned";
                    existing.SubmissionId = sub.Id;
                    existing.UpdatedAt = now;
                    existing.ReturnedFileKey = key;
                    existing.ReturnedFileName = file.FileName;
                    existing.ReturnedContentType = file.ContentType;
                    existing.ReturnedFileSize = sizeBytes;
                    existing.ReturnedAt = now;
                }
            }

            await _db.SaveChangesAsync(ct);

            try
            {
                foreach (var uid in targetUserIds)
                {
                    if (!gradeMap.TryGetValue(uid, out var g)) continue;
                    var realtimePayload = new
                    {
                        assignmentId = sub.AssignmentId,
                        submissionId = sub.Id,
                        grade = g.Score,
                        feedback = g.Feedback,
                        gradeStatus = g.Status,
                        updatedAt = DateTime.SpecifyKind(g.UpdatedAt, DateTimeKind.Utc),
                        returnedFileKey = g.ReturnedFileKey,
                        returnedFileName = g.ReturnedFileName,
                        returnedFileSize = g.ReturnedFileSize,
                        returnedAt = g.ReturnedAt.HasValue
                            ? DateTime.SpecifyKind(g.ReturnedAt.Value, DateTimeKind.Utc)
                            : (DateTime?)null
                    };
                    await _hub.Clients.Group($"user:{uid}").SendAsync("GradeUpdated", realtimePayload, ct);
                }
            }
            catch
            {
            }

            return Ok(new
            {
                message = "Đã trả bài",
                grade = grade,
                feedback = feedback,
                gradeStatus = "returned",
                returnedFileKey = key,
                returnedFileName = file.FileName,
                returnedFileSize = sizeBytes,
                groupApplied = sub.GroupId.HasValue,
                recipients = targetUserIds.Count
            });
        }
    }
}

