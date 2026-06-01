using class_api.Application.Interfaces;
using class_api.Domain;
using class_api.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace class_api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/classrooms/{classroomId:guid}/lectures")]
    public class ClassroomLecturesController : ControllerBase
    {
        private static readonly HashSet<string> AllowedVideoExts = new(StringComparer.OrdinalIgnoreCase)
        {
            ".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v", ".wmv"
        };

        private readonly ApplicationDbContext _db;
        private readonly ICurrentUser _me;
        private readonly IStorage _storage;

        public ClassroomLecturesController(ApplicationDbContext db, ICurrentUser me, IStorage storage)
        {
            _db = db;
            _me = me;
            _storage = storage;
        }

        [HttpGet("tree")]
        public async Task<IActionResult> GetTree(Guid classroomId, CancellationToken ct)
        {
            var membership = await GetMembership(classroomId, ct);
            if (membership == null) return Forbid();

            var sections = await _db.LectureSections
                .AsNoTracking()
                .Include(s => s.Lessons)
                .Where(s => s.ClassroomId == classroomId)
                .ToListAsync(ct);

            var payload = sections
                .OrderBy(s => s.OrderIndex)
                .ThenBy(s => s.CreatedAt)
                .Select(s => new
                {
                    s.Id,
                    s.Title,
                    s.OrderIndex,
                    lessonCount = s.Lessons.Count,
                    lessons = s.Lessons
                        .OrderBy(l => l.OrderIndex)
                        .ThenBy(l => l.CreatedAt)
                        .Select(l => new
                        {
                            l.Id,
                            l.Title,
                            l.Description,
                            l.OrderIndex,
                            l.VideoKey,
                            l.VideoName,
                            l.VideoSizeBytes,
                            l.DurationSeconds,
                            l.CreatedAt,
                            l.UpdatedAt
                        })
                });

            return Ok(payload);
        }

        [HttpPost("sections")]
        public async Task<IActionResult> CreateSection(Guid classroomId, [FromBody] CreateSectionDto dto, CancellationToken ct)
        {
            var membership = await GetMembership(classroomId, ct);
            if (!IsTeacher(membership)) return Forbid();

            var title = dto.Title?.Trim();
            if (string.IsNullOrWhiteSpace(title))
                return BadRequest(new { message = "Tiêu đề chương không hợp lệ." });

            var maxOrder = await _db.LectureSections
                .Where(s => s.ClassroomId == classroomId)
                .Select(s => (int?)s.OrderIndex)
                .MaxAsync(ct) ?? 0;

            var section = new LectureSection
            {
                ClassroomId = classroomId,
                Title = title,
                OrderIndex = maxOrder + 1,
                CreatedBy = _me.UserId
            };

            _db.LectureSections.Add(section);
            await _db.SaveChangesAsync(ct);

            if (dto.OrderIndex.HasValue)
            {
                await ReorderSections(classroomId, section.Id, dto.OrderIndex.Value, ct);
                section = await _db.LectureSections.AsNoTracking().FirstAsync(s => s.Id == section.Id, ct);
            }

            return Ok(new
            {
                section.Id,
                section.Title,
                section.OrderIndex,
                lessonCount = 0
            });
        }

        [HttpPatch("sections/{sectionId:guid}")]
        public async Task<IActionResult> UpdateSection(
            Guid classroomId,
            Guid sectionId,
            [FromBody] UpdateSectionDto dto,
            CancellationToken ct)
        {
            var membership = await GetMembership(classroomId, ct);
            if (!IsTeacher(membership)) return Forbid();

            var section = await _db.LectureSections
                .FirstOrDefaultAsync(s => s.Id == sectionId && s.ClassroomId == classroomId, ct);
            if (section == null) return NotFound(new { message = "Không tìm thấy chương." });

            if (!string.IsNullOrWhiteSpace(dto.Title))
                section.Title = dto.Title.Trim();
            section.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            if (dto.OrderIndex.HasValue)
                await ReorderSections(classroomId, sectionId, dto.OrderIndex.Value, ct);

            return Ok(new { message = "Đã cập nhật chương." });
        }

        [HttpDelete("sections/{sectionId:guid}")]
        public async Task<IActionResult> DeleteSection(Guid classroomId, Guid sectionId, CancellationToken ct)
        {
            var membership = await GetMembership(classroomId, ct);
            if (!IsTeacher(membership)) return Forbid();

            var section = await _db.LectureSections
                .Include(s => s.Lessons)
                .FirstOrDefaultAsync(s => s.Id == sectionId && s.ClassroomId == classroomId, ct);
            if (section == null) return NotFound(new { message = "Không tìm thấy chương." });

            foreach (var lesson in section.Lessons)
            {
                if (!string.IsNullOrWhiteSpace(lesson.VideoKey))
                    await _storage.DeleteAsync(lesson.VideoKey, ct);
            }

            _db.LectureSections.Remove(section);
            await _db.SaveChangesAsync(ct);
            await CompactSectionOrders(classroomId, ct);

            return Ok(new { message = "Đã xóa chương." });
        }

        [HttpPost("sections/{sectionId:guid}/lessons")]
        public async Task<IActionResult> CreateLesson(
            Guid classroomId,
            Guid sectionId,
            [FromBody] CreateLessonDto dto,
            CancellationToken ct)
        {
            var membership = await GetMembership(classroomId, ct);
            if (!IsTeacher(membership)) return Forbid();

            var section = await _db.LectureSections
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == sectionId && s.ClassroomId == classroomId, ct);
            if (section == null) return NotFound(new { message = "Không tìm thấy chương." });

            var title = dto.Title?.Trim();
            if (string.IsNullOrWhiteSpace(title))
                return BadRequest(new { message = "Tiêu đề bài học không hợp lệ." });

            var maxOrder = await _db.LectureLessons
                .Where(l => l.SectionId == sectionId)
                .Select(l => (int?)l.OrderIndex)
                .MaxAsync(ct) ?? 0;

            var lesson = new LectureLesson
            {
                SectionId = sectionId,
                Title = title,
                Description = dto.Description?.Trim(),
                DurationSeconds = dto.DurationSeconds,
                OrderIndex = maxOrder + 1,
                CreatedBy = _me.UserId
            };

            _db.LectureLessons.Add(lesson);
            await _db.SaveChangesAsync(ct);

            if (dto.OrderIndex.HasValue)
            {
                await ReorderLessons(sectionId, lesson.Id, dto.OrderIndex.Value, ct);
                lesson = await _db.LectureLessons.AsNoTracking().FirstAsync(l => l.Id == lesson.Id, ct);
            }

            return Ok(new
            {
                lesson.Id,
                lesson.Title,
                lesson.Description,
                lesson.OrderIndex,
                lesson.DurationSeconds
            });
        }

        [HttpPatch("lessons/{lessonId:guid}")]
        public async Task<IActionResult> UpdateLesson(
            Guid classroomId,
            Guid lessonId,
            [FromBody] UpdateLessonDto dto,
            CancellationToken ct)
        {
            var membership = await GetMembership(classroomId, ct);
            if (!IsTeacher(membership)) return Forbid();

            var lesson = await _db.LectureLessons
                .Include(l => l.Section)
                .FirstOrDefaultAsync(l => l.Id == lessonId && l.Section!.ClassroomId == classroomId, ct);
            if (lesson == null) return NotFound(new { message = "Không tìm thấy bài học." });

            if (!string.IsNullOrWhiteSpace(dto.Title))
                lesson.Title = dto.Title.Trim();
            if (dto.Description != null)
                lesson.Description = dto.Description.Trim();
            if (dto.DurationSeconds.HasValue)
                lesson.DurationSeconds = dto.DurationSeconds.Value <= 0 ? null : dto.DurationSeconds.Value;

            lesson.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            if (dto.OrderIndex.HasValue)
                await ReorderLessons(lesson.SectionId, lessonId, dto.OrderIndex.Value, ct);

            return Ok(new { message = "Đã cập nhật bài học." });
        }

        [HttpDelete("lessons/{lessonId:guid}")]
        public async Task<IActionResult> DeleteLesson(Guid classroomId, Guid lessonId, CancellationToken ct)
        {
            var membership = await GetMembership(classroomId, ct);
            if (!IsTeacher(membership)) return Forbid();

            var lesson = await _db.LectureLessons
                .Include(l => l.Section)
                .FirstOrDefaultAsync(l => l.Id == lessonId && l.Section!.ClassroomId == classroomId, ct);
            if (lesson == null) return NotFound(new { message = "Không tìm thấy bài học." });

            if (!string.IsNullOrWhiteSpace(lesson.VideoKey))
                await _storage.DeleteAsync(lesson.VideoKey, ct);

            var sectionId = lesson.SectionId;
            _db.LectureLessons.Remove(lesson);
            await _db.SaveChangesAsync(ct);
            await CompactLessonOrders(sectionId, ct);

            return Ok(new { message = "Đã xóa bài học." });
        }

        [HttpPost("lessons/{lessonId:guid}/video")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadLessonVideo(
            Guid classroomId,
            Guid lessonId,
            IFormFile file,
            CancellationToken ct)
        {
            var membership = await GetMembership(classroomId, ct);
            if (!IsTeacher(membership)) return Forbid();

            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Video không hợp lệ." });
            if (!IsVideoFile(file))
                return BadRequest(new { message = "Chỉ cho phép upload file video." });

            var lesson = await _db.LectureLessons
                .Include(l => l.Section)
                .ThenInclude(s => s.Classroom)
                .FirstOrDefaultAsync(l => l.Id == lessonId && l.Section!.ClassroomId == classroomId, ct);
            if (lesson == null) return NotFound(new { message = "Không tìm thấy bài học." });

            var classroom = lesson.Section?.Classroom
                ?? await _db.Classrooms.AsNoTracking().FirstOrDefaultAsync(c => c.Id == classroomId, ct);
            if (classroom == null) return NotFound(new { message = "Không tìm thấy lớp học." });

            var oldKey = lesson.VideoKey;
            var prefix = BuildVideoPrefix(
                classroom,
                lesson.SectionId,
                lesson.Section?.Title,
                lesson.Id,
                lesson.Title);

            await using var stream = file.OpenReadStream();
            var (key, sizeBytes) = await _storage.UploadAsync(
                stream,
                file.ContentType ?? "application/octet-stream",
                prefix,
                file.FileName,
                ct);

            lesson.VideoKey = key;
            lesson.VideoName = file.FileName;
            lesson.VideoSizeBytes = sizeBytes;
            lesson.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            if (!string.IsNullOrWhiteSpace(oldKey) && !string.Equals(oldKey, key, StringComparison.OrdinalIgnoreCase))
                await _storage.DeleteAsync(oldKey, ct);

            return Ok(new
            {
                message = "Đã tải video lên.",
                lessonId = lesson.Id,
                lesson.VideoKey,
                lesson.VideoName,
                lesson.VideoSizeBytes
            });
        }

        [HttpDelete("lessons/{lessonId:guid}/video")]
        public async Task<IActionResult> DeleteLessonVideo(Guid classroomId, Guid lessonId, CancellationToken ct)
        {
            var membership = await GetMembership(classroomId, ct);
            if (!IsTeacher(membership)) return Forbid();

            var lesson = await _db.LectureLessons
                .Include(l => l.Section)
                .FirstOrDefaultAsync(l => l.Id == lessonId && l.Section!.ClassroomId == classroomId, ct);
            if (lesson == null) return NotFound(new { message = "Không tìm thấy bài học." });

            if (!string.IsNullOrWhiteSpace(lesson.VideoKey))
                await _storage.DeleteAsync(lesson.VideoKey, ct);

            lesson.VideoKey = null;
            lesson.VideoName = null;
            lesson.VideoSizeBytes = null;
            lesson.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            return Ok(new { message = "Đã xóa video khỏi bài học." });
        }

        private Task<Enrollment?> GetMembership(Guid classroomId, CancellationToken ct)
        {
            return _db.Enrollments
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.ClassroomId == classroomId && e.UserId == _me.UserId, ct);
        }

        private static bool IsTeacher(Enrollment? member)
        {
            return member != null && string.Equals(member.Role, "Teacher", StringComparison.OrdinalIgnoreCase);
        }

        private async Task ReorderSections(Guid classroomId, Guid sectionId, int desiredOrder, CancellationToken ct)
        {
            var list = await _db.LectureSections
                .Where(s => s.ClassroomId == classroomId)
                .OrderBy(s => s.OrderIndex)
                .ThenBy(s => s.CreatedAt)
                .ToListAsync(ct);

            var target = list.FirstOrDefault(s => s.Id == sectionId);
            if (target == null) return;

            list.Remove(target);
            var index = Math.Clamp(desiredOrder - 1, 0, list.Count);
            list.Insert(index, target);
            await ApplySectionOrdering(list, ct);
        }

        private async Task ReorderLessons(Guid sectionId, Guid lessonId, int desiredOrder, CancellationToken ct)
        {
            var list = await _db.LectureLessons
                .Where(l => l.SectionId == sectionId)
                .OrderBy(l => l.OrderIndex)
                .ThenBy(l => l.CreatedAt)
                .ToListAsync(ct);

            var target = list.FirstOrDefault(l => l.Id == lessonId);
            if (target == null) return;

            list.Remove(target);
            var index = Math.Clamp(desiredOrder - 1, 0, list.Count);
            list.Insert(index, target);
            await ApplyLessonOrdering(list, ct);
        }

        private async Task CompactSectionOrders(Guid classroomId, CancellationToken ct)
        {
            var list = await _db.LectureSections
                .Where(s => s.ClassroomId == classroomId)
                .OrderBy(s => s.OrderIndex)
                .ThenBy(s => s.CreatedAt)
                .ToListAsync(ct);

            var changed = false;
            for (var i = 0; i < list.Count; i++)
            {
                var expected = i + 1;
                if (list[i].OrderIndex == expected) continue;
                changed = true;
            }

            if (changed) await ApplySectionOrdering(list, ct);
        }

        private async Task CompactLessonOrders(Guid sectionId, CancellationToken ct)
        {
            var list = await _db.LectureLessons
                .Where(l => l.SectionId == sectionId)
                .OrderBy(l => l.OrderIndex)
                .ThenBy(l => l.CreatedAt)
                .ToListAsync(ct);

            var changed = false;
            for (var i = 0; i < list.Count; i++)
            {
                var expected = i + 1;
                if (list[i].OrderIndex == expected) continue;
                changed = true;
            }

            if (changed) await ApplyLessonOrdering(list, ct);
        }

        private async Task ApplySectionOrdering(List<LectureSection> list, CancellationToken ct)
        {
            var now = DateTime.UtcNow;

            // Use a temporary negative ordering first to avoid unique-index collisions during swaps.
            for (var i = 0; i < list.Count; i++)
            {
                list[i].OrderIndex = -(i + 1);
                list[i].UpdatedAt = now;
            }
            await _db.SaveChangesAsync(ct);

            for (var i = 0; i < list.Count; i++)
            {
                list[i].OrderIndex = i + 1;
                list[i].UpdatedAt = now;
            }
            await _db.SaveChangesAsync(ct);
        }

        private async Task ApplyLessonOrdering(List<LectureLesson> list, CancellationToken ct)
        {
            var now = DateTime.UtcNow;

            // Use a temporary negative ordering first to avoid unique-index collisions during swaps.
            for (var i = 0; i < list.Count; i++)
            {
                list[i].OrderIndex = -(i + 1);
                list[i].UpdatedAt = now;
            }
            await _db.SaveChangesAsync(ct);

            for (var i = 0; i < list.Count; i++)
            {
                list[i].OrderIndex = i + 1;
                list[i].UpdatedAt = now;
            }
            await _db.SaveChangesAsync(ct);
        }

        private static string BuildVideoPrefix(
            Classroom classroom,
            Guid sectionId,
            string? sectionTitle,
            Guid lessonId,
            string? lessonTitle)
        {
            var classSlug = Slugify(classroom.Name);
            var classShort = classroom.Id.ToString();
            if (classShort.Length > 8) classShort = classShort[..8];
            var sectionSlug = Slugify(sectionTitle);
            var lessonSlug = Slugify(lessonTitle);
            var sectionShort = sectionId.ToString();
            if (sectionShort.Length > 8) sectionShort = sectionShort[..8];
            var lessonShort = lessonId.ToString();
            if (lessonShort.Length > 8) lessonShort = lessonShort[..8];
            return $"lectures/{classSlug}-{classShort}/section-{sectionSlug}-{sectionShort}/lesson-{lessonSlug}-{lessonShort}";
        }

        private static string Slugify(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return "class";
            var cleaned = new string(input.Trim().Select(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_' ? ch : '-').ToArray());
            while (cleaned.Contains("--")) cleaned = cleaned.Replace("--", "-");
            return cleaned.Trim('-').ToLowerInvariant();
        }

        private static bool IsVideoFile(IFormFile file)
        {
            var ext = Path.GetExtension(file.FileName);
            if (!string.IsNullOrWhiteSpace(ext) && AllowedVideoExts.Contains(ext))
                return true;

            var contentType = (file.ContentType ?? string.Empty).Trim().ToLowerInvariant();
            return contentType.StartsWith("video/", StringComparison.Ordinal);
        }

        public class CreateSectionDto
        {
            public string Title { get; set; } = default!;
            public int? OrderIndex { get; set; }
        }

        public class UpdateSectionDto
        {
            public string? Title { get; set; }
            public int? OrderIndex { get; set; }
        }

        public class CreateLessonDto
        {
            public string Title { get; set; } = default!;
            public string? Description { get; set; }
            public int? DurationSeconds { get; set; }
            public int? OrderIndex { get; set; }
        }

        public class UpdateLessonDto
        {
            public string? Title { get; set; }
            public string? Description { get; set; }
            public int? DurationSeconds { get; set; }
            public int? OrderIndex { get; set; }
        }
    }
}
