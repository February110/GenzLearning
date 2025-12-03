using class_api.Infrastructure.Data;
using class_api.Domain;
using class_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using class_api.Hubs;
using Microsoft.EntityFrameworkCore;

namespace class_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CommentsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUser _me;
        private readonly IHubContext<ClassroomHub> _hub;

        public CommentsController(ApplicationDbContext db, ICurrentUser me, IHubContext<ClassroomHub> hub)
        {
            _db = db; _me = me; _hub = hub;
        }

        [HttpGet("assignment/{assignmentId:guid}")]
        public async Task<IActionResult> List(Guid assignmentId, int skip = 0, int take = 50, Guid? studentId = null)
        {
            var a = await _db.Assignments.FirstOrDefaultAsync(x => x.Id == assignmentId);
            if (a == null) return NotFound();
            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == a.ClassroomId && e.UserId == _me.UserId);
            if (member == null) return Forbid();
            var isTeacher = string.Equals(member.Role, "Teacher", StringComparison.OrdinalIgnoreCase);

            var q = _db.Comments
                .Include(c => c.User)
                .Where(c => c.AssignmentId == assignmentId);

            if (isTeacher)
            {
                if (studentId.HasValue)
                {
                    q = q.Where(c => c.TargetUserId == studentId.Value);
                }
            }
            else
            {
                var classroomTeacherId = await _db.Assignments
                    .Where(a2 => a2.Id == assignmentId)
                    .Join(_db.Classrooms, a2 => a2.ClassroomId, cls => cls.Id, (a2, cls) => cls.TeacherId)
                    .FirstOrDefaultAsync();

                q = q.Where(c =>
                    c.TargetUserId == _me.UserId ||
                    (c.TargetUserId == null && (c.UserId == _me.UserId || c.UserId == classroomTeacherId))
                );
            }

            var list = await q
                .OrderByDescending(c => c.CreatedAt)
                .Skip(skip).Take(take)
                .Select(c => new { c.Id, c.AssignmentId, c.UserId, userName = c.User!.FullName, c.Content, CreatedAt = DateTime.SpecifyKind(c.CreatedAt, DateTimeKind.Utc), targetUserId = c.TargetUserId })
                .ToListAsync();
            return Ok(list);
        }

        public record CreateCommentDto(Guid AssignmentId, string Content, Guid? StudentId);

        [HttpPost]
        public async Task<IActionResult> Create(CreateCommentDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Content)) return BadRequest("Empty content");
            var a = await _db.Assignments.FirstOrDefaultAsync(x => x.Id == dto.AssignmentId);
            if (a == null) return NotFound();
            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == a.ClassroomId && e.UserId == _me.UserId);
            if (member == null) return Forbid();
            var isTeacher = string.Equals(member.Role, "Teacher", StringComparison.OrdinalIgnoreCase);
            Guid? target = dto.StudentId;
            if (isTeacher)
            {
                if (!target.HasValue) return BadRequest("StudentId is required");
            }
            else
            {
                target = _me.UserId;
            }

            var c = new Comment { AssignmentId = dto.AssignmentId, UserId = _me.UserId, Content = dto.Content.Trim(), TargetUserId = target };
            _db.Comments.Add(c);
            await _db.SaveChangesAsync();

            var payload = new { c.Id, c.AssignmentId, c.UserId, userName = (await _db.Users.FindAsync(_me.UserId))?.FullName ?? "", c.Content, CreatedAt = DateTime.SpecifyKind(c.CreatedAt, DateTimeKind.Utc), targetUserId = c.TargetUserId };
            var aid = dto.AssignmentId.ToString().ToLowerInvariant();
            var sid = (c.TargetUserId ?? Guid.Empty).ToString().ToLowerInvariant();
            var threadGroup = $"{aid}:{sid}";
            await _hub.Clients.Group(threadGroup).SendAsync("CommentAdded", payload);
            return Ok(payload);
        }
    }
}
