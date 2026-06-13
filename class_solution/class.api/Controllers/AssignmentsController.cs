using class_api.Infrastructure.Data;
using class_api.Domain;
using class_api.Application.Dtos;
using class_api.Services;
using class_api.Utils;
using Microsoft.AspNetCore.SignalR;
using class_api.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace class_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AssignmentsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUser _me;
        private readonly IStorage _storage;
        private readonly IHubContext<ClassroomHub> _hub;
        private readonly IActivityStream _activityStream;
        private readonly INotificationDispatcher _dispatcher;
        private readonly INotificationService _notifications;

        public AssignmentsController(ApplicationDbContext db, ICurrentUser me, IStorage storage, IHubContext<ClassroomHub> hub, IActivityStream activityStream, INotificationDispatcher dispatcher, INotificationService notifications)
        {
            _db = db; _me = me; _storage = storage; _hub = hub; _activityStream = activityStream; _dispatcher = dispatcher; _notifications = notifications;
        }

        private static string Slugify(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return "untitled";
            var cleaned = new string(input.Trim().Select(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_' ? ch : '-').ToArray());
            while (cleaned.Contains("--")) cleaned = cleaned.Replace("--", "-");
            return cleaned.Trim('-').ToLowerInvariant();
        }

        private static string BuildAssignmentTimestampPrefix(Assignment assignment, Classroom classroom)
        {
            var classSlug = Slugify(classroom.Name);
            var classShort = classroom.Id.ToString();
            if (classShort.Length > 8) classShort = classShort[..8];
            var assignShort = assignment.Id.ToString();
            if (assignShort.Length > 8) assignShort = assignShort[..8];
            var created = DateTime.SpecifyKind(assignment.CreatedAt, DateTimeKind.Utc);
            var titleSlug = Slugify(assignment.Title);
            return $"materials/{classSlug}-{classShort}/{created:yyyyMMdd-HHmmss}-{assignShort}-{titleSlug}";
        }

        private static string BuildAssignmentPrefix(Assignment assignment, Classroom classroom, int maxChars = 8)
        {
            var classSlug = Slugify(classroom.Name);
            var classShort = classroom.Id.ToString();
            if (classShort.Length > maxChars) classShort = classShort[..maxChars];
            var titleSlug = Slugify(assignment.Title);
            return $"materials/{classSlug}-{classShort}/{titleSlug}-{assignment.Id}";
        }

        private static string BuildAssignmentPrefix6(Assignment assignment, Classroom classroom)
            => BuildAssignmentPrefix(assignment, classroom, 6);

        private static string? ExtractPrefixFromFileKey(string? key)
        {
            if (string.IsNullOrWhiteSpace(key)) return null;
            var normalized = key.Replace('\\', '/');
            var idx = normalized.LastIndexOf('/');
            if (idx <= 0) return null;
            return normalized[..idx];
        }

        private static string ResolveAssignmentUploadPrefix(Assignment assignment, Classroom classroom)
        {
            var existing = ExtractPrefixFromFileKey(assignment.FileKey);
            if (!string.IsNullOrWhiteSpace(existing)) return existing!;
            return BuildAssignmentTimestampPrefix(assignment, classroom);
        }

        private static long? ToBytes(int? mb)
        {
            if (!mb.HasValue || mb.Value <= 0) return null;
            return mb.Value * 1024L * 1024L;
        }

        private static DateTime? NormalizeUtc(DateTime? value)
        {
            if (!value.HasValue) return null;
            return value.Value.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc)
                : value.Value.ToUniversalTime();
        }

        private static (int? min, int? max) NormalizeGroupSize(bool enabled, int? min, int? max)
        {
            if (!enabled) return (null, null);
            var minVal = min.HasValue && min.Value > 0 ? min.Value : 1;
            int? maxVal = max.HasValue && max.Value > 0 ? max.Value : null;
            if (maxVal.HasValue && maxVal.Value < minVal) maxVal = minVal;
            return (minVal, maxVal);
        }

        private static string? NormalizeGroupMode(bool enabled, string? mode)
        {
            if (!enabled) return null;
            if (string.Equals(mode, "random", StringComparison.OrdinalIgnoreCase)) return "random";
            return "student";
        }

        private static string NormalizeClassGroupMode(string? mode)
        {
            return string.Equals(mode, "random", StringComparison.OrdinalIgnoreCase) ? "random" : "student";
        }

        public record RepostAssignmentDto(
            Guid[] ClassroomIds,
            string? Title = null,
            string? Instructions = null,
            DateTime? DueAt = null,
            int? MaxPoints = null,
            string? AllowedFileTypes = null,
            int? MaxFileSizeMb = null,
            bool? GroupEnabled = null,
            int? GroupMinMembers = null,
            int? GroupMaxMembers = null,
            bool? CopyAttachments = null
        );

        [HttpPost]
        [Consumes("application/json")]
        public async Task<IActionResult> Create(CreateAssignmentDto dto)
        {
            var member = await _db.Enrollments
                .Include(e => e.User)
                .Include(e => e.Classroom)
                .FirstOrDefaultAsync(e => e.ClassroomId == dto.ClassroomId && e.UserId == _me.UserId);

            if (member == null || member.Role != "Teacher") return Forbid();

            var allowedTypes = FileTypeRules.NormalizeAllowedTypes(dto.AllowedFileTypes);
            var maxSizeBytes = ToBytes(dto.MaxFileSizeMb);
            var (minMembers, maxMembers) = NormalizeGroupSize(dto.GroupEnabled, dto.GroupMinMembers, dto.GroupMaxMembers);
            var groupMode = dto.GroupEnabled ? NormalizeClassGroupMode(member.Classroom?.ClassGroupMode) : null;

            var a = new Assignment
            {
                ClassroomId = dto.ClassroomId,
                Title = dto.Title.Trim(),
                Instructions = dto.Instructions,
                DueAt = dto.DueAt.HasValue ? DateTime.SpecifyKind(dto.DueAt.Value, DateTimeKind.Utc) : null,
                MaxPoints = dto.MaxPoints,
                AllowedFileTypes = allowedTypes,
                MaxFileSizeBytes = maxSizeBytes,
                GroupEnabled = dto.GroupEnabled,
                GroupMinMembers = minMembers,
                GroupMaxMembers = maxMembers,
                GroupMode = groupMode,
                AssignmentType = "standard",
                Status = "published",
                PublishedAt = DateTime.UtcNow,
                CreatedBy = _me.UserId
            };
            _db.Assignments.Add(a);
            await _db.SaveChangesAsync();
            if (a.GroupEnabled)
            {
                await CreateGroupsFromClassroom(a.Id, a.ClassroomId);
            }

            await _hub.Clients.Group(a.ClassroomId.ToString()).SendAsync("AssignmentCreated", new
            {
                a.Id,
                a.ClassroomId,
                a.Title,
                DueAt = a.DueAt.HasValue ? DateTime.SpecifyKind(a.DueAt.Value, DateTimeKind.Utc) : (DateTime?)null,
                a.MaxPoints,
                a.AllowedFileTypes,
                a.MaxFileSizeBytes,
                a.GroupEnabled,
                a.GroupMinMembers,
                a.GroupMaxMembers,
                a.GroupMode,
                CreatedAt = DateTime.SpecifyKind(a.CreatedAt, DateTimeKind.Utc)
            });

            await _activityStream.PublishAsync(new ActivityEvent("assignment",
                member.User?.FullName ?? "Giáo viên",
                $"tạo bài tập \"{a.Title}\"",
                member.Classroom?.Name ?? string.Empty,
                DateTime.UtcNow));

            var studentRecipients = await GetStudentIds(dto.ClassroomId);
            if (studentRecipients.Any())
            {
                try
                {
                    await _dispatcher.DispatchAsync(studentRecipients, "Bài tập mới", $"\"{a.Title}\" vừa được đăng.", "assignment", dto.ClassroomId, a.Id);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"⚠️ Dispatch assignment notification failed: {ex.Message}");
                    await _notifications.NotifyUsersAsync(studentRecipients, "Bài tập mới", $"\"{a.Title}\" vừa được đăng.", "assignment", dto.ClassroomId, a.Id, null);
                }
            }

            return CreatedAtAction(nameof(GetById), new { id = a.Id }, new { a.Id, a.Title, a.DueAt, a.MaxPoints, a.AllowedFileTypes, a.MaxFileSizeBytes, a.GroupEnabled, a.GroupMinMembers, a.GroupMaxMembers, a.GroupMode });
        }

        [HttpPost("with-materials")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> CreateWithMaterials(
            [FromForm] Guid ClassroomId,
            [FromForm] string Title,
            [FromForm] string? Instructions,
            [FromForm] string? DueAt, 
            [FromForm] int MaxPoints = 100,
            [FromForm] string? AllowedFileTypes = null,
            [FromForm] int? MaxFileSizeMb = null,
            [FromForm] bool GroupEnabled = false,
            [FromForm] int? GroupMinMembers = null,
            [FromForm] int? GroupMaxMembers = null,
            [FromForm] string? GroupMode = null,
            [FromForm] IFormFileCollection? Files = null,
            [FromForm] string? Links = null,
            CancellationToken ct = default)
        {
            var member = await _db.Enrollments
                .Include(e => e.User)
                .Include(e => e.Classroom)
                .FirstOrDefaultAsync(e => e.ClassroomId == ClassroomId && e.UserId == _me.UserId, ct);
            if (member == null || member.Role != "Teacher") return Forbid();

            DateTime? dueAt = null;
            if (!string.IsNullOrWhiteSpace(DueAt))
            {
                if (DateTime.TryParse(DueAt, null, System.Globalization.DateTimeStyles.RoundtripKind, out var dt))
                    dueAt = dt.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(dt, DateTimeKind.Utc) : dt.ToUniversalTime();
            }

            var allowedTypes = FileTypeRules.NormalizeAllowedTypes(AllowedFileTypes);
            var maxSizeBytes = ToBytes(MaxFileSizeMb);
            var (minMembers2, maxMembers2) = NormalizeGroupSize(GroupEnabled, GroupMinMembers, GroupMaxMembers);
            var groupMode2 = GroupEnabled ? NormalizeClassGroupMode(member.Classroom?.ClassGroupMode) : null;

            var a = new Assignment
            {
                ClassroomId = ClassroomId,
                Title = Title.Trim(),
                Instructions = Instructions,
                DueAt = dueAt,
                MaxPoints = MaxPoints,
                AllowedFileTypes = allowedTypes,
                MaxFileSizeBytes = maxSizeBytes,
                GroupEnabled = GroupEnabled,
                GroupMinMembers = minMembers2,
                GroupMaxMembers = maxMembers2,
                GroupMode = groupMode2,
                AssignmentType = "standard",
                Status = "published",
                PublishedAt = DateTime.UtcNow,
                CreatedBy = _me.UserId
            };
            _db.Assignments.Add(a);
            await _db.SaveChangesAsync(ct);
            if (a.GroupEnabled)
            {
                await CreateGroupsFromClassroom(a.Id, a.ClassroomId, ct);
            }

            var cls = member.Classroom ?? await _db.Classrooms.FirstOrDefaultAsync(c => c.Id == ClassroomId, ct);
            var prefix = BuildAssignmentTimestampPrefix(a, cls ?? new Classroom { Id = ClassroomId, Name = "untitled" });
            var items = new List<object>();
            string? firstKey = null;
            string? firstContentType = null;
            if (Files != null)
            {
                foreach (var f in Files)
                {
                    if (f == null || f.Length == 0) continue;
                    await using var s = f.OpenReadStream();
                    var (key, size) = await _storage.UploadAsync(s, f.ContentType ?? "application/octet-stream", prefix, f.FileName, ct);
                    items.Add(new { key, size, name = f.FileName, url = _storage.GetTemporaryUrl(key) });
                    firstKey ??= key;
                    firstContentType ??= f.ContentType;
                }
            }
            if (!string.IsNullOrWhiteSpace(Links))
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<List<string>>(Links!) ?? new List<string>();
                    var json = JsonSerializer.Serialize(parsed);
                    await _storage.UploadTextAsync($"{prefix}/links.json", json, "application/json", ct);
                    items.AddRange(parsed.Select(u => new { key = (string?)null, size = 0L, url = u, name = u }));
                }
                catch { }
            }

            if (firstKey != null)
            {
                a.FileKey = firstKey;
                a.ContentType = firstContentType;
                await _db.SaveChangesAsync(ct);
            }

            await _hub.Clients.Group(a.ClassroomId.ToString()).SendAsync("AssignmentCreated", new
            {
                id = a.Id,
                classroomId = a.ClassroomId,
                title = a.Title,
                fileKey = a.FileKey,
                contentType = a.ContentType,
                dueAt = a.DueAt,
                maxPoints = a.MaxPoints,
                allowedFileTypes = a.AllowedFileTypes,
                maxFileSizeBytes = a.MaxFileSizeBytes,
                groupEnabled = a.GroupEnabled,
                groupMinMembers = a.GroupMinMembers,
                groupMaxMembers = a.GroupMaxMembers,
                groupMode = a.GroupMode,
                createdAt = DateTime.SpecifyKind(a.CreatedAt, DateTimeKind.Utc),
                materials = items
            });

            await _activityStream.PublishAsync(new ActivityEvent("assignment",
                member.User?.FullName ?? "Giáo viên",
                $"tạo bài tập \"{a.Title}\"",
                member.Classroom?.Name ?? string.Empty,
                DateTime.UtcNow));

            var studentIds = await GetStudentIds(ClassroomId);
            if (studentIds.Any())
            {
                try
                {
                    await _dispatcher.DispatchAsync(studentIds, "Bài tập mới", $"\"{a.Title}\" vừa được đăng.", "assignment", ClassroomId, a.Id);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"⚠️ Dispatch assignment notification failed: {ex.Message}");
                    await _notifications.NotifyUsersAsync(studentIds, "Bài tập mới", $"\"{a.Title}\" vừa được đăng.", "assignment", ClassroomId, a.Id, null, ct);
                }
            }

            return CreatedAtAction(nameof(GetById), new { id = a.Id }, new { a.Id, a.Title, a.DueAt, a.MaxPoints, a.AllowedFileTypes, a.MaxFileSizeBytes, a.GroupEnabled, a.GroupMinMembers, a.GroupMaxMembers, a.GroupMode });
        }

        [HttpPost("save-ai-quiz")]
        [Consumes("application/json")]
        public async Task<IActionResult> SaveAiQuiz([FromBody] SaveAiQuizRequest request, CancellationToken ct)
        {
            var classroomId = request.ClassroomId ?? request.ClassId ?? Guid.Empty;
            if (classroomId == Guid.Empty)
                return BadRequest(new { message = "Thiếu lớp học được giao." });

            var member = await _db.Enrollments
                .Include(e => e.User)
                .Include(e => e.Classroom)
                .FirstOrDefaultAsync(e => e.ClassroomId == classroomId && e.UserId == _me.UserId, ct);

            if (member == null || member.Role != "Teacher") return Forbid();

            var quizData = request.QuizData ?? new QuizDataDto();
            if (!string.IsNullOrWhiteSpace(request.Title))
                quizData.Title = request.Title.Trim();
            QuizService.NormalizeQuiz(quizData);

            var validationErrors = QuizService.ValidateQuiz(quizData, quizData.QuestionCount > 0 ? quizData.QuestionCount : null, 4);
            if (validationErrors.Count > 0)
                return BadRequest(new { message = "Dữ liệu bài trắc nghiệm không hợp lệ", errors = validationErrors });

            var assignmentId = Guid.NewGuid();
            quizData.AssignmentId = assignmentId;
            var blobName = $"assignments/{assignmentId}/quiz.json";
            var now = DateTime.UtcNow;
            var status = request.Publish ? "published" : "draft";

            var assignment = new Assignment
            {
                Id = assignmentId,
                ClassroomId = classroomId,
                Title = quizData.Title,
                Instructions = $"Bài trắc nghiệm: {quizData.Topic}",
                DueAt = request.DueAt.HasValue
                    ? DateTime.SpecifyKind(request.DueAt.Value, DateTimeKind.Utc)
                    : null,
                MaxPoints = request.MaxPoints.GetValueOrDefault(10) <= 0 ? 10 : request.MaxPoints.GetValueOrDefault(10),
                AssignmentType = "ai_quiz",
                Status = status,
                QuizBlobKey = blobName,
                QuizTopic = quizData.Topic,
                QuizDifficulty = quizData.Difficulty,
                QuizQuestionCount = quizData.Questions.Count,
                QuizTimeLimitMinutes = request.TimeLimitMinutes.HasValue && request.TimeLimitMinutes.Value > 0
                    ? request.TimeLimitMinutes.Value
                    : null,
                PublishedAt = request.Publish ? now : null,
                CreatedAt = now,
                UpdatedAt = now,
                CreatedBy = _me.UserId
            };

            await _storage.UploadTextAsync(blobName, QuizService.ToJson(quizData), "application/json", ct);
            _db.Assignments.Add(assignment);
            await _db.SaveChangesAsync(ct);

            if (request.Publish)
                await NotifyAssignmentPublished(assignment, member, ct);

            return Ok(new
            {
                message = "Lưu bài tập thành công",
                data = new
                {
                    assignmentId = assignment.Id,
                    assignment.Title,
                    assignment.Status,
                    blobName = assignment.QuizBlobKey
                }
            });
        }

        [HttpPost("{id:guid}/publish")]
        public async Task<IActionResult> Publish(Guid id, CancellationToken ct)
        {
            var assignment = await _db.Assignments
                .Include(a => a.Classroom)
                .FirstOrDefaultAsync(a => a.Id == id, ct);
            if (assignment == null) return NotFound(new { message = "Không tìm thấy bài tập." });

            var member = await _db.Enrollments
                .Include(e => e.User)
                .Include(e => e.Classroom)
                .FirstOrDefaultAsync(e => e.ClassroomId == assignment.ClassroomId && e.UserId == _me.UserId, ct);
            if (member == null || member.Role != "Teacher") return Forbid();

            if (string.Equals(assignment.Status, "published", StringComparison.OrdinalIgnoreCase))
                return Ok(new { message = "Bài tập đã được giao.", data = new { assignment.Id, assignment.Status } });

            assignment.Status = "published";
            assignment.PublishedAt = DateTime.UtcNow;
            assignment.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            await NotifyAssignmentPublished(assignment, member, ct);

            return Ok(new { message = "Đã giao bài tập.", data = new { assignment.Id, assignment.Status } });
        }

        [HttpPost("{id:guid}/repost")]
        public async Task<IActionResult> Repost(Guid id, RepostAssignmentDto dto, CancellationToken ct)
        {
            if (dto.ClassroomIds == null || dto.ClassroomIds.Length == 0)
                return BadRequest(new { message = "Chọn lớp để đăng lại." });

            var source = await _db.Assignments
                .Include(a => a.Classroom)
                .FirstOrDefaultAsync(a => a.Id == id, ct);
            if (source == null) return NotFound(new { message = "Không tìm thấy bài tập." });

            var sourceMember = await _db.Enrollments
                .Include(e => e.User)
                .Include(e => e.Classroom)
                .FirstOrDefaultAsync(e => e.ClassroomId == source.ClassroomId && e.UserId == _me.UserId, ct);
            if (sourceMember == null || !string.Equals(sourceMember.Role, "Teacher", StringComparison.OrdinalIgnoreCase))
                return Forbid();

            var targetClassroomIds = dto.ClassroomIds
                .Where(x => x != source.ClassroomId)
                .Distinct()
                .ToList();
            if (targetClassroomIds.Count == 0)
                return BadRequest(new { message = "Không có lớp hợp lệ để đăng lại." });

            var teacherTargets = await _db.Enrollments
                .Include(e => e.Classroom)
                .Where(e => targetClassroomIds.Contains(e.ClassroomId) && e.UserId == _me.UserId && e.Role == "Teacher")
                .Select(e => new { e.ClassroomId, Classroom = e.Classroom!, e.User })
                .ToListAsync(ct);

            if (teacherTargets.Count == 0) return Forbid();

            var allowedIds = teacherTargets.Select(x => x.ClassroomId).ToHashSet();
            var skipped = new List<object>();
            foreach (var cid in dto.ClassroomIds.Distinct())
            {
                if (cid == source.ClassroomId)
                    skipped.Add(new { classroomId = cid, reason = "same-class" });
                else if (!allowedIds.Contains(cid))
                    skipped.Add(new { classroomId = cid, reason = "not-teacher" });
            }

            var sourceClassroom = source.Classroom ?? await _db.Classrooms.FirstOrDefaultAsync(c => c.Id == source.ClassroomId, ct);
            var (sourceFiles, sourceLinks) = await ListAssignmentMaterialSources(source, sourceClassroom ?? new Classroom { Id = source.ClassroomId, Name = "untitled" }, ct);

            if (dto.CopyAttachments == false && (sourceFiles.Count > 0 || sourceLinks.Count > 0))
                return BadRequest(new { message = "Đăng lại bài tập hiện chỉ hỗ trợ sao chép tệp đính kèm." });

            var created = new List<object>();
            var creatorName = sourceMember.User?.FullName ?? "Giáo viên";
            var title = string.IsNullOrWhiteSpace(dto.Title) ? source.Title : dto.Title.Trim();
            var instructions = dto.Instructions is null ? source.Instructions : dto.Instructions;
            var dueAt = NormalizeUtc(dto.DueAt);
            var maxPoints = dto.MaxPoints.HasValue && dto.MaxPoints.Value > 0 ? dto.MaxPoints.Value : source.MaxPoints;
            var allowedFileTypes = dto.AllowedFileTypes is null
                ? source.AllowedFileTypes
                : FileTypeRules.NormalizeAllowedTypes(dto.AllowedFileTypes);
            var maxFileSizeBytes = dto.MaxFileSizeMb.HasValue ? ToBytes(dto.MaxFileSizeMb) : source.MaxFileSizeBytes;
            var groupEnabled = dto.GroupEnabled ?? source.GroupEnabled;
            var requestedMinMembers = dto.GroupMinMembers ?? source.GroupMinMembers;
            var requestedMaxMembers = dto.GroupMaxMembers ?? source.GroupMaxMembers;

            foreach (var target in teacherTargets)
            {
                var targetClassroom = target.Classroom ?? new Classroom { Id = target.ClassroomId, Name = "untitled" };
                var (minMembers, maxMembers) = NormalizeGroupSize(groupEnabled, requestedMinMembers, requestedMaxMembers);
                var groupMode = groupEnabled ? NormalizeClassGroupMode(targetClassroom.ClassGroupMode) : null;
                var now = DateTime.UtcNow;
                var newAssignment = new Assignment
                {
                    ClassroomId = target.ClassroomId,
                    Title = title,
                    Instructions = instructions,
                    DueAt = dueAt,
                    MaxPoints = maxPoints,
                    AllowedFileTypes = allowedFileTypes,
                    MaxFileSizeBytes = maxFileSizeBytes,
                    GroupEnabled = groupEnabled,
                    GroupMinMembers = minMembers,
                    GroupMaxMembers = maxMembers,
                    GroupMode = groupMode,
                    AssignmentType = source.AssignmentType,
                    Status = "published",
                    PublishedAt = now,
                    CreatedBy = _me.UserId
                };

                if (string.Equals(source.AssignmentType, "ai_quiz", StringComparison.OrdinalIgnoreCase) &&
                    !string.IsNullOrWhiteSpace(source.QuizBlobKey))
                {
                    var quizJson = await _storage.ReadTextAsync(source.QuizBlobKey, ct);
                    if (string.IsNullOrWhiteSpace(quizJson))
                        return BadRequest(new { message = "Không tìm thấy dữ liệu trắc nghiệm của bài tập gốc." });

                    var quiz = JsonSerializer.Deserialize<QuizDataDto>(
                        quizJson,
                        new JsonSerializerOptions(JsonSerializerDefaults.Web)
                        {
                            PropertyNameCaseInsensitive = true
                        }) ?? new QuizDataDto();

                    QuizService.NormalizeQuiz(quiz);
                    quiz.AssignmentId = newAssignment.Id;
                    quiz.Title = newAssignment.Title;

                    var blobName = $"assignments/{newAssignment.Id}/quiz.json";
                    await _storage.UploadTextAsync(blobName, QuizService.ToJson(quiz), "application/json", ct);
                    newAssignment.QuizBlobKey = blobName;
                    newAssignment.QuizTopic = quiz.Topic;
                    newAssignment.QuizDifficulty = quiz.Difficulty;
                    newAssignment.QuizQuestionCount = quiz.Questions.Count;
                    newAssignment.QuizTimeLimitMinutes = source.QuizTimeLimitMinutes;
                }
                else
                {
                    newAssignment.AssignmentType = "standard";
                }

                _db.Assignments.Add(newAssignment);
                await _db.SaveChangesAsync(ct);

                if (newAssignment.GroupEnabled)
                {
                    await CreateGroupsFromClassroom(newAssignment.Id, newAssignment.ClassroomId, ct);
                }

                var prefix = BuildAssignmentTimestampPrefix(newAssignment, targetClassroom);
                var items = new List<object>();
                string? firstKey = null;

                foreach (var f in sourceFiles)
                {
                    var (key, size) = await _storage.CopyAsync(f.key, prefix, f.name, ct);
                    if (string.IsNullOrWhiteSpace(key) || size <= 0) continue;
                    items.Add(new { key, size, name = f.name, url = _storage.GetTemporaryUrl(key) });
                    firstKey ??= key;
                }

                if (sourceLinks.Count > 0)
                {
                    var json = JsonSerializer.Serialize(sourceLinks);
                    await _storage.UploadTextAsync($"{prefix}/links.json", json, "application/json", ct);
                    items.AddRange(sourceLinks.Select((u, idx) => new { key = $"link-{idx}", size = 0L, url = u ?? string.Empty, name = u ?? string.Empty }));
                }

                if (firstKey != null)
                {
                    newAssignment.FileKey = firstKey;
                    newAssignment.ContentType = source.ContentType;
                    await _db.SaveChangesAsync(ct);
                }

                var payload = BuildAssignmentPayload(newAssignment, items);
                await _hub.Clients.Group(newAssignment.ClassroomId.ToString()).SendAsync("AssignmentCreated", payload, ct);

                await _activityStream.PublishAsync(new ActivityEvent("assignment",
                    creatorName,
                    $"tạo bài tập \"{newAssignment.Title}\"",
                    targetClassroom.Name,
                    DateTime.UtcNow));

                var studentIds = await GetStudentIds(newAssignment.ClassroomId);
                if (studentIds.Any())
                {
                    try
                    {
                        await _dispatcher.DispatchAsync(studentIds, "Bài tập mới", $"\"{newAssignment.Title}\" vừa được đăng.", "assignment", newAssignment.ClassroomId, newAssignment.Id, null, ct);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"⚠️ Dispatch assignment notification failed: {ex.Message}");
                        await _notifications.NotifyUsersAsync(studentIds, "Bài tập mới", $"\"{newAssignment.Title}\" vừa được đăng.", "assignment", newAssignment.ClassroomId, newAssignment.Id, null, ct);
                    }
                }

                created.Add(payload);
            }

            return Ok(new { created, skipped });
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var a = await _db.Assignments.FirstOrDefaultAsync(x => x.Id == id);
            if (a == null) return NotFound();

            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == a.ClassroomId && e.UserId == _me.UserId);
            if (member == null) return Forbid();

            var due = a.DueAt.HasValue ? DateTime.SpecifyKind(a.DueAt.Value, DateTimeKind.Utc) : (DateTime?)null;
            return Ok(new
            {
                a.Id,
                a.Title,
                a.Instructions,
                DueAt = due,
                a.MaxPoints,
                a.ClassroomId,
                a.AllowedFileTypes,
                a.MaxFileSizeBytes,
                a.GroupEnabled,
                a.GroupMinMembers,
                a.GroupMaxMembers,
                a.GroupMode,
                a.AssignmentType,
                a.Status,
                a.QuizTopic,
                a.QuizDifficulty,
                a.QuizQuestionCount,
                a.QuizTimeLimitMinutes
            });
        }

        [HttpGet("classroom/{classroomId:guid}")]
        public async Task<IActionResult> ListByClassroom(Guid classroomId)
        {
            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == classroomId && e.UserId == _me.UserId);
            if (member == null) return Forbid();

            var list = await _db.Assignments
                .Where(a => a.ClassroomId == classroomId)
                .Where(a => member.Role == "Teacher" || a.Status == "published")
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new
                {
                    a.Id,
                    a.Title,
                    DueAt = (DateTime?)(a.DueAt.HasValue ? DateTime.SpecifyKind(a.DueAt.Value, DateTimeKind.Utc) : null),
                    a.MaxPoints,
                    a.GroupEnabled,
                    a.GroupMinMembers,
                    a.GroupMaxMembers,
                    a.GroupMode,
                    a.AssignmentType,
                    a.Status,
                    a.QuizTopic,
                    a.QuizDifficulty,
                    a.QuizQuestionCount,
                    a.QuizTimeLimitMinutes
                })
                .ToListAsync();

            return Ok(list);
        }

        [HttpPost("{id:guid}/materials")]
        public async Task<IActionResult> UploadMaterials(Guid id, [FromForm] IFormFileCollection files, [FromForm] string? links, CancellationToken ct)
        {
            var a = await _db.Assignments.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (a == null) return NotFound();
            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == a.ClassroomId && e.UserId == _me.UserId, ct);
            if (member == null || member.Role != "Teacher") return Forbid();

            var cls = await _db.Classrooms.FirstOrDefaultAsync(c => c.Id == a.ClassroomId, ct);
            var prefix = ResolveAssignmentUploadPrefix(a, cls ?? new Classroom { Id = a.ClassroomId, Name = "untitled" });
            var results = new List<object>();
            string? firstKey = null;
            string? firstContentType = null;

            if (files != null)
            {
                foreach (var f in files)
                {
                    if (f == null || f.Length == 0) continue;
                    await using var s = f.OpenReadStream();
                    var (key, size) = await _storage.UploadAsync(s, f.ContentType ?? "application/octet-stream", prefix, f.FileName, ct);
                    results.Add(new { key, size, name = f.FileName, url = _storage.GetTemporaryUrl(key) });
                    firstKey ??= key;
                    firstContentType ??= f.ContentType;
                }
            }

            if (!string.IsNullOrWhiteSpace(links))
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<List<string>>(links) ?? new List<string>();
                    var json = JsonSerializer.Serialize(parsed);
                    await _storage.UploadTextAsync($"{prefix}/links.json", json, "application/json", ct);
                }
                catch { /* ignore malformed json */ }
            }

            if (firstKey != null)
            {
                a.FileKey = firstKey;
                a.ContentType = firstContentType;
                await _db.SaveChangesAsync(ct);
            }

            return Ok(new { items = results });
        }

        [HttpGet("{id:guid}/materials")]
        public async Task<IActionResult> ListMaterials(Guid id, CancellationToken ct)
        {
            var a = await _db.Assignments.Include(x => x.Classroom).FirstOrDefaultAsync(x => x.Id == id, ct);
            if (a == null) return NotFound();
            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == a.ClassroomId && e.UserId == _me.UserId, ct);
            if (member == null) return Forbid();

            var cls = a.Classroom ?? await _db.Classrooms.FirstOrDefaultAsync(c => c.Id == a.ClassroomId, ct);
            var items = new List<object>();

            var tsPrefix = BuildAssignmentTimestampPrefix(a, cls ?? new Classroom { Id = a.ClassroomId, Name = "untitled" });
            var idPrefix = BuildAssignmentPrefix(a, cls ?? new Classroom { Id = a.ClassroomId, Name = "untitled" });
            var idPrefix6 = BuildAssignmentPrefix6(a, cls ?? new Classroom { Id = a.ClassroomId, Name = "untitled" });

            await LoadAssignmentMaterials(items, tsPrefix, ct);
            await LoadAssignmentMaterials(items, idPrefix, ct);
            await LoadAssignmentMaterials(items, idPrefix6, ct);

            if (items.Count == 0 && !string.IsNullOrWhiteSpace(a.FileKey))
            {
                items.Add(new
                {
                    key = a.FileKey!,
                    size = 0L,
                    url = _storage.GetTemporaryUrl(a.FileKey!),
                    name = System.IO.Path.GetFileName(a.FileKey!)
                });
            }

            return Ok(items);
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Update(Guid id, UpdateAssignmentDto dto)
        {
            var a = await _db.Assignments
                .Include(x => x.Classroom)
                .ThenInclude(c => c.Teacher)
                .FirstOrDefaultAsync(x => x.Id == id);
            if (a == null) return NotFound();

            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == a.ClassroomId && e.UserId == _me.UserId);
            if (member == null || member.Role != "Teacher") return Forbid();

            a.Title = dto.Title.Trim();
            a.Instructions = dto.Instructions;
            a.DueAt = dto.DueAt.HasValue ? DateTime.SpecifyKind(dto.DueAt.Value, DateTimeKind.Utc) : null;
            a.MaxPoints = dto.MaxPoints;
            a.AllowedFileTypes = FileTypeRules.NormalizeAllowedTypes(dto.AllowedFileTypes);
            a.MaxFileSizeBytes = ToBytes(dto.MaxFileSizeMb);
            var (minMembers3, maxMembers3) = NormalizeGroupSize(dto.GroupEnabled, dto.GroupMinMembers, dto.GroupMaxMembers);
            var groupMode3 = dto.GroupEnabled ? NormalizeClassGroupMode(a.Classroom?.ClassGroupMode) : null;
            a.GroupEnabled = dto.GroupEnabled;
            a.GroupMinMembers = minMembers3;
            a.GroupMaxMembers = maxMembers3;
            a.GroupMode = groupMode3;
            a.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            await _hub.Clients.Group(a.ClassroomId.ToString()).SendAsync("AssignmentUpdated", new
            {
                a.Id,
                a.ClassroomId,
                a.Title,
                DueAt = a.DueAt.HasValue ? DateTime.SpecifyKind(a.DueAt.Value, DateTimeKind.Utc) : (DateTime?)null,
                a.MaxPoints,
                a.AllowedFileTypes,
                a.MaxFileSizeBytes,
                a.GroupEnabled,
                a.GroupMinMembers,
                a.GroupMaxMembers,
                a.GroupMode
            });

            await _activityStream.PublishAsync(new ActivityEvent("assignment",
                a.Classroom?.Teacher?.FullName ?? "Giáo viên",
                $"cập nhật bài tập \"{a.Title}\"",
                a.Classroom?.Name ?? string.Empty,
                DateTime.UtcNow));

            var due2 = a.DueAt.HasValue ? DateTime.SpecifyKind(a.DueAt.Value, DateTimeKind.Utc) : (DateTime?)null;
            return Ok(new { a.Id, a.Title, a.Instructions, DueAt = due2, a.MaxPoints, a.AllowedFileTypes, a.MaxFileSizeBytes, a.GroupEnabled, a.GroupMinMembers, a.GroupMaxMembers, a.GroupMode });
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var a = await _db.Assignments
                .Include(x => x.Classroom)
                .ThenInclude(c => c.Teacher)
                .FirstOrDefaultAsync(x => x.Id == id);
            if (a == null) return NotFound();

            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == a.ClassroomId && e.UserId == _me.UserId);
            if (member == null || member.Role != "Teacher") return Forbid();

            var clsId = a.ClassroomId;
            _db.Assignments.Remove(a);
            await _db.SaveChangesAsync();
            await _hub.Clients.Group(clsId.ToString()).SendAsync("AssignmentDeleted", new { id });

            await _activityStream.PublishAsync(new ActivityEvent("assignment",
                a.Classroom?.Teacher?.FullName ?? "Giáo viên",
                $"xoá bài tập \"{a.Title}\"",
                a.Classroom?.Name ?? string.Empty,
                DateTime.UtcNow));

            return NoContent();
        }

        private Task<List<Guid>> GetStudentIds(Guid classroomId)
        {
            return _db.Enrollments
                .Where(e => e.ClassroomId == classroomId && e.Role == "Student")
                .Select(e => e.UserId)
                .ToListAsync();
        }

        private static object BuildAssignmentPayload(Assignment assignment, List<object>? materials = null)
        {
            return new
            {
                id = assignment.Id,
                classroomId = assignment.ClassroomId,
                title = assignment.Title,
                instructions = assignment.Instructions,
                fileKey = assignment.FileKey,
                contentType = assignment.ContentType,
                dueAt = assignment.DueAt.HasValue ? DateTime.SpecifyKind(assignment.DueAt.Value, DateTimeKind.Utc) : (DateTime?)null,
                maxPoints = assignment.MaxPoints,
                allowedFileTypes = assignment.AllowedFileTypes,
                maxFileSizeBytes = assignment.MaxFileSizeBytes,
                groupEnabled = assignment.GroupEnabled,
                groupMinMembers = assignment.GroupMinMembers,
                groupMaxMembers = assignment.GroupMaxMembers,
                groupMode = assignment.GroupMode,
                assignmentType = assignment.AssignmentType,
                status = assignment.Status,
                quizTopic = assignment.QuizTopic,
                quizDifficulty = assignment.QuizDifficulty,
                quizQuestionCount = assignment.QuizQuestionCount,
                quizTimeLimitMinutes = assignment.QuizTimeLimitMinutes,
                createdAt = DateTime.SpecifyKind(assignment.CreatedAt, DateTimeKind.Utc),
                materials = materials ?? new List<object>()
            };
        }

        private async Task<(List<(string key, long size, string name)> files, List<string> links)> ListAssignmentMaterialSources(Assignment assignment, Classroom classroom, CancellationToken ct)
        {
            var files = new Dictionary<string, (string key, long size, string name)>(StringComparer.OrdinalIgnoreCase);
            var links = new List<string>();
            var linkSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            async Task LoadPrefix(string prefix)
            {
                var blobs = await _storage.ListAsync(prefix, ct);
                foreach (var blob in blobs.Where(b => !b.key.EndsWith("links.json", StringComparison.OrdinalIgnoreCase)))
                {
                    if (!files.ContainsKey(blob.key))
                    {
                        files[blob.key] = (blob.key, blob.sizeBytes, System.IO.Path.GetFileName(blob.key));
                    }
                }

                var linkJson = await _storage.ReadTextAsync($"{prefix}/links.json", ct);
                if (string.IsNullOrWhiteSpace(linkJson)) return;

                try
                {
                    var parsed = JsonSerializer.Deserialize<List<string>>(linkJson) ?? new List<string>();
                    foreach (var link in parsed.Where(x => !string.IsNullOrWhiteSpace(x)))
                    {
                        if (linkSet.Add(link))
                            links.Add(link);
                    }
                }
                catch { }
            }

            await LoadPrefix(BuildAssignmentTimestampPrefix(assignment, classroom));
            await LoadPrefix(BuildAssignmentPrefix(assignment, classroom));
            await LoadPrefix(BuildAssignmentPrefix6(assignment, classroom));

            if (files.Count == 0 && !string.IsNullOrWhiteSpace(assignment.FileKey))
            {
                files[assignment.FileKey!] = (assignment.FileKey!, 0L, System.IO.Path.GetFileName(assignment.FileKey!));
            }

            return (files.Values.ToList(), links);
        }

        private async Task LoadAssignmentMaterials(List<object> items, string prefix, CancellationToken ct)
        {
            var blobs = await _storage.ListAsync(prefix, ct);
            items.AddRange(
                blobs
                    .Where(b => !b.key.EndsWith("links.json", StringComparison.OrdinalIgnoreCase))
                    .Select(b => (object)new { key = b.key, size = b.sizeBytes, url = _storage.GetTemporaryUrl(b.key), name = System.IO.Path.GetFileName(b.key) })
            );

            var linkJson = await _storage.ReadTextAsync($"{prefix}/links.json", ct);
            if (!string.IsNullOrWhiteSpace(linkJson))
            {
                try
                {
                    var arr = JsonSerializer.Deserialize<List<string>>(linkJson) ?? new List<string>();
                    var linkItems = arr.Select((u, idx) => new { key = $"link-{idx}", size = 0L, url = u ?? string.Empty, name = u ?? string.Empty });
                    items.AddRange(linkItems);
                }
                catch { }
            }
        }

        private async Task NotifyAssignmentPublished(Assignment assignment, Enrollment member, CancellationToken ct)
        {
            await _hub.Clients.Group(assignment.ClassroomId.ToString()).SendAsync("AssignmentCreated", new
            {
                assignment.Id,
                assignment.ClassroomId,
                assignment.Title,
                DueAt = assignment.DueAt.HasValue ? DateTime.SpecifyKind(assignment.DueAt.Value, DateTimeKind.Utc) : (DateTime?)null,
                assignment.MaxPoints,
                assignment.AllowedFileTypes,
                assignment.MaxFileSizeBytes,
                assignment.GroupEnabled,
                assignment.GroupMinMembers,
                assignment.GroupMaxMembers,
                assignment.GroupMode,
                assignment.AssignmentType,
                assignment.Status,
                assignment.QuizTopic,
                assignment.QuizDifficulty,
                assignment.QuizQuestionCount,
                assignment.QuizTimeLimitMinutes,
                CreatedAt = DateTime.SpecifyKind(assignment.CreatedAt, DateTimeKind.Utc)
            }, ct);

            await _activityStream.PublishAsync(new ActivityEvent("assignment",
                member.User?.FullName ?? "Giáo viên",
                $"giao bài tập \"{assignment.Title}\"",
                member.Classroom?.Name ?? string.Empty,
                DateTime.UtcNow));

            var studentIds = await GetStudentIds(assignment.ClassroomId);
            if (studentIds.Any())
            {
                try
                {
                    await _dispatcher.DispatchAsync(studentIds, "Bài tập mới", $"\"{assignment.Title}\" vừa được đăng.", "assignment", assignment.ClassroomId, assignment.Id, null, ct);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"⚠️ Dispatch assignment notification failed: {ex.Message}");
                    await _notifications.NotifyUsersAsync(studentIds, "Bài tập mới", $"\"{assignment.Title}\" vừa được đăng.", "assignment", assignment.ClassroomId, assignment.Id, null, ct);
                }
            }
        }

        private async Task CreateGroupsFromClassroom(Guid assignmentId, Guid classroomId, CancellationToken ct = default)
        {
            var classGroups = await _db.ClassroomGroups
                .Include(g => g.Members)
                .Where(g => g.ClassroomId == classroomId)
                .ToListAsync(ct);

            if (classGroups.Count == 0) return;

            var now = DateTime.UtcNow;
            foreach (var cg in classGroups)
            {
                if (cg.Members.Count == 0) continue;
                var leaderId = cg.LeaderId;
                var group = new AssignmentGroup
                {
                    AssignmentId = assignmentId,
                    Name = cg.Name,
                    LeaderId = leaderId,
                    CreatedAt = now,
                    UpdatedAt = now
                };

                foreach (var member in cg.Members)
                {
                    var isLeader = member.UserId == leaderId;
                    group.Members.Add(new AssignmentGroupMember
                    {
                        AssignmentId = assignmentId,
                        GroupId = group.Id,
                        UserId = member.UserId,
                        Role = isLeader ? "Leader" : "Member",
                        CanSubmit = isLeader,
                        JoinedAt = now
                    });
                }

                _db.AssignmentGroups.Add(group);
            }

            await _db.SaveChangesAsync(ct);
        }
    }
}
