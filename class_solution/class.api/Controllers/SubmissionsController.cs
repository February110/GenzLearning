using class_api.Infrastructure.Data;
using class_api.Domain;
using class_api.Services;
using class_api.Utils;
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

        private static string? ValidateFile(IFormFile file, long? maxBytes, string[] allowedTokens)
        {
            if (file == null || file.Length == 0) return "File không hợp lệ.";
            if (maxBytes.HasValue && file.Length > maxBytes.Value)
            {
                return $"Dung lượng tối đa mỗi tệp là {FormatFileSize(maxBytes.Value)}.";
            }
            if (allowedTokens.Length > 0 && !FileTypeRules.IsFileAllowed(file, allowedTokens))
            {
                var allowedText = FileTypeRules.FormatAllowedTypes(allowedTokens);
                return $"Định dạng tệp không hợp lệ. Chỉ cho phép: {allowedText}.";
            }
            return null;
        }

        private static string FormatFileSize(long bytes)
        {
            const long mb = 1024L * 1024L;
            if (bytes <= 0) return "0 MB";
            if (bytes % mb == 0) return $"{bytes / mb} MB";
            var value = bytes / (double)mb;
            return $"{value:0.#} MB";
        }

        private static string ExtractFileName(string key)
        {
            var name = Path.GetFileName(key);
            if (string.IsNullOrWhiteSpace(name)) return "tep";
            if (name.Length > 16 && name[8] == '-' && name[15] == '-')
            {
                var ok = true;
                for (var i = 0; i < 8; i++)
                {
                    if (!char.IsDigit(name[i])) { ok = false; break; }
                }
                if (ok)
                {
                    for (var i = 9; i < 15; i++)
                    {
                        if (!char.IsDigit(name[i])) { ok = false; break; }
                    }
                }
                if (ok) return name.Substring(16);
            }
            return name;
        }

        private static bool IsGradedStatus(string? status)
        {
            if (string.IsNullOrWhiteSpace(status)) return false;
            return string.Equals(status, "graded", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(status, "returned", StringComparison.OrdinalIgnoreCase);
        }

        private async Task<(AssignmentGroup group, AssignmentGroupMember member, List<AssignmentGroupMember> members)?> LoadGroupForUser(Guid assignmentId, Guid userId, CancellationToken ct)
        {
            var member = await _db.AssignmentGroupMembers
                .Include(m => m.Group)
                .ThenInclude(g => g.Members)
                .FirstOrDefaultAsync(m => m.AssignmentId == assignmentId && m.UserId == userId, ct);
            if (member == null || member.Group == null) return null;
            var members = member.Group.Members.ToList();
            return (member.Group, member, members);
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

            var allowedTokens = FileTypeRules.ParseAllowedTypes(assignment.AllowedFileTypes);
            var validationError = ValidateFile(file, assignment.MaxFileSizeBytes, allowedTokens);
            if (validationError != null)
                return BadRequest(new { message = validationError });

            AssignmentGroup? group = null;
            List<Guid> groupMemberIds = new();
            if (assignment.GroupEnabled)
            {
                var groupInfo = await LoadGroupForUser(assignmentId, userId, ct);
                if (groupInfo == null)
                    return BadRequest(new { message = "Bạn chưa có nhóm cho bài tập này." });

                group = groupInfo.Value.group;
                var member = groupInfo.Value.member;
                var members = groupInfo.Value.members;
                var isLeader = string.Equals(member.Role, "Leader", StringComparison.OrdinalIgnoreCase);
                if (!isLeader)
                    return BadRequest(new { message = "Chỉ trưởng nhóm mới có thể nộp bài." });

                if (assignment.GroupMinMembers.HasValue && members.Count < assignment.GroupMinMembers.Value)
                {
                    return BadRequest(new { message = "Nhóm chưa đủ số lượng thành viên theo yêu cầu." });
                }

                groupMemberIds = members.Select(m => m.UserId).ToList();
                var gradedExists = await _db.Grades.AnyAsync(g =>
                    g.AssignmentId == assignmentId &&
                    groupMemberIds.Contains(g.UserId) &&
                    (g.Status != null && (g.Status.ToLower() == "graded" || g.Status.ToLower() == "returned")), ct);
                if (gradedExists)
                {
                    return BadRequest(new { message = "Bài đã được chấm nên không thể nộp lại." });
                }
            }
            else
            {
                var gradedExists = await _db.Grades.AnyAsync(g =>
                    g.AssignmentId == assignmentId &&
                    g.UserId == userId &&
                    (g.Status != null && (g.Status.ToLower() == "graded" || g.Status.ToLower() == "returned")), ct);
                if (gradedExists)
                {
                    return BadRequest(new { message = "Bài đã được chấm nên không thể nộp lại." });
                }
            }

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
            var groupPart = group != null ? $"group-{Slug(group.Name)}-{group.Id.ToString().Substring(0, 6)}" : studentPart;
            var prefix = $"submissions/{classPart}/{assignPart}/{groupPart}";

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
                GroupId = group?.Id,
                FileKey = key,
                FileSize = sizeBytes,
                ContentType = file.ContentType,
                SubmittedAt = DateTime.UtcNow
            };

            _db.Submissions.Add(submission);
            await _db.SaveChangesAsync(ct);

            await _activityStream.PublishAsync(new ActivityEvent("submission",
                user?.FullName ?? _currentUser.Email,
                group != null ? $"nộp nhóm \"{group.Name}\"" : $"nộp \"{assignment.Title}\"",
                assignment.Classroom?.Name,
                DateTime.UtcNow));

            var downloadUrl = _storage.GetTemporaryUrl(key);

            return Ok(new
            {
                message = "Nộp bài thành công!",
                fileKey = key,
                downloadUrl,
                fileSize = sizeBytes,
                submittedAt = submission.SubmittedAt,
                groupId = submission.GroupId
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

            var allowedTokens = FileTypeRules.ParseAllowedTypes(assignment.AllowedFileTypes);
            foreach (var f in files)
            {
                var validationError = ValidateFile(f, assignment.MaxFileSizeBytes, allowedTokens);
                if (validationError != null)
                    return BadRequest(new { message = $"{f.FileName}: {validationError}" });
            }

            AssignmentGroup? group = null;
            List<Guid> groupMemberIds = new();
            if (assignment.GroupEnabled)
            {
                var groupInfo = await LoadGroupForUser(assignmentId, userId, ct);
                if (groupInfo == null)
                    return BadRequest(new { message = "Bạn chưa có nhóm cho bài tập này." });

                group = groupInfo.Value.group;
                var member = groupInfo.Value.member;
                var members = groupInfo.Value.members;
                var isLeader = string.Equals(member.Role, "Leader", StringComparison.OrdinalIgnoreCase);
                if (!isLeader)
                    return BadRequest(new { message = "Chỉ trưởng nhóm mới có thể nộp bài." });

                if (assignment.GroupMinMembers.HasValue && members.Count < assignment.GroupMinMembers.Value)
                {
                    return BadRequest(new { message = "Nhóm chưa đủ số lượng thành viên theo yêu cầu." });
                }

                groupMemberIds = members.Select(m => m.UserId).ToList();
                var gradedExists = await _db.Grades.AnyAsync(g =>
                    g.AssignmentId == assignmentId &&
                    groupMemberIds.Contains(g.UserId) &&
                    (g.Status != null && (g.Status.ToLower() == "graded" || g.Status.ToLower() == "returned")), ct);
                if (gradedExists)
                {
                    return BadRequest(new { message = "Bài đã được chấm nên không thể nộp lại." });
                }
            }
            else
            {
                var gradedExists = await _db.Grades.AnyAsync(g =>
                    g.AssignmentId == assignmentId &&
                    g.UserId == userId &&
                    (g.Status != null && (g.Status.ToLower() == "graded" || g.Status.ToLower() == "returned")), ct);
                if (gradedExists)
                {
                    return BadRequest(new { message = "Bài đã được chấm nên không thể nộp lại." });
                }
            }

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
            var groupPart2 = group != null ? $"group-{Slug2(group.Name)}-{group.Id.ToString().Substring(0, 6)}" : studentPart2;
            var prefix2 = $"submissions/{classPart2}/{assignPart2}/{groupPart2}";

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
                    GroupId = group?.Id,
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
                group != null ? $"nộp nhóm \"{group.Name}\"" : $"nộp \"{assignment!.Title}\"",
                assignment.Classroom?.Name ?? assignment.ClassroomId.ToString(),
                DateTime.UtcNow));
            return Ok(new { message = "Đã nộp nhiều tệp.", items = results });
        }

        [HttpGet("by-assignment/{assignmentId}")]
        public async Task<IActionResult> GetByAssignment(Guid assignmentId, CancellationToken ct)
        {
            var rows = await _db.Submissions
                .Include(s => s.User)
                .Include(s => s.Group)
                .Where(s => s.AssignmentId == assignmentId)
                .OrderByDescending(s => s.SubmittedAt)
                .Select(s => new
                {
                    s.Id,
                    s.UserId,
                    StudentName = s.User.FullName,
                    Email = s.User.Email,
                    s.GroupId,
                    GroupName = s.Group != null ? s.Group.Name : null,
                    s.FileKey,
                    s.ContentType,
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
                            g.UpdatedAt,
                            g.ReturnedFileKey,
                            g.ReturnedFileName,
                            g.ReturnedFileSize,
                            g.ReturnedAt
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
                item.GroupId,
                item.GroupName,
                item.FileSize,
                item.SubmittedAt,
                fileKey = item.FileKey,
                contentType = item.ContentType,
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
                        UpdatedAt = DateTime.SpecifyKind(item.Grade.UpdatedAt, DateTimeKind.Utc),
                        item.Grade.ReturnedFileKey,
                        item.Grade.ReturnedFileName,
                        item.Grade.ReturnedFileSize,
                        ReturnedAt = item.Grade.ReturnedAt.HasValue
                            ? DateTime.SpecifyKind(item.Grade.ReturnedAt.Value, DateTimeKind.Utc)
                            : (DateTime?)null
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

        [HttpGet("download-file")]
        public async Task<IActionResult> DownloadFile([FromQuery] string? key, [FromQuery] Guid? id, CancellationToken ct)
        {
            string? fileKey = key;
            string? contentType = null;
            if (id.HasValue)
            {
                var submission = await _db.Submissions.FindAsync(new object?[] { id.Value }, ct);
                if (submission == null)
                    return NotFound(new { message = "Không tìm thấy bài nộp." });
                fileKey = submission.FileKey;
                contentType = submission.ContentType;
            }
            if (string.IsNullOrWhiteSpace(fileKey))
                return BadRequest(new { message = "Thiếu key tệp." });

            var (stream, storageContentType, sizeBytes) = await _storage.OpenReadAsync(fileKey, ct);
            if (stream == Stream.Null || sizeBytes <= 0)
                return NotFound(new { message = "Không tìm thấy tệp." });

            var fileName = ExtractFileName(fileKey);
            var finalType = storageContentType ?? contentType ?? "application/octet-stream";
            return File(stream, finalType, fileName, enableRangeProcessing: true);
        }

        [HttpGet("my")]
        public async Task<IActionResult> MySubmissions(CancellationToken ct)
        {
            var uid = _currentUser.UserId;
            if (uid == Guid.Empty)
                return Unauthorized(new { message = "Vui lòng đăng nhập lại." });

            var groupIds = await _db.AssignmentGroupMembers
                .Where(m => m.UserId == uid)
                .Select(m => m.GroupId)
                .ToListAsync(ct);

            var rows = await _db.Submissions
                .Include(s => s.Group)
                .Include(s => s.User)
                .Where(s => s.UserId == uid || (s.GroupId.HasValue && groupIds.Contains(s.GroupId.Value)))
                .OrderByDescending(s => s.SubmittedAt)
                .Select(s => new
                {
                    s.Id,
                    s.AssignmentId,
                    s.FileKey,
                    s.FileSize,
                    s.SubmittedAt,
                    s.GroupId,
                    GroupName = s.Group != null ? s.Group.Name : null,
                    SubmittedById = s.UserId,
                    SubmittedByName = s.User.FullName,
                    Grade = _db.Grades
                        .Where(g => g.AssignmentId == s.AssignmentId && g.UserId == uid)
                        .Select(g => new
                        {
                            g.Id,
                            g.Score,
                            g.Feedback,
                            g.Status,
                            g.SubmissionId,
                            g.UpdatedAt,
                            g.ReturnedFileKey,
                            g.ReturnedFileName,
                            g.ReturnedFileSize,
                            g.ReturnedAt
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
                item.GroupId,
                item.GroupName,
                item.SubmittedById,
                item.SubmittedByName,
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
                        UpdatedAt = DateTime.SpecifyKind(item.Grade.UpdatedAt, DateTimeKind.Utc),
                        item.Grade.ReturnedFileKey,
                        item.Grade.ReturnedFileName,
                        item.Grade.ReturnedFileSize,
                        ReturnedAt = item.Grade.ReturnedAt.HasValue
                            ? DateTime.SpecifyKind(item.Grade.ReturnedAt.Value, DateTimeKind.Utc)
                            : (DateTime?)null
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

            var submission = await _db.Submissions
                .Include(s => s.Assignment)
                .FirstOrDefaultAsync(s => s.Id == id, ct);
            if (submission == null)
                return NotFound(new { message = "Không tìm thấy bài nộp." });

            if (submission.GroupId.HasValue)
            {
                var member = await _db.AssignmentGroupMembers
                    .FirstOrDefaultAsync(m => m.AssignmentId == submission.AssignmentId && m.UserId == uid, ct);
                if (member == null || member.GroupId != submission.GroupId)
                    return Forbid();
                var isLeader = string.Equals(member.Role, "Leader", StringComparison.OrdinalIgnoreCase);
                if (!isLeader)
                    return Forbid();
            }
            else
            {
                if (submission.UserId != uid)
                    return Forbid();
            }

            if (submission.GroupId.HasValue)
            {
                var groupMemberIds = await _db.AssignmentGroupMembers
                    .Where(m => m.GroupId == submission.GroupId.Value)
                    .Select(m => m.UserId)
                    .ToListAsync(ct);
                var graded = await _db.Grades.AsNoTracking()
                    .AnyAsync(g => g.AssignmentId == submission.AssignmentId && groupMemberIds.Contains(g.UserId) && IsGradedStatus(g.Status), ct);
                if (graded)
                    return BadRequest(new { message = "Bài đã được chấm nên không thể hủy." });
            }
            else
            {
                var grade = await _db.Grades.AsNoTracking()
                    .FirstOrDefaultAsync(g => g.AssignmentId == submission.AssignmentId && g.UserId == uid, ct);
                if (grade != null && IsGradedStatus(grade.Status))
                {
                    return BadRequest(new { message = "Bài đã được chấm nên không thể hủy." });
                }
            }

            var dueAt = submission.Assignment?.DueAt;
            if (dueAt.HasValue && dueAt.Value <= DateTime.UtcNow)
            {
                return BadRequest(new { message = "Đã quá hạn nộp bài nên không thể hủy." });
            }

            var relatedGrades = await _db.Grades
                .Where(g => g.AssignmentId == submission.AssignmentId && (submission.GroupId.HasValue ? _db.AssignmentGroupMembers.Any(m => m.GroupId == submission.GroupId && m.UserId == g.UserId) : g.UserId == uid))
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

            var assignment = await _db.Assignments.AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
            if (assignment == null)
                return NotFound(new { message = "Không tìm thấy bài tập." });

            AssignmentGroupMember? member = null;
            Guid? groupId = null;
            if (assignment.GroupEnabled)
            {
                member = await _db.AssignmentGroupMembers
                    .FirstOrDefaultAsync(m => m.AssignmentId == assignmentId && m.UserId == uid, ct);
                if (member == null)
                    return BadRequest(new { message = "Bạn chưa có nhóm cho bài tập này." });
                var isLeader = string.Equals(member.Role, "Leader", StringComparison.OrdinalIgnoreCase);
                if (!isLeader)
                    return Forbid();
                groupId = member.GroupId;
            }

            var submissions = await _db.Submissions
                .Where(s => s.AssignmentId == assignmentId && (groupId.HasValue ? s.GroupId == groupId : s.UserId == uid))
                .ToListAsync(ct);

            if (submissions.Count == 0)
                return NotFound(new { message = "Không tìm thấy bài nộp của bạn cho bài tập này." });

            if (groupId.HasValue)
            {
                var groupMemberIds = await _db.AssignmentGroupMembers
                    .Where(m => m.GroupId == groupId.Value)
                    .Select(m => m.UserId)
                    .ToListAsync(ct);
                var graded = await _db.Grades.AsNoTracking()
                    .AnyAsync(g => g.AssignmentId == assignmentId && groupMemberIds.Contains(g.UserId) && IsGradedStatus(g.Status), ct);
                if (graded)
                    return BadRequest(new { message = "Bài đã được chấm nên không thể hủy." });
            }
            else
            {
                var grade = await _db.Grades.AsNoTracking()
                    .FirstOrDefaultAsync(g => g.AssignmentId == assignmentId && g.UserId == uid, ct);
                if (grade != null && IsGradedStatus(grade.Status))
                {
                    return BadRequest(new { message = "Bài đã được chấm nên không thể hủy." });
                }
            }

            if (assignment?.DueAt.HasValue == true && assignment.DueAt.Value <= DateTime.UtcNow)
            {
                return BadRequest(new { message = "Đã quá hạn nộp bài nên không thể hủy." });
            }

            var relatedGrades = await _db.Grades
                .Where(g => g.AssignmentId == assignmentId && (groupId.HasValue ? _db.AssignmentGroupMembers.Any(m => m.GroupId == groupId && m.UserId == g.UserId) : g.UserId == uid))
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

