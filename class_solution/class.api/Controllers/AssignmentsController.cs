using class_api.Infrastructure.Data;
using class_api.Domain;
using class_api.Application.Dtos;
using class_api.Services;
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

        public AssignmentsController(ApplicationDbContext db, ICurrentUser me, IStorage storage, IHubContext<ClassroomHub> hub, IActivityStream activityStream, INotificationDispatcher dispatcher)
        {
            _db = db; _me = me; _storage = storage; _hub = hub; _activityStream = activityStream; _dispatcher = dispatcher;
        }

        private static string Slugify(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return "untitled";
            var cleaned = new string(input.Trim().Select(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_' ? ch : '-').ToArray());
            while (cleaned.Contains("--")) cleaned = cleaned.Replace("--", "-");
            return cleaned.Trim('-').ToLowerInvariant();
        }

        [HttpPost]
        [Consumes("application/json")]
        public async Task<IActionResult> Create(CreateAssignmentDto dto)
        {
            var member = await _db.Enrollments
                .Include(e => e.User)
                .Include(e => e.Classroom)
                .FirstOrDefaultAsync(e => e.ClassroomId == dto.ClassroomId && e.UserId == _me.UserId);

            if (member == null || member.Role != "Teacher") return Forbid();

            var a = new Assignment
            {
                ClassroomId = dto.ClassroomId,
                Title = dto.Title.Trim(),
                Instructions = dto.Instructions,
                DueAt = dto.DueAt.HasValue ? DateTime.SpecifyKind(dto.DueAt.Value, DateTimeKind.Utc) : null,
                MaxPoints = dto.MaxPoints,
                CreatedBy = _me.UserId
            };
            _db.Assignments.Add(a);
            await _db.SaveChangesAsync();

            await _hub.Clients.Group(a.ClassroomId.ToString()).SendAsync("AssignmentCreated", new
            {
                a.Id,
                a.ClassroomId,
                a.Title,
                DueAt = a.DueAt.HasValue ? DateTime.SpecifyKind(a.DueAt.Value, DateTimeKind.Utc) : (DateTime?)null,
                a.MaxPoints,
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
                }
            }

            return CreatedAtAction(nameof(GetById), new { id = a.Id }, new { a.Id, a.Title, a.DueAt, a.MaxPoints });
        }

        [HttpPost("with-materials")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> CreateWithMaterials(
            [FromForm] Guid ClassroomId,
            [FromForm] string Title,
            [FromForm] string? Instructions,
            [FromForm] string? DueAt, 
            [FromForm] int MaxPoints = 100,
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

            var a = new Assignment
            {
                ClassroomId = ClassroomId,
                Title = Title.Trim(),
                Instructions = Instructions,
                DueAt = dueAt,
                MaxPoints = MaxPoints,
                CreatedBy = _me.UserId
            };
            _db.Assignments.Add(a);
            await _db.SaveChangesAsync(ct);

            var cls = member.Classroom ?? await _db.Classrooms.FirstOrDefaultAsync(c => c.Id == ClassroomId, ct);
            var classSlug = Slugify(cls?.Name);
            var classShort = (cls?.Id ?? ClassroomId).ToString()[..8];
            var assignShort = a.Id.ToString()[..8];
            var prefix = $"materials/{classSlug}-{classShort}/{Slugify(a.Title)}-{assignShort}";
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
                }
            }

            return CreatedAtAction(nameof(GetById), new { id = a.Id }, new { a.Id, a.Title, a.DueAt, a.MaxPoints });
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var a = await _db.Assignments.FirstOrDefaultAsync(x => x.Id == id);
            if (a == null) return NotFound();

            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == a.ClassroomId && e.UserId == _me.UserId);
            if (member == null) return Forbid();

            var due = a.DueAt.HasValue ? DateTime.SpecifyKind(a.DueAt.Value, DateTimeKind.Utc) : (DateTime?)null;
            return Ok(new { a.Id, a.Title, a.Instructions, DueAt = due, a.MaxPoints, a.ClassroomId });
        }

        [HttpGet("classroom/{classroomId:guid}")]
        public async Task<IActionResult> ListByClassroom(Guid classroomId)
        {
            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == classroomId && e.UserId == _me.UserId);
            if (member == null) return Forbid();

            var list = await _db.Assignments
                .Where(a => a.ClassroomId == classroomId)
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new { a.Id, a.Title, DueAt = (DateTime?)(a.DueAt.HasValue ? DateTime.SpecifyKind(a.DueAt.Value, DateTimeKind.Utc) : null), a.MaxPoints })
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
            var classSlug = Slugify(cls?.Name);
            var classShort = (cls?.Id ?? a.ClassroomId).ToString()[..8];
            var assignShort = a.Id.ToString()[..8];
            var prefix = $"materials/{classSlug}-{classShort}/{Slugify(a.Title)}-{assignShort}";
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
            var classSlug = Slugify(cls?.Name);
            var classShort = (cls?.Id ?? a.ClassroomId).ToString()[..8];
            var assignShort = a.Id.ToString()[..8];
            var prefix = $"materials/{classSlug}-{classShort}/{Slugify(a.Title)}-{assignShort}";

            var blobs = await _storage.ListAsync(prefix, ct);
            var items = blobs
                .Where(b => !b.key.EndsWith("links.json", StringComparison.OrdinalIgnoreCase))
                .Select(b => new { key = b.key, size = b.sizeBytes, url = _storage.GetTemporaryUrl(b.key), name = System.IO.Path.GetFileName(b.key) })
                .ToList();

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
            a.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            await _hub.Clients.Group(a.ClassroomId.ToString()).SendAsync("AssignmentUpdated", new
            {
                a.Id,
                a.ClassroomId,
                a.Title,
                DueAt = a.DueAt.HasValue ? DateTime.SpecifyKind(a.DueAt.Value, DateTimeKind.Utc) : (DateTime?)null,
                a.MaxPoints
            });

            await _activityStream.PublishAsync(new ActivityEvent("assignment",
                a.Classroom?.Teacher?.FullName ?? "Giáo viên",
                $"cập nhật bài tập \"{a.Title}\"",
                a.Classroom?.Name ?? string.Empty,
                DateTime.UtcNow));

            var due2 = a.DueAt.HasValue ? DateTime.SpecifyKind(a.DueAt.Value, DateTimeKind.Utc) : (DateTime?)null;
            return Ok(new { a.Id, a.Title, a.Instructions, DueAt = due2, a.MaxPoints });
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
    }
}
