using class_api.Infrastructure.Data;
using class_api.Domain;
using class_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using class_api.Hubs;
using Microsoft.EntityFrameworkCore;
using System.IO;
using System.Text.Json;

namespace class_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AnnouncementsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUser _me;
        private readonly IHubContext<ClassroomHub> _hub;
        private readonly IStorage _storage;
        private readonly IActivityStream _activityStream;
        private readonly INotificationDispatcher _dispatcher;

        public AnnouncementsController(ApplicationDbContext db, ICurrentUser me, IHubContext<ClassroomHub> hub, IStorage storage, IActivityStream activityStream, INotificationDispatcher dispatcher)
        {
            _db = db; _me = me; _hub = hub; _storage = storage; _activityStream = activityStream; _dispatcher = dispatcher;
        }

        private static string Slugify(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return "untitled";
            var cleaned = new string(input.Trim().Select(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_' ? ch : '-').ToArray());
            while (cleaned.Contains("--")) cleaned = cleaned.Replace("--", "-");
            return cleaned.Trim('-').ToLowerInvariant();
        }

        public record CreateAnnouncementDto(Guid ClassroomId, string Content, bool AllStudents = true, Guid[]? UserIds = null);

        [HttpPost]
        [Consumes("application/json")]
        public async Task<IActionResult> Create(CreateAnnouncementDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Content)) return BadRequest("Content is required");
            var classroom = await _db.Classrooms.FirstOrDefaultAsync(c => c.Id == dto.ClassroomId);
            if (classroom == null) return NotFound();

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
                try
                {
                    await _dispatcher.DispatchAsync(recipients, "Thông báo mới", preview, "announcement", ann.ClassroomId);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"⚠️ Dispatch announcement notification failed: {ex.Message}");
                }
            }

            return Ok(payload);
        }

        [HttpPost("with-materials")]
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

            var prefix = BuildTimestampPrefix(ann, classroom!);
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
                    var arr = System.Text.Json.JsonSerializer.Deserialize<List<string>>(Links!) ?? new List<string>();
                    var json = System.Text.Json.JsonSerializer.Serialize(arr);
                    await _storage.UploadTextAsync($"{prefix}/links.json", json, "application/json", ct);
                    var linkItems = arr.Select((u, idx) => new { key = $"link-{idx}", size = 0L, url = u ?? string.Empty, name = u ?? string.Empty });
                    items.AddRange(linkItems);
                }
                catch { }
            }

            if (firstKey != null)
            {
                ann.FileKey = firstKey;
                ann.ContentType = firstContentType;
                await _db.SaveChangesAsync(ct);
            }

            var creator = await _db.Users.FindAsync(_me.UserId);
            var createdAt = DateTime.SpecifyKind(ann.CreatedAt, DateTimeKind.Utc);
            var payload = new
            {
                id = ann.Id,
                classroomId = ann.ClassroomId,
                content = ann.Content,
                fileKey = ann.FileKey,
                contentType = ann.ContentType,
                isForAll = ann.IsForAll,
                targetUserIds = ParseTargets(ann.TargetUserIdsJson),
                createdAt,
                createdBy = _me.UserId,
                createdByName = creator?.FullName ?? "",
                createdByAvatar = creator?.Avatar,
                materials = items,
                attachments = items 
            };

            await _hub.Clients.Group(ann.ClassroomId.ToString()).SendAsync("AnnouncementAdded", payload);
            await _activityStream.PublishAsync(new ActivityEvent("announcement",
                creator?.FullName ?? "Giáo viên",
                "tạo thông báo mới",
                classroom!.Name,
                DateTime.UtcNow));

            var recipients = await ResolveAnnouncementRecipients(ann.ClassroomId, ann.IsForAll, ann.TargetUserIdsJson);
            if (recipients.Any())
            {
                var preview = ann.Content.Length > 120 ? ann.Content[..120] + "..." : ann.Content;
                try
                {
                    await _dispatcher.DispatchAsync(recipients, "Thông báo mới", preview, "announcement", ann.ClassroomId);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"⚠️ Dispatch announcement notification failed: {ex.Message}");
                }
            }

            return Ok(payload);
        }

        public record UpdateAnnouncementDto(string? Content, bool? AllStudents, Guid[]? UserIds);
        public record RepostAnnouncementDto(Guid[] ClassroomIds, string? Content = null, bool? AllStudents = null, Guid[]? UserIds = null, bool? CopyAttachments = null);

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

        [HttpPost("{id:guid}/repost")]
        public async Task<IActionResult> Repost(Guid id, RepostAnnouncementDto dto, CancellationToken ct)
        {
            if (dto.ClassroomIds == null || dto.ClassroomIds.Length == 0)
                return BadRequest(new { message = "Chọn lớp để đăng lại." });

            var ann = await _db.Announcements
                .Include(a => a.Classroom)
                .FirstOrDefaultAsync(x => x.Id == id, ct);
            if (ann == null) return NotFound();

            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == ann.ClassroomId && e.UserId == _me.UserId, ct);
            if (member == null || !string.Equals(member.Role, "Teacher", StringComparison.OrdinalIgnoreCase))
                return Forbid();

            var targetClassroomIds = dto.ClassroomIds
                .Where(x => x != ann.ClassroomId)
                .Distinct()
                .ToList();
            if (targetClassroomIds.Count == 0)
                return BadRequest(new { message = "Không có lớp hợp lệ để đăng lại." });

            var teacherTargets = await _db.Enrollments
                .Include(e => e.Classroom)
                .Where(e => targetClassroomIds.Contains(e.ClassroomId) && e.UserId == _me.UserId && e.Role == "Teacher")
                .Select(e => new { e.ClassroomId, Classroom = e.Classroom! })
                .ToListAsync(ct);

            if (teacherTargets.Count == 0) return Forbid();

            var allowedIds = teacherTargets.Select(x => x.ClassroomId).ToHashSet();
            var skipped = new List<object>();
            foreach (var cid in dto.ClassroomIds.Distinct())
            {
                if (cid == ann.ClassroomId)
                    skipped.Add(new { classroomId = cid, reason = "same-class" });
                else if (!allowedIds.Contains(cid))
                    skipped.Add(new { classroomId = cid, reason = "not-teacher" });
            }

            var sourceClassroom = ann.Classroom ?? await _db.Classrooms.FirstOrDefaultAsync(c => c.Id == ann.ClassroomId, ct);
            var sourceMaterials = sourceClassroom == null ? new List<object>() : await ListMaterialsInternal(ann, sourceClassroom, ct);
            var (sourceFiles, sourceLinks) = ExtractMaterials(sourceMaterials);
            if (sourceFiles.Count == 0 && !string.IsNullOrWhiteSpace(ann.FileKey))
            {
                sourceFiles.Add((ann.FileKey!, Path.GetFileName(ann.FileKey!)));
            }

            var copyAttachments = dto.CopyAttachments ?? true;
            var sourceFileKeys = sourceFiles
                .Select(f => f.key)
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            var attachmentKeysJson = !copyAttachments && sourceFileKeys.Count > 0
                ? JsonSerializer.Serialize(sourceFileKeys)
                : null;

            var creator = await _db.Users.FindAsync(new object[] { _me.UserId }, ct);
            var created = new List<object>();
            var content = string.IsNullOrWhiteSpace(dto.Content) ? ann.Content : dto.Content.Trim();
            var targetUserIds = dto.UserIds ?? Array.Empty<Guid>();
            var isForAll = dto.AllStudents ?? (targetUserIds.Length == 0);
            var useTargets = !isForAll && targetUserIds.Length > 0;

            foreach (var target in teacherTargets)
            {
                var newAnn = new Announcement
                {
                    ClassroomId = target.ClassroomId,
                    UserId = _me.UserId,
                    Content = content,
                    IsForAll = !useTargets,
                    TargetUserIdsJson = useTargets ? JsonSerializer.Serialize(targetUserIds) : null,
                    AttachmentKeysJson = copyAttachments ? null : attachmentKeysJson
                };
                _db.Announcements.Add(newAnn);
                await _db.SaveChangesAsync(ct);

                var prefix = BuildTimestampPrefix(newAnn, target.Classroom);
                var items = new List<object>();
                string? firstKey = null;

                if (copyAttachments)
                {
                    foreach (var f in sourceFiles)
                    {
                        var (key, size) = await _storage.CopyAsync(f.key, prefix, f.name, ct);
                        if (string.IsNullOrWhiteSpace(key)) continue;
                        items.Add(new { key, size, name = f.name, url = _storage.GetTemporaryUrl(key) });
                        firstKey ??= key;
                    }
                }
                else
                {
                    foreach (var f in sourceFiles)
                    {
                        items.Add(new { key = f.key, size = 0L, name = f.name, url = _storage.GetTemporaryUrl(f.key) });
                    }
                }

                if (sourceLinks.Count > 0)
                {
                    var json = JsonSerializer.Serialize(sourceLinks);
                    await _storage.UploadTextAsync($"{prefix}/links.json", json, "application/json", ct);
                    items.AddRange(sourceLinks.Select((u, idx) => new { key = $"link-{idx}", size = 0L, url = u ?? string.Empty, name = u ?? string.Empty }));
                }

                if (copyAttachments && firstKey != null)
                {
                    newAnn.FileKey = firstKey;
                    newAnn.ContentType = ann.ContentType;
                    await _db.SaveChangesAsync(ct);
                }

                var createdAt = DateTime.SpecifyKind(newAnn.CreatedAt, DateTimeKind.Utc);
                var payload = new
                {
                    id = newAnn.Id,
                    classroomId = newAnn.ClassroomId,
                    content = newAnn.Content,
                    fileKey = newAnn.FileKey,
                    contentType = newAnn.ContentType,
                    isForAll = newAnn.IsForAll,
                    targetUserIds = ParseTargets(newAnn.TargetUserIdsJson),
                    createdAt,
                    createdBy = _me.UserId,
                    createdByName = creator?.FullName ?? "",
                    createdByAvatar = creator?.Avatar,
                    materials = items,
                    attachments = items
                };

                await _hub.Clients.Group(newAnn.ClassroomId.ToString()).SendAsync("AnnouncementAdded", payload);
                await _activityStream.PublishAsync(new ActivityEvent("announcement",
                    creator?.FullName ?? "Giáo viên",
                    "tạo thông báo mới",
                    target.Classroom?.Name,
                    DateTime.UtcNow));

                var recipients = await ResolveAnnouncementRecipients(newAnn.ClassroomId, newAnn.IsForAll, newAnn.TargetUserIdsJson);
                if (recipients.Any())
                {
                    var preview = newAnn.Content.Length > 120 ? newAnn.Content[..120] + "..." : newAnn.Content;
                    try
                    {
                        await _dispatcher.DispatchAsync(recipients, "Thông báo mới", preview, "announcement", newAnn.ClassroomId);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"⚠️ Dispatch announcement notification failed: {ex.Message}");
                    }
                }

                created.Add(payload);
            }

            return Ok(new { created, skipped });
        }

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

            var announcements = await q
                .Include(a => a.Classroom)
                .Include(a => a.User)
                .OrderByDescending(a => a.CreatedAt)
                .Skip(skip)
                .Take(take)
                .ToListAsync();

            var results = new List<object>();
            foreach (var a in announcements)
            {
                var materials = await ListMaterialsInternal(a, a.Classroom);
                var firstMat = materials.FirstOrDefault();
                results.Add(new
                {
                    id = a.Id,
                    classroomId = a.ClassroomId,
                    content = a.Content,
                    fileKey = a.FileKey ?? (firstMat?.GetType().GetProperty("key")?.GetValue(firstMat)?.ToString()),
                    contentType = a.ContentType,
                    isForAll = a.IsForAll,
                    targetUserIds = ParseTargets(a.TargetUserIdsJson),
                    createdAt = DateTime.SpecifyKind(a.CreatedAt, DateTimeKind.Utc),
                    createdBy = a.UserId,
                    createdByName = a.User != null ? a.User.FullName : "",
                    createdByAvatar = a.User != null ? a.User.Avatar : null,
                    materials,
                    attachments = materials 
                });
            }

            return Ok(results);
        }


        [HttpPost("{id:guid}/materials")]
        public async Task<IActionResult> UploadMaterials(Guid id, [FromForm] IFormFileCollection files, [FromForm] string? links, CancellationToken ct)
        {
            var ann = await _db.Announcements.Include(a => a.Classroom).FirstOrDefaultAsync(x => x.Id == id, ct);
            if (ann == null) return NotFound();
            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == ann.ClassroomId && e.UserId == _me.UserId, ct);
            if (member == null || !string.Equals(member.Role, "Teacher", StringComparison.OrdinalIgnoreCase)) return Forbid();

            var classroom = ann.Classroom ?? await _db.Classrooms.FirstOrDefaultAsync(c => c.Id == ann.ClassroomId, ct);
            if (classroom == null) return NotFound("Classroom not found");

            var prefix = ResolveUploadPrefix(ann, classroom);
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

        [HttpGet("{id:guid}/materials")]
        public async Task<IActionResult> ListMaterials(Guid id, CancellationToken ct)
        {
            var ann = await _db.Announcements.Include(a => a.Classroom).FirstOrDefaultAsync(x => x.Id == id, ct);
            if (ann == null) return NotFound();
            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == ann.ClassroomId && e.UserId == _me.UserId, ct);
            if (member == null) return Forbid();

            var classroom = ann.Classroom ?? await _db.Classrooms.FirstOrDefaultAsync(c => c.Id == ann.ClassroomId, ct);
            if (classroom == null) return NotFound("Classroom not found");

            var items = await ListMaterialsInternal(ann, classroom, ct);
            if (items.Count == 0 && !string.IsNullOrWhiteSpace(ann.FileKey))
            {
                items.Add(new
                {
                    key = ann.FileKey!,
                    size = 0L,
                    url = _storage.GetTemporaryUrl(ann.FileKey!),
                    name = System.IO.Path.GetFileName(ann.FileKey!)
                });
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

        private static string? GetMaterialValue(object item, string propName)
        {
            return item.GetType().GetProperty(propName)?.GetValue(item)?.ToString();
        }

        private static (List<(string key, string name)> files, List<string> links) ExtractMaterials(List<object> materials)
        {
            var files = new List<(string key, string name)>();
            var links = new List<string>();
            var fileKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var linkSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var item in materials)
            {
                var key = GetMaterialValue(item, "key");
                var name = GetMaterialValue(item, "name");
                var url = GetMaterialValue(item, "url");
                if (!string.IsNullOrWhiteSpace(key) && key.StartsWith("link-", StringComparison.OrdinalIgnoreCase))
                {
                    if (!string.IsNullOrWhiteSpace(url) && linkSet.Add(url))
                    {
                        links.Add(url);
                    }
                    continue;
                }
                if (!string.IsNullOrWhiteSpace(key) && fileKeys.Add(key))
                {
                    var resolvedName = !string.IsNullOrWhiteSpace(name) ? name : Path.GetFileName(key);
                    files.Add((key, resolvedName));
                }
            }

            return (files, links);
        }

        private static string BuildIdPrefix(Classroom classroom, Guid announcementId, int maxChars = 8)
        {
            var classSlug = Slugify(classroom.Name);
            var classShort = classroom.Id.ToString();
            if (classShort.Length > maxChars) classShort = classShort[..maxChars];
            return $"announcements/{classSlug}-{classShort}/{announcementId}";
        }

        private static string BuildIdPrefix6(Classroom classroom, Guid announcementId)
            => BuildIdPrefix(classroom, announcementId, 6);

        private static string BuildTimestampPrefix(Announcement ann, Classroom classroom)
        {
            var classSlug = Slugify(classroom.Name);
            var classShort = classroom.Id.ToString();
            if (classShort.Length > 8) classShort = classShort[..8];
            var annShort = ann.Id.ToString();
            if (annShort.Length > 8) annShort = annShort[..8];
            var created = DateTime.SpecifyKind(ann.CreatedAt, DateTimeKind.Utc);
            return $"announcements/{classSlug}-{classShort}/{created:yyyyMMdd-HHmmss}-{annShort}";
        }

        private static string? ExtractPrefixFromFileKey(string? key)
        {
            if (string.IsNullOrWhiteSpace(key)) return null;
            var normalized = key.Replace('\\', '/');
            var idx = normalized.LastIndexOf('/');
            if (idx <= 0) return null;
            return normalized[..idx];
        }

        private static string ResolveUploadPrefix(Announcement ann, Classroom classroom)
        {
            var existing = ExtractPrefixFromFileKey(ann.FileKey);
            if (!string.IsNullOrWhiteSpace(existing)) return existing!;
            return BuildTimestampPrefix(ann, classroom);
        }

        private async Task LoadMaterialsFromPrefix(List<object> items, string prefix, CancellationToken ct)
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
                    var arr = System.Text.Json.JsonSerializer.Deserialize<List<string>>(linkJson) ?? new List<string>();
                    var linkItems = arr.Select((u, idx) => new { key = $"link-{idx}", size = 0L, url = u ?? string.Empty, name = u ?? string.Empty });
                    items.AddRange(linkItems);
                }
                catch { }
            }
        }

        private void AppendAttachmentKeys(List<object> items, string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return;
            List<string>? keys = null;
            try { keys = JsonSerializer.Deserialize<List<string>>(json); } catch { }
            if (keys == null || keys.Count == 0) return;

            var existing = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var item in items)
            {
                var key = GetMaterialValue(item, "key");
                if (!string.IsNullOrWhiteSpace(key)) existing.Add(key);
            }

            foreach (var key in keys)
            {
                if (string.IsNullOrWhiteSpace(key) || !existing.Add(key)) continue;
                items.Add(new { key, size = 0L, url = _storage.GetTemporaryUrl(key), name = Path.GetFileName(key) });
            }
        }

        private async Task<List<object>> ListMaterialsInternal(Announcement ann, Classroom classroom, CancellationToken ct = default)
        {
            var items = new List<object>();

            var timestampPrefix = BuildTimestampPrefix(ann, classroom);
            await LoadMaterialsFromPrefix(items, timestampPrefix, ct);

            var idPrefix = BuildIdPrefix(classroom, ann.Id);
            if (!timestampPrefix.Equals(idPrefix, StringComparison.OrdinalIgnoreCase))
            {
                await LoadMaterialsFromPrefix(items, idPrefix, ct);
            }

            var idPrefix6 = BuildIdPrefix6(classroom, ann.Id);
            if (!idPrefix6.Equals(idPrefix, StringComparison.OrdinalIgnoreCase) &&
                !idPrefix6.Equals(timestampPrefix, StringComparison.OrdinalIgnoreCase))
            {
                await LoadMaterialsFromPrefix(items, idPrefix6, ct);
            }

            AppendAttachmentKeys(items, ann.AttachmentKeysJson);

            return items;
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
