using class_api.Application.Dtos;
using class_api.Domain;
using class_api.Infrastructure.Data;
using class_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace class_api.Controllers
{
    [ApiController]
    [Route("api/classrooms/{classroomId:guid}/groups")]
    [Authorize]
    public class ClassroomGroupsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUser _me;

        public ClassroomGroupsController(ApplicationDbContext db, ICurrentUser me)
        {
            _db = db;
            _me = me;
        }

        private async Task<(Classroom classroom, Enrollment? member, bool isTeacher)?> LoadMember(Guid classroomId, CancellationToken ct)
        {
            var classroom = await _db.Classrooms.FirstOrDefaultAsync(c => c.Id == classroomId, ct);
            if (classroom == null) return null;
            var member = await _db.Enrollments.Include(e => e.User)
                .FirstOrDefaultAsync(e => e.ClassroomId == classroomId && e.UserId == _me.UserId, ct);
            var isTeacher = member != null && string.Equals(member.Role, "Teacher", StringComparison.OrdinalIgnoreCase);
            return (classroom, member, isTeacher);
        }

        private static object MapGroup(ClassroomGroup group)
        {
            var leaderMember = group.Members.FirstOrDefault(m => m.UserId == group.LeaderId) ??
                               group.Members.FirstOrDefault(m => string.Equals(m.Role, "Leader", StringComparison.OrdinalIgnoreCase));
            return new
            {
                group.Id,
                group.Name,
                group.ClassroomId,
                group.LeaderId,
                LeaderName = leaderMember?.User?.FullName,
                CreatedAt = DateTime.SpecifyKind(group.CreatedAt, DateTimeKind.Utc),
                UpdatedAt = DateTime.SpecifyKind(group.UpdatedAt, DateTimeKind.Utc),
                Members = group.Members
                    .OrderByDescending(m => string.Equals(m.Role, "Leader", StringComparison.OrdinalIgnoreCase))
                    .ThenBy(m => m.User!.FullName)
                    .Select(m => new
                    {
                        m.UserId,
                        FullName = m.User!.FullName,
                        Email = m.User!.Email,
                        Avatar = m.User!.Avatar,
                        m.Role,
                        JoinedAt = DateTime.SpecifyKind(m.JoinedAt, DateTimeKind.Utc)
                    })
            };
        }

        [HttpGet]
        public async Task<IActionResult> List(Guid classroomId, CancellationToken ct)
        {
            var memberInfo = await LoadMember(classroomId, ct);
            if (memberInfo == null) return NotFound();
            if (memberInfo.Value.member == null) return Forbid();

            var groups = await _db.ClassroomGroups
                .Include(g => g.Members)
                .ThenInclude(m => m.User)
                .Where(g => g.ClassroomId == classroomId)
                .OrderBy(g => g.CreatedAt)
                .ToListAsync(ct);

            return Ok(groups.Select(MapGroup));
        }

        [HttpPost]
        public async Task<IActionResult> Create(Guid classroomId, [FromBody] CreateClassroomGroupDto dto, CancellationToken ct)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "Vui lòng nhập tên nhóm." });

            var memberInfo = await LoadMember(classroomId, ct);
            if (memberInfo == null) return NotFound();
            if (!memberInfo.Value.isTeacher) return Forbid();

            var memberIds = new HashSet<Guid>((dto.MemberIds ?? new List<Guid>()).Where(id => id != Guid.Empty));
            if (dto.LeaderId.HasValue && dto.LeaderId.Value != Guid.Empty)
            {
                memberIds.Add(dto.LeaderId.Value);
            }

            if (memberIds.Count == 0)
                return BadRequest(new { message = "Chưa chọn thành viên." });

            var leaderId = dto.LeaderId.HasValue && dto.LeaderId.Value != Guid.Empty
                ? dto.LeaderId.Value
                : memberIds.First();

            if (!memberIds.Contains(leaderId))
                return BadRequest(new { message = "Trưởng nhóm phải thuộc danh sách thành viên." });

            var enrolled = await _db.Enrollments
                .Include(e => e.User)
                .Where(e => e.ClassroomId == classroomId && memberIds.Contains(e.UserId) && e.Role == "Student")
                .ToListAsync(ct);

            if (enrolled.Count != memberIds.Count)
                return BadRequest(new { message = "Danh sách thành viên không hợp lệ." });

            var existing = await _db.ClassroomGroupMembers
                .Include(m => m.Group)
                .Where(m => m.Group != null && m.Group.ClassroomId == classroomId && memberIds.Contains(m.UserId))
                .Select(m => m.UserId)
                .Distinct()
                .ToListAsync(ct);
            if (existing.Count > 0)
                return Conflict(new { message = "Một số học viên đã có nhóm trong lớp." });

            var now = DateTime.UtcNow;
            var group = new ClassroomGroup
            {
                ClassroomId = classroomId,
                Name = dto.Name.Trim(),
                LeaderId = leaderId,
                CreatedAt = now,
                UpdatedAt = now
            };

            foreach (var memberId in memberIds)
            {
                var role = memberId == leaderId ? "Leader" : "Member";
                group.Members.Add(new ClassroomGroupMember
                {
                    GroupId = group.Id,
                    UserId = memberId,
                    Role = role,
                    JoinedAt = now
                });
            }

            _db.ClassroomGroups.Add(group);
            await _db.SaveChangesAsync(ct);

            var reloaded = await _db.ClassroomGroups
                .Include(g => g.Members)
                .ThenInclude(m => m.User)
                .FirstAsync(g => g.Id == group.Id, ct);

            return CreatedAtAction(nameof(List), new { classroomId }, MapGroup(reloaded));
        }

        [HttpDelete("{groupId:guid}")]
        public async Task<IActionResult> Delete(Guid classroomId, Guid groupId, CancellationToken ct)
        {
            var memberInfo = await LoadMember(classroomId, ct);
            if (memberInfo == null) return NotFound();
            if (!memberInfo.Value.isTeacher) return Forbid();

            var group = await _db.ClassroomGroups
                .FirstOrDefaultAsync(g => g.Id == groupId && g.ClassroomId == classroomId, ct);
            if (group == null) return NotFound(new { message = "Không tìm thấy nhóm." });

            _db.ClassroomGroups.Remove(group);
            await _db.SaveChangesAsync(ct);

            return Ok(new { message = "Đã xóa nhóm." });
        }
    }
}
