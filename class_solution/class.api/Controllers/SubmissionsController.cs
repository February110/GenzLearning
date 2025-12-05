using class_api.Infrastructure.Data;
using class_api.Domain;
using class_api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace class_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SubmissionsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IStorage _storage;
        private readonly ICurrentUser _currentUser;
        private readonly IActivityStream _activityStream;

        public SubmissionsController(ApplicationDbContext db, IStorage storage, ICurrentUser currentUser, IActivityStream activityStream)
        {
            _db = db;
            _storage = storage;
            _currentUser = currentUser;
            _activityStream = activityStream;
        }

        [HttpPost("{assignmentId}/upload")]
        public async Task<IActionResult> Upload(Guid assignmentId, IFormFile file, CancellationToken ct)
        {
            var userId = _currentUser.UserId;
            if (userId == Guid.Empty)
                return Unauthorized(new { message = "Vui lòng đăng nhập lại." });

            if (file == null || file.Length == 0)
                return BadRequest(new { message = "File không hợp lệ." });

            var assignment = await _db.Assignments.Include(a => a.Classroom).FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
            if (assignment == null)
                return NotFound(new { message = "Không tìm thấy bài tập." });

            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
            string Slug(string? s)
            {
                if (string.IsNullOrWhiteSpace(s)) return "unknown";
                var cleaned = new string(s.Trim().Select(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_' ? ch : '-').ToArray());
                while (cleaned.Contains("--")) cleaned = cleaned.Replace("--", "-");
                return cleaned.Trim('-').ToLowerInvariant();
            }
            var classPart = Slug(assignment.Classroom?.Name) + "-" + assignment.ClassroomId.ToString().Substring(0, 8);
            var assignPart = Slug(assignment.Title) + "-" + assignment.Id.ToString().Substring(0, 8);
            var studentPart = Slug(user?.FullName ?? _currentUser.Email);
            var prefix = $"submissions/{classPart}/{assignPart}/{studentPart}";

            await using var stream = file.OpenReadStream();
            var (key, sizeBytes) = await _storage.UploadAsync(
                stream,
                file.ContentType ?? "application/octet-stream",
                prefix,
                file.FileName,
                ct
            );

            var submission = new Submission
            {
                Id = Guid.NewGuid(),
                AssignmentId = assignmentId,
                UserId = userId,
                FileKey = key,
                FileSize = sizeBytes,
                ContentType = file.ContentType,
                SubmittedAt = DateTime.UtcNow
            };

            _db.Submissions.Add(submission);
            await _db.SaveChangesAsync(ct);

            await _activityStream.PublishAsync(new ActivityEvent("submission",
                user?.FullName ?? _currentUser.Email,
                $"nộp \"{assignment.Title}\"",
                assignment.Classroom?.Name,
                DateTime.UtcNow));

            var downloadUrl = _storage.GetTemporaryUrl(key);

            return Ok(new
            {
                message = "Nộp bài thành công!",
                fileKey = key,
                downloadUrl,
                fileSize = sizeBytes,
                submittedAt = submission.SubmittedAt
            });
        }

        [HttpPost("{assignmentId}/upload-many")]
        public async Task<IActionResult> UploadMany(Guid assignmentId, [FromForm] IFormFileCollection files, CancellationToken ct)
        {
            var userId = _currentUser.UserId;
            if (userId == Guid.Empty)
                return Unauthorized(new { message = "Vui lòng đăng nhập lại." });

            if (files == null || files.Count == 0)
                return BadRequest(new { message = "Chưa chọn tệp." });

            var assignment = await _db.Assignments.Include(a => a.Classroom).FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
            if (assignment == null)
                return NotFound(new { message = "Không tìm thấy bài tập." });

            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
            string Slug2(string? s)
            {
                if (string.IsNullOrWhiteSpace(s)) return "unknown";
                var cleaned = new string(s.Trim().Select(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_' ? ch : '-').ToArray());
                while (cleaned.Contains("--")) cleaned = cleaned.Replace("--", "-");
                return cleaned.Trim('-').ToLowerInvariant();
            }
            var classPart2 = Slug2(assignment.Classroom?.Name) + "-" + assignment.ClassroomId.ToString().Substring(0, 8);
            var assignPart2 = Slug2(assignment.Title) + "-" + assignment.Id.ToString().Substring(0, 8);
            var studentPart2 = Slug2(user?.FullName ?? _currentUser.Email);
            var prefix2 = $"submissions/{classPart2}/{assignPart2}/{studentPart2}";

            var results = new List<object>();

            foreach (var f in files)
            {
                if (f == null || f.Length == 0) continue;
                await using var stream = f.OpenReadStream();
                var (key, sizeBytes) = await _storage.UploadAsync(
                    stream,
                    f.ContentType ?? "application/octet-stream",
                    prefix2,
                    f.FileName,
                    ct
                );

                var submission = new Submission
                {
                    Id = Guid.NewGuid(),
                    AssignmentId = assignmentId,
                    UserId = userId,
                    FileKey = key,
                    FileSize = sizeBytes,
                    ContentType = f.ContentType,
                    SubmittedAt = DateTime.UtcNow
                };
                _db.Submissions.Add(submission);

                results.Add(new
                {
                    fileKey = key,
                    fileSize = sizeBytes,
                    contentType = f.ContentType,
                    submittedAt = submission.SubmittedAt,
                    downloadUrl = _storage.PublicUrl(key)
                });
            }

            await _db.SaveChangesAsync(ct);
            await _activityStream.PublishAsync(new ActivityEvent("submission",
                user?.FullName ?? _currentUser.Email,
                $"nộp \"{assignment!.Title}\"",
                assignment.Classroom?.Name ?? assignment.ClassroomId.ToString(),
                DateTime.UtcNow));
            return Ok(new { message = "Đã nộp nhiều tệp.", items = results });
        }

        [HttpGet("by-assignment/{assignmentId}")]
        public async Task<IActionResult> GetByAssignment(Guid assignmentId, CancellationToken ct)
        {
            var rows = await _db.Submissions
                .Include(s => s.User)
                .Where(s => s.AssignmentId == assignmentId)
                .OrderByDescending(s => s.SubmittedAt)
                .Select(s => new
                {
                    s.Id,
                    s.UserId,
                    StudentName = s.User.FullName,
                    Email = s.User.Email,
                    s.FileSize,
                    s.SubmittedAt,
                    Grade = _db.Grades
                        .Where(g => g.AssignmentId == s.AssignmentId && g.UserId == s.UserId)
                        .Select(g => new
                        {
                            g.Id,
                            g.Score,
                            g.Feedback,
                            g.Status,
                            g.SubmissionId,
                            g.UpdatedAt
                        })
                        .FirstOrDefault()
                })
                .ToListAsync(ct);

            var result = rows.Select(item => new
            {
                item.Id,
                item.UserId,
                item.StudentName,
                item.Email,
                item.FileSize,
                item.SubmittedAt,
                grade = item.Grade?.Score,
                feedback = item.Grade?.Feedback,
                gradeStatus = item.Grade?.Status,
                gradeUpdatedAt = item.Grade != null
                    ? DateTime.SpecifyKind(item.Grade.UpdatedAt, DateTimeKind.Utc)
                    : (DateTime?)null,
                gradeId = item.Grade?.Id,
                gradeDetail = item.Grade == null
                    ? null
                    : new
                    {
                        item.Grade.Id,
                        item.Grade.Score,
                        item.Grade.Feedback,
                        item.Grade.Status,
                        item.Grade.SubmissionId,
                        UpdatedAt = DateTime.SpecifyKind(item.Grade.UpdatedAt, DateTimeKind.Utc)
                    }
            });

            return Ok(result);
        }

        [HttpGet("{id}/download")]
        public async Task<IActionResult> Download(Guid id)
        {
            var submission = await _db.Submissions.FindAsync(id);
            if (submission == null)
                return NotFound(new { message = "Không tìm thấy bài nộp." });

            var url = _storage.GetTemporaryUrl(submission.FileKey);
            return Ok(new
            {
                message = "Tạo liên kết tải thành công.",
                downloadUrl = url
            });
        }

        [HttpGet("my")]
        public async Task<IActionResult> MySubmissions(CancellationToken ct)
        {
            var uid = _currentUser.UserId;
            if (uid == Guid.Empty)
                return Unauthorized(new { message = "Vui lòng đăng nhập lại." });

            var rows = await _db.Submissions
                .Where(s => s.UserId == uid)
                .OrderByDescending(s => s.SubmittedAt)
                .Select(s => new
                {
                    s.Id,
                    s.AssignmentId,
                    s.FileKey,
                    s.FileSize,
                    s.SubmittedAt,
                    Grade = _db.Grades
                        .Where(g => g.AssignmentId == s.AssignmentId && g.UserId == uid)
                        .Select(g => new
                        {
                            g.Id,
                            g.Score,
                            g.Feedback,
                            g.Status,
                            g.SubmissionId,
                            g.UpdatedAt
                        })
                        .FirstOrDefault()
                })
                .ToListAsync(ct);

            var result = rows.Select(item => new
            {
                item.Id,
                item.AssignmentId,
                item.FileKey,
                item.FileSize,
                item.SubmittedAt,
                grade = item.Grade?.Score,
                feedback = item.Grade?.Feedback,
                gradeStatus = item.Grade?.Status,
                gradeUpdatedAt = item.Grade != null
                    ? DateTime.SpecifyKind(item.Grade.UpdatedAt, DateTimeKind.Utc)
                    : (DateTime?)null,
                gradeDetail = item.Grade == null
                    ? null
                    : new
                    {
                        item.Grade.Id,
                        item.Grade.Score,
                        item.Grade.Feedback,
                        item.Grade.Status,
                        item.Grade.SubmissionId,
                        UpdatedAt = DateTime.SpecifyKind(item.Grade.UpdatedAt, DateTimeKind.Utc)
                    }
            });

            return Ok(result);
        }

        [HttpGet("public-url")]
        public IActionResult PublicUrl([FromQuery] string key)
        {
            if (string.IsNullOrWhiteSpace(key))
                return BadRequest(new { message = "Thiếu key" });
            var url = _storage.GetTemporaryUrl(key);
            return Ok(new { url });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        {
            var uid = _currentUser.UserId;
            if (uid == Guid.Empty)
                return Unauthorized(new { message = "Vui lòng đăng nhập lại." });

            var submission = await _db.Submissions.FirstOrDefaultAsync(s => s.Id == id, ct);
            if (submission == null)
                return NotFound(new { message = "Không tìm thấy bài nộp." });

            if (submission.UserId != uid)
                return Forbid();

            var relatedGrades = await _db.Grades
                .Where(g => g.AssignmentId == submission.AssignmentId && g.UserId == uid)
                .ToListAsync(ct);
            if (relatedGrades.Count > 0)
                _db.Grades.RemoveRange(relatedGrades);

            await _storage.DeleteAsync(submission.FileKey, ct);

            _db.Submissions.Remove(submission);
            await _db.SaveChangesAsync(ct);

            return Ok(new { message = "Đã hủy bài nộp. Bạn có thể nộp lại mới." });
        }

    
        [HttpDelete("by-assignment/{assignmentId}")]
        public async Task<IActionResult> DeleteByAssignment(Guid assignmentId, CancellationToken ct)
        {
            var uid = _currentUser.UserId;
            if (uid == Guid.Empty)
                return Unauthorized(new { message = "Vui lòng đăng nhập lại." });

            var submissions = await _db.Submissions
                .Where(s => s.AssignmentId == assignmentId && s.UserId == uid)
                .ToListAsync(ct);

            if (submissions.Count == 0)
                return NotFound(new { message = "Không tìm thấy bài nộp của bạn cho bài tập này." });

            var relatedGrades = await _db.Grades
                .Where(g => g.AssignmentId == assignmentId && g.UserId == uid)
                .ToListAsync(ct);
            if (relatedGrades.Count > 0)
                _db.Grades.RemoveRange(relatedGrades);

            foreach (var s in submissions)
            {
                await _storage.DeleteAsync(s.FileKey, ct);
            }

            _db.Submissions.RemoveRange(submissions);
            await _db.SaveChangesAsync(ct);

            return Ok(new { message = "Đã hủy bài nộp. Bạn có thể nộp lại mới." });
        }
    }

}

