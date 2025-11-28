using class_api.Data;
using class_api.Domain;
using class_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using class_api.Hubs;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace class_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AnnouncementsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ICurrentUser _me;
        private readonly IHubContext<ClassroomHub> _hub;
        private readonly IStorage _storage;
        private readonly IActivityStream _activityStream;
        private readonly INotificationDispatcher _dispatcher;

        public AnnouncementsController(AppDbContext db, ICurrentUser me, IHubContext<ClassroomHub> hub, IStorage storage, IActivityStream activityStream, INotificationDispatcher dispatcher)
        {
            _db = db; _me = me; _hub = hub; _storage = storage; _activityStream = activityStream; _dispatcher = dispatcher;
        }

        public record CreateAnnouncementDto(Guid ClassroomId, string Content, bool AllStudents = true, Guid[]? UserIds = null);

        [HttpPost]
        [Consumes("application/json")]
        public async Task<IActionResult> Create(CreateAnnouncementDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Content)) return BadRequest("Content is required");
            var classroom = await _db.Classrooms.FirstOrDefaultAsync(c => c.Id == dto.ClassroomId);
            if (classroom == null) return NotFound();

            // must be teacher of this classroom
            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == dto.ClassroomId && e.UserId == _me.UserId);
            if (member == null || !string.Equals(member.Role, "Teacher", StringComparison.OrdinalIgnoreCase))
                return Forbid();

            var ann = new Announcement
            {
                ClassroomId = dto.ClassroomId,
                UserId = _me.UserId,
                Content = dto.Content.Trim(),
                IsForAll = dto.AllStudents || (dto.UserIds == null || dto.UserIds.Length == 0),
                TargetUserIdsJson = (!dto.AllStudents && dto.UserIds != null && dto.UserIds.Length > 0)
                    ? System.Text.Json.JsonSerializer.Serialize(dto.UserIds)
                    : null
            };
            _db.Announcements.Add(ann);
            await _db.SaveChangesAsync();

            var creator = await _db.Users.FindAsync(_me.UserId);
            var payload = new
            {
                ann.Id,
                ann.ClassroomId,
                ann.Content,
                ann.IsForAll,
                targetUserIds = ParseTargets(ann.TargetUserIdsJson),
                CreatedAt = DateTime.SpecifyKind(ann.CreatedAt, DateTimeKind.Utc),
                createdBy = _me.UserId,
                createdByName = creator?.FullName ?? "",
                createdByAvatar = creator?.Avatar
            };

            await _hub.Clients.Group(ann.ClassroomId.ToString()).SendAsync("AnnouncementAdded", payload);
            var creatorName = creator?.FullName ?? "Giáo viên";
            await _activityStream.PublishAsync(new ActivityEvent("announcement", creatorName, "tạo thông báo mới", classroom.Name, DateTime.UtcNow));

            var recipients = await ResolveAnnouncementRecipients(ann.ClassroomId, ann.IsForAll, ann.TargetUserIdsJson);
            if (recipients.Any())
            {
                var preview = ann.Content.Length > 120 ? ann.Content[..120] + "..." : ann.Content;
                await _dispatcher.DispatchAsync(recipients, "Thông báo mới", preview, "announcement", ann.ClassroomId);
            }

            return Ok(payload);
        }

        // Create announcement with materials in a single multipart/form-data request
        [HttpPost]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> CreateWithMaterials(
            [FromForm] Guid ClassroomId,
            [FromForm] string Content,
            [FromForm] bool AllStudents = true,
            [FromForm] string? UserIds = null,
            [FromForm] IFormFileCollection? Files = null,
            [FromForm] string? Links = null,
            CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(Content)) return BadRequest("Content is required");
            var classroom = await _db.Classrooms.FirstOrDefaultAsync(c => c.Id == ClassroomId);
            if (classroom == null) return NotFound();

            // must be teacher of this classroom
            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == ClassroomId && e.UserId == _me.UserId);
            if (member == null || !string.Equals(member.Role, "Teacher", StringComparison.OrdinalIgnoreCase))
                return Forbid();

            Guid[]? parsedUserIds = null;
            try { if (!string.IsNullOrWhiteSpace(UserIds)) parsedUserIds = System.Text.Json.JsonSerializer.Deserialize<Guid[]>(UserIds!); } catch { }

            var ann = new Announcement
            {
                ClassroomId = ClassroomId,
                UserId = _me.UserId,
                Content = Content.Trim(),
                IsForAll = AllStudents || (parsedUserIds == null || parsedUserIds.Length == 0),
                TargetUserIdsJson = (!AllStudents && parsedUserIds != null && parsedUserIds.Length > 0)
                    ? System.Text.Json.JsonSerializer.Serialize(parsedUserIds)
                    : null
            };
            _db.Announcements.Add(ann);
            await _db.SaveChangesAsync(ct);

            // Upload materials immediately under `announcements/{id}`
            var prefix = $"announcements/{ann.Id}";
            var items = new List<object>();
            if (Files != null)
            {
                foreach (var f in Files)
                {
                    if (f == null || f.Length == 0) continue;
                    await using var s = f.OpenReadStream();
                    var (key, size) = await _storage.UploadAsync(s, f.ContentType ?? "application/octet-stream", prefix, f.FileName, ct);
                    items.Add(new { key, size, name = f.FileName, url = _storage.GetTemporaryUrl(key) });
                }
            }
            if (!string.IsNullOrWhiteSpace(Links))
            {
                try
                {
                    var arr = System.Text.Json.JsonSerializer.Deserialize<List<string>>(Links!) ?? new List<string>();
                    var json = System.Text.Json.JsonSerializer.Serialize(arr);
                    await _storage.UploadTextAsync($"{prefix}/links.json", json, "application/json", ct);
                    items.AddRange(arr.Select(u => new { key = (string?)null, size = 0L, url = u, name = u }));
                }
                catch { }
            }

            var creator = await _db.Users.FindAsync(_me.UserId);
            var createdAt = DateTime.SpecifyKind(ann.CreatedAt, DateTimeKind.Utc);
            var payload = new
            {
                id = ann.Id,
                classroomId = ann.ClassroomId,
                content = ann.Content,
                isForAll = ann.IsForAll,
                targetUserIds = ParseTargets(ann.TargetUserIdsJson),
                createdAt,
                createdBy = _me.UserId,
                createdByName = creator?.FullName ?? "",
                createdByAvatar = creator?.Avatar,
                materials = items
            };

            await _hub.Clients.Group(ann.ClassroomId.ToString()).SendAsync("AnnouncementAdded", payload);
            await _activityStream.PublishAsync(new ActivityEvent("announcement",
                creator?.FullName ?? "Giáo viên",
                "tạo thông báo mới",
                classroom.Name,
                DateTime.UtcNow));

            var recipients = await ResolveAnnouncementRecipients(ann.ClassroomId, ann.IsForAll, ann.TargetUserIdsJson);
            if (recipients.Any())
            {
                var preview = ann.Content.Length > 120 ? ann.Content[..120] + "..." : ann.Content;
                await _dispatcher.DispatchAsync(recipients, "Thông báo mới", preview, "announcement", ann.ClassroomId);
            }

            return Ok(payload);
        }

        public record UpdateAnnouncementDto(string? Content, bool? AllStudents, Guid[]? UserIds);

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Update(Guid id, UpdateAnnouncementDto dto)
        {
            var ann = await _db.Announcements
                .Include(x => x.Classroom)
                .ThenInclude(c => c.Teacher)
                .FirstOrDefaultAsync(x => x.Id == id);
            if (ann == null) return NotFound();
            var member = await _db.Enrollments.Include(e => e.User).FirstOrDefaultAsync(e => e.ClassroomId == ann.ClassroomId && e.UserId == _me.UserId);
            if (member == null || !string.Equals(member.Role, "Teacher", StringComparison.OrdinalIgnoreCase)) return Forbid();

            if (!string.IsNullOrWhiteSpace(dto.Content)) ann.Content = dto.Content.Trim();
            if (dto.AllStudents.HasValue)
            {
                ann.IsForAll = dto.AllStudents.Value || (dto.UserIds == null || dto.UserIds.Length == 0);
                ann.TargetUserIdsJson = (!ann.IsForAll && dto.UserIds != null && dto.UserIds.Length > 0)
                    ? System.Text.Json.JsonSerializer.Serialize(dto.UserIds)
                    : null;
            }
            else if (dto.UserIds != null)
            {
                ann.IsForAll = false;
                ann.TargetUserIdsJson = System.Text.Json.JsonSerializer.Serialize(dto.UserIds);
            }

            await _db.SaveChangesAsync();

            var payload = new
            {
                id = ann.Id,
                classroomId = ann.ClassroomId,
                content = ann.Content,
                isForAll = ann.IsForAll,
                targetUserIds = ParseTargets(ann.TargetUserIdsJson)
            };
            await _hub.Clients.Group(ann.ClassroomId.ToString()).SendAsync("AnnouncementUpdated", payload);
            await _activityStream.PublishAsync(new ActivityEvent("announcement",
                member.User?.FullName ?? "Giáo viên",
                "chỉnh sửa thông báo",
                ann.Classroom?.Name,
                DateTime.UtcNow));
            return Ok(payload);
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var ann = await _db.Announcements
                .Include(x => x.Classroom)
                .ThenInclude(c => c.Teacher)
                .FirstOrDefaultAsync(x => x.Id == id);
            if (ann == null) return NotFound();
            var member = await _db.Enrollments.Include(e => e.User).FirstOrDefaultAsync(e => e.ClassroomId == ann.ClassroomId && e.UserId == _me.UserId);
            if (member == null || !string.Equals(member.Role, "Teacher", StringComparison.OrdinalIgnoreCase)) return Forbid();

            var clsId = ann.ClassroomId;
            _db.Announcements.Remove(ann);
            await _db.SaveChangesAsync();
            await _hub.Clients.Group(clsId.ToString()).SendAsync("AnnouncementDeleted", new { id, classroomId = clsId });
            await _activityStream.PublishAsync(new ActivityEvent("announcement",
                member.User?.FullName ?? "Giáo viên",
                "xoá thông báo",
                ann.Classroom?.Name,
                DateTime.UtcNow));
            return NoContent();
        }

        // ===== Comments on announcements =====
        [HttpGet("{id:guid}/comments")]
        public async Task<IActionResult> ListComments(Guid id, int skip = 0, int take = 100)
        {
            var ann = await _db.Announcements.FirstOrDefaultAsync(x => x.Id == id);
            if (ann == null) return NotFound();
            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == ann.ClassroomId && e.UserId == _me.UserId);
            if (member == null) return Forbid();

            var list = await _db.AnnouncementComments
                .Where(c => c.AnnouncementId == id)
                .OrderBy(c => c.CreatedAt)
                .Select(c => new { c.Id, c.AnnouncementId, c.UserId, userName = c.User!.FullName, userAvatar = c.User!.Avatar, c.Content, CreatedAt = DateTime.SpecifyKind(c.CreatedAt, DateTimeKind.Utc) })
                .Skip(skip).Take(take)
                .ToListAsync();
            return Ok(list);
        }

        public record CreateAnnouncementCommentDto(string Content);

        [HttpPost("{id:guid}/comments")]
        public async Task<IActionResult> CreateComment(Guid id, CreateAnnouncementCommentDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Content)) return BadRequest("Empty content");
            var ann = await _db.Announcements.FirstOrDefaultAsync(x => x.Id == id);
            if (ann == null) return NotFound();
            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == ann.ClassroomId && e.UserId == _me.UserId);
            if (member == null) return Forbid();

            var c = new AnnouncementComment { AnnouncementId = id, UserId = _me.UserId, Content = dto.Content.Trim() };
            _db.AnnouncementComments.Add(c);
            await _db.SaveChangesAsync();

            var user = await _db.Users.FindAsync(_me.UserId);
            var classroom = await _db.Classrooms.FirstOrDefaultAsync(x => x.Id == ann.ClassroomId);
            var payload = new { c.Id, c.AnnouncementId, c.UserId, userName = user?.FullName ?? "", userAvatar = user?.Avatar, c.Content, CreatedAt = DateTime.SpecifyKind(c.CreatedAt, DateTimeKind.Utc), classroomId = ann.ClassroomId };
            await _hub.Clients.Group(ann.ClassroomId.ToString()).SendAsync("AnnouncementCommentAdded", payload);
            await _activityStream.PublishAsync(new ActivityEvent("announcement-comment",
                user?.FullName ?? "Người dùng",
                "bình luận vào thông báo",
                classroom?.Name,
                DateTime.UtcNow));
            return Ok(payload);
        }

        [HttpGet("classroom/{classroomId:guid}")]
        public async Task<IActionResult> List(Guid classroomId, int skip = 0, int take = 50)
        {
            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == classroomId && e.UserId == _me.UserId);
            if (member == null) return Forbid();
            var isTeacher = string.Equals(member.Role, "Teacher", StringComparison.OrdinalIgnoreCase);

            var q = _db.Announcements.Where(a => a.ClassroomId == classroomId);

            if (!isTeacher)
            {
                var meIdLower = _me.UserId.ToString().ToLower();
                q = q.Where(a => a.IsForAll || (a.TargetUserIdsJson != null && a.TargetUserIdsJson.ToLower().Contains(meIdLower)));
            }

            var list = await q
                .OrderByDescending(a => a.CreatedAt)
                .Skip(skip).Take(take)
                .Select(a => new
                {
                    a.Id,
                    a.ClassroomId,
                    a.Content,
                    a.IsForAll,
                    targetUserIds = a.TargetUserIdsJson,
                    CreatedAt = DateTime.SpecifyKind(a.CreatedAt, DateTimeKind.Utc),
                    createdBy = a.UserId,
                    createdByName = a.User != null ? a.User.FullName : "",
                    createdByAvatar = a.User != null ? a.User.Avatar : null
                })
                .ToListAsync();

            var normalized = list.Select(x => new
            {
                x.Id,
                x.ClassroomId,
                x.Content,
                x.IsForAll,
                targetUserIds = ParseTargets(x.targetUserIds),
                x.CreatedAt,
                x.createdBy,
                x.createdByName,
                x.createdByAvatar
            });

            return Ok(normalized);
        }

        // Upload files/links for an announcement (teacher only)
        [HttpPost("{id:guid}/materials")]
        public async Task<IActionResult> UploadMaterials(Guid id, [FromForm] IFormFileCollection files, [FromForm] string? links, CancellationToken ct)
        {
            var ann = await _db.Announcements.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (ann == null) return NotFound();
            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == ann.ClassroomId && e.UserId == _me.UserId, ct);
            if (member == null || !string.Equals(member.Role, "Teacher", StringComparison.OrdinalIgnoreCase)) return Forbid();

            var prefix = $"announcements/{id}";
            var results = new List<object>();

            if (files != null)
            {
                foreach (var f in files)
                {
                    if (f == null || f.Length == 0) continue;
                    await using var s = f.OpenReadStream();
                    var (key, size) = await _storage.UploadAsync(s, f.ContentType ?? "application/octet-stream", prefix, f.FileName, ct);
                    results.Add(new { key, size, name = f.FileName, url = _storage.GetTemporaryUrl(key) });
                }
            }

            if (!string.IsNullOrWhiteSpace(links))
            {
                try
                {
                    var parsed = System.Text.Json.JsonSerializer.Deserialize<List<string>>(links) ?? new List<string>();
                    var json = System.Text.Json.JsonSerializer.Serialize(parsed);
                    await _storage.UploadTextAsync($"{prefix}/links.json", json, "application/json", ct);
                }
                catch { }
            }

            return Ok(new { items = results });
        }

        // List files/links for an announcement
        [HttpGet("{id:guid}/materials")]
        public async Task<IActionResult> ListMaterials(Guid id, CancellationToken ct)
        {
            var ann = await _db.Announcements.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (ann == null) return NotFound();
            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == ann.ClassroomId && e.UserId == _me.UserId, ct);
            if (member == null) return Forbid();

            var prefix = $"announcements/{id}";
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
                    var arr = System.Text.Json.JsonSerializer.Deserialize<List<string>>(linkJson) ?? new List<string>();
                    items.AddRange(arr.Select(u => new { key = (string?)null, size = 0L, url = u, name = u }));
                }
                catch { }
            }

            return Ok(items);
        }

        private static Guid[] ParseTargets(string? json)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(json)) return Array.Empty<Guid>();
                var arr = System.Text.Json.JsonSerializer.Deserialize<Guid[]>(json);
                return arr ?? Array.Empty<Guid>();
            }
            catch { return Array.Empty<Guid>(); }
        }

        private async Task<List<Guid>> ResolveAnnouncementRecipients(Guid classroomId, bool isForAll, string? targetJson)
        {
            if (isForAll || string.IsNullOrWhiteSpace(targetJson))
            {
                return await _db.Enrollments
                    .Where(e => e.ClassroomId == classroomId && e.Role == "Student")
                    .Select(e => e.UserId)
                    .ToListAsync();
            }
            var ids = ParseTargets(targetJson);
            if (ids.Length == 0) return new List<Guid>();
            return await _db.Enrollments
                .Where(e => e.ClassroomId == classroomId && e.Role == "Student" && ids.Contains(e.UserId))
                .Select(e => e.UserId)
                .ToListAsync();
        }
    }
}
