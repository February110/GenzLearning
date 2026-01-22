using class_api.Application.Dtos;
using class_api.Domain;
using class_api.Infrastructure.Data;
using class_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
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

        private static string ResolveClassGroupMode(Classroom classroom)
        {
            if (string.Equals(classroom.ClassGroupMode, "random", StringComparison.OrdinalIgnoreCase)) return "random";
            if (string.Equals(classroom.ClassGroupMode, "student", StringComparison.OrdinalIgnoreCase)) return "student";
            return "none";
        }

        private Task<bool> UserHasGroup(Guid classroomId, Guid userId, CancellationToken ct)
        {
            return _db.ClassroomGroupMembers
                .Where(m => m.UserId == userId)
                .Join(_db.ClassroomGroups,
                    m => m.GroupId,
                    g => g.Id,
                    (_, g) => g)
                .AnyAsync(g => g.ClassroomId == classroomId, ct);
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
                    .ThenBy(m => m.User?.FullName ?? string.Empty)
                    .Select(m => new
                    {
                        m.UserId,
                        FullName = m.User?.FullName ?? string.Empty,
                        Email = m.User?.Email ?? string.Empty,
                        Avatar = m.User?.Avatar,
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
            if (memberInfo.Value.member == null) return Forbid();

            var classroom = memberInfo.Value.classroom;
            var mode = ResolveClassGroupMode(classroom);
            var isTeacher = memberInfo.Value.isTeacher;
            if (mode == "none")
                return BadRequest(new { message = "Giáo viên chưa bật chia nhóm cho lớp này." });
            if (mode != "student")
                return BadRequest(new { message = "Lớp đang chọn chia nhóm ngẫu nhiên, không thể tạo nhóm thủ công." });
            if (!isTeacher && mode != "student")
                return Forbid();
            if (!isTeacher && !string.Equals(memberInfo.Value.member.Role, "Student", StringComparison.OrdinalIgnoreCase))
                return Forbid();

            var memberIds = new HashSet<Guid>((dto.MemberIds ?? new List<Guid>()).Where(id => id != Guid.Empty));
            var leaderId = dto.LeaderId;
            if (!isTeacher)
            {
                memberIds.Clear();
                memberIds.Add(_me.UserId);
                leaderId = _me.UserId;
            }

            if (memberIds.Count == 0)
                return BadRequest(new { message = "Chưa chọn thành viên." });

            var leaderValue = leaderId.HasValue && leaderId.Value != Guid.Empty
                ? leaderId.Value
                : memberIds.First();

            if (!memberIds.Contains(leaderValue))
                return BadRequest(new { message = "Trưởng nhóm phải thuộc danh sách thành viên." });

            var enrolled = await _db.Enrollments
                .Include(e => e.User)
                .Where(e => e.ClassroomId == classroomId && memberIds.Contains(e.UserId) && e.Role == "Student")
                .ToListAsync(ct);

            if (enrolled.Count != memberIds.Count)
                return BadRequest(new { message = "Danh sách thành viên không hợp lệ." });

            var hasGroup = await UserHasGroup(classroomId, _me.UserId, ct);
            if (!isTeacher && hasGroup)
                return Conflict(new { message = "Bạn đã có nhóm trong lớp." });

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
                LeaderId = leaderValue,
                CreatedAt = now,
                UpdatedAt = now
            };

            foreach (var memberId in memberIds)
            {
                var role = memberId == leaderValue ? "Leader" : "Member";
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

        [HttpPatch("{groupId:guid}")]
        public async Task<IActionResult> Update(Guid classroomId, Guid groupId, [FromBody] UpdateClassroomGroupDto dto, CancellationToken ct)
        {
            if (dto == null) return BadRequest(new { message = "Dữ liệu không hợp lệ." });
            var memberInfo = await LoadMember(classroomId, ct);
            if (memberInfo == null) return NotFound();
            if (!memberInfo.Value.isTeacher) return Forbid();

            var group = await _db.ClassroomGroups
                .Include(g => g.Members)
                .ThenInclude(m => m.User)
                .FirstOrDefaultAsync(g => g.Id == groupId && g.ClassroomId == classroomId, ct);
            if (group == null) return NotFound(new { message = "Không tìm thấy nhóm." });

            var changed = false;
            if (dto.Name != null)
            {
                var name = dto.Name.Trim();
                if (string.IsNullOrWhiteSpace(name))
                    return BadRequest(new { message = "Tên nhóm không hợp lệ." });
                if (!string.Equals(group.Name, name, StringComparison.Ordinal))
                {
                    group.Name = name;
                    changed = true;
                }
            }

            if (dto.LeaderId.HasValue && dto.LeaderId.Value != Guid.Empty)
            {
                var leaderId = dto.LeaderId.Value;
                var leaderMember = group.Members.FirstOrDefault(m => m.UserId == leaderId);
                if (leaderMember == null)
                    return BadRequest(new { message = "Trưởng nhóm phải là thành viên trong nhóm." });
                if (group.LeaderId != leaderId)
                {
                    group.LeaderId = leaderId;
                    foreach (var member in group.Members)
                    {
                        member.Role = member.UserId == leaderId ? "Leader" : "Member";
                    }
                    changed = true;
                }
            }

            if (changed)
            {
                group.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync(ct);
            }

            return Ok(MapGroup(group));
        }

        [HttpPost("{groupId:guid}/members")]
        public async Task<IActionResult> AddMember(Guid classroomId, Guid groupId, [FromBody] AddClassroomGroupMemberDto dto, CancellationToken ct)
        {
            if (dto == null || dto.UserId == Guid.Empty)
                return BadRequest(new { message = "Vui lòng chọn học viên." });

            var memberInfo = await LoadMember(classroomId, ct);
            if (memberInfo == null) return NotFound();
            if (!memberInfo.Value.isTeacher) return Forbid();

            var group = await _db.ClassroomGroups
                .Include(g => g.Members)
                .ThenInclude(m => m.User)
                .FirstOrDefaultAsync(g => g.Id == groupId && g.ClassroomId == classroomId, ct);
            if (group == null) return NotFound(new { message = "Không tìm thấy nhóm." });

            var enrolled = await _db.Enrollments
                .Include(e => e.User)
                .FirstOrDefaultAsync(e => e.ClassroomId == classroomId && e.UserId == dto.UserId, ct);
            if (enrolled == null || !string.Equals(enrolled.Role, "Student", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Học viên không hợp lệ." });

            if (await UserHasGroup(classroomId, dto.UserId, ct))
                return Conflict(new { message = "Học viên đã thuộc nhóm khác." });

            if (group.Members.Any(m => m.UserId == dto.UserId))
                return Conflict(new { message = "Học viên đã ở trong nhóm này." });

            group.Members.Add(new ClassroomGroupMember
            {
                GroupId = group.Id,
                UserId = dto.UserId,
                Role = "Member",
                JoinedAt = DateTime.UtcNow,
                User = enrolled.User
            });
            group.UpdatedAt = DateTime.UtcNow;

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(new { message = "Nhóm đã thay đổi. Vui lòng tải lại và thử lại." });
            }
            catch (DbUpdateException ex)
            {
                if (ex.InnerException is SqlException sqlEx)
                {
                    if (sqlEx.Number == 2601 || sqlEx.Number == 2627)
                        return Conflict(new { message = "Học viên đã ở trong nhóm." });
                    if (sqlEx.Number == 547)
                        return Conflict(new { message = "Không thể thêm học viên. Vui lòng kiểm tra dữ liệu." });
                    return Conflict(new { message = $"Không thể thêm học viên (SQL {sqlEx.Number})." });
                }
                var baseMessage = ex.GetBaseException().Message;
                return Conflict(new { message = $"Không thể thêm học viên ({baseMessage})." });
            }

            var reloaded = await _db.ClassroomGroups
                .Include(g => g.Members)
                .ThenInclude(m => m.User)
                .FirstOrDefaultAsync(g => g.Id == groupId && g.ClassroomId == classroomId, ct);
            if (reloaded == null) return NotFound(new { message = "Không tìm thấy nhóm." });

            return Ok(MapGroup(reloaded));
        }

        [HttpDelete("{groupId:guid}/members/{userId:guid}")]
        public async Task<IActionResult> RemoveMember(Guid classroomId, Guid groupId, Guid userId, CancellationToken ct)
        {
            var memberInfo = await LoadMember(classroomId, ct);
            if (memberInfo == null) return NotFound();
            if (!memberInfo.Value.isTeacher) return Forbid();

            var group = await _db.ClassroomGroups
                .Include(g => g.Members)
                .ThenInclude(m => m.User)
                .FirstOrDefaultAsync(g => g.Id == groupId && g.ClassroomId == classroomId, ct);
            if (group == null) return NotFound(new { message = "Không tìm thấy nhóm." });

            var member = group.Members.FirstOrDefault(m => m.UserId == userId);
            if (member == null) return NotFound(new { message = "Học viên không nằm trong nhóm." });

            var wasLeader = member.UserId == group.LeaderId;
            group.Members.Remove(member);
            _db.ClassroomGroupMembers.Remove(member);

            if (group.Members.Count == 0)
            {
                _db.ClassroomGroups.Remove(group);
                await _db.SaveChangesAsync(ct);
                return Ok(new { message = "Đã xóa nhóm." });
            }

            if (wasLeader)
            {
                var nextLeader = group.Members.OrderBy(m => m.JoinedAt).First();
                group.LeaderId = nextLeader.UserId;
                foreach (var m in group.Members)
                {
                    m.Role = m.UserId == group.LeaderId ? "Leader" : "Member";
                }
            }

            group.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            return Ok(MapGroup(group));
        }

        [HttpPost("{groupId:guid}/join")]
        public async Task<IActionResult> Join(Guid classroomId, Guid groupId, CancellationToken ct)
        {
            var memberInfo = await LoadMember(classroomId, ct);
            if (memberInfo == null) return NotFound();
            if (memberInfo.Value.member == null) return Forbid();
            if (!string.Equals(memberInfo.Value.member.Role, "Student", StringComparison.OrdinalIgnoreCase))
                return Forbid();

            var mode = ResolveClassGroupMode(memberInfo.Value.classroom);
            if (mode == "none") return BadRequest(new { message = "Giáo viên chưa bật chia nhóm cho lớp này." });
            if (mode != "student") return Forbid();

            if (await UserHasGroup(classroomId, _me.UserId, ct))
                return Conflict(new { message = "Bạn đã có nhóm trong lớp." });

            var groupExists = await _db.ClassroomGroups
                .AnyAsync(g => g.Id == groupId && g.ClassroomId == classroomId, ct);
            if (!groupExists) return NotFound(new { message = "Không tìm thấy nhóm." });

            var alreadyInGroup = await _db.ClassroomGroupMembers
                .AnyAsync(m => m.GroupId == groupId && m.UserId == _me.UserId, ct);
            if (alreadyInGroup)
                return Conflict(new { message = "Bạn đã ở trong nhóm này." });

            var now = DateTime.UtcNow;
            _db.ClassroomGroupMembers.Add(new ClassroomGroupMember
            {
                GroupId = groupId,
                UserId = _me.UserId,
                Role = "Member",
                JoinedAt = now
            });
            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(new { message = "Nhóm đã thay đổi. Vui lòng tải lại và thử lại." });
            }
            catch (DbUpdateException ex)
            {
                if (ex.InnerException is SqlException sqlEx)
                {
                    if (sqlEx.Number == 2601 || sqlEx.Number == 2627)
                        return Conflict(new { message = "Bạn đã ở trong nhóm này." });
                    if (sqlEx.Number == 547)
                        return Conflict(new { message = "Không thể tham gia nhóm. Vui lòng kiểm tra tài khoản." });
                    return Conflict(new { message = $"Không thể tham gia nhóm (SQL {sqlEx.Number})." });
                }
                if (await UserHasGroup(classroomId, _me.UserId, ct))
                    return Conflict(new { message = "Bạn đã có nhóm trong lớp." });
                var baseMessage = ex.GetBaseException().Message;
                return Conflict(new { message = $"Không thể tham gia nhóm ({baseMessage})." });
            }

            return Ok(new { message = "Đã tham gia nhóm." });
        }

        [HttpPost("{groupId:guid}/leave")]
        public async Task<IActionResult> Leave(Guid classroomId, Guid groupId, CancellationToken ct)
        {
            var memberInfo = await LoadMember(classroomId, ct);
            if (memberInfo == null) return NotFound();
            if (memberInfo.Value.member == null) return Forbid();
            if (!string.Equals(memberInfo.Value.member.Role, "Student", StringComparison.OrdinalIgnoreCase))
                return Forbid();

            var mode = ResolveClassGroupMode(memberInfo.Value.classroom);
            if (mode == "none") return BadRequest(new { message = "Giáo viên chưa bật chia nhóm cho lớp này." });
            if (mode != "student") return Forbid();

            var group = await _db.ClassroomGroups
                .Include(g => g.Members)
                .FirstOrDefaultAsync(g => g.Id == groupId && g.ClassroomId == classroomId, ct);
            if (group == null) return NotFound(new { message = "Không tìm thấy nhóm." });

            var member = group.Members.FirstOrDefault(m => m.UserId == _me.UserId);
            if (member == null) return NotFound(new { message = "Bạn chưa tham gia nhóm này." });

            var isLeader = string.Equals(member.Role, "Leader", StringComparison.OrdinalIgnoreCase);
            if (isLeader && group.Members.Count > 1)
                return BadRequest(new { message = "Trưởng nhóm không thể rời nhóm khi còn thành viên khác." });

            _db.ClassroomGroupMembers.Remove(member);

            if (group.Members.Count <= 1)
            {
                _db.ClassroomGroups.Remove(group);
            }
            else
            {
                group.UpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync(ct);

            return Ok(new { message = "Đã rời nhóm." });
        }

        [HttpPost("randomize")]
        public async Task<IActionResult> Randomize(Guid classroomId, [FromBody] RandomizeClassroomGroupsDto dto, CancellationToken ct)
        {
            var memberInfo = await LoadMember(classroomId, ct);
            if (memberInfo == null) return NotFound();
            if (!memberInfo.Value.isTeacher) return Forbid();

            var mode = ResolveClassGroupMode(memberInfo.Value.classroom);
            if (mode == "none") return BadRequest(new { message = "Giáo viên chưa bật chia nhóm cho lớp này." });
            if (mode != "random") return BadRequest(new { message = "Lớp này không chọn hình thức chia nhóm ngẫu nhiên." });

            var existingGroups = await _db.ClassroomGroups.AnyAsync(g => g.ClassroomId == classroomId, ct);
            if (existingGroups)
                return BadRequest(new { message = "Đã có nhóm trong lớp. Vui lòng xoá nhóm hiện tại trước." });

            var studentIds = await _db.Enrollments
                .Where(e => e.ClassroomId == classroomId && e.Role == "Student")
                .Select(e => e.UserId)
                .ToListAsync(ct);

            if (studentIds.Count == 0)
                return BadRequest(new { message = "Không có học viên để chia nhóm." });

            var size = dto?.GroupSize ?? 2;
            if (size <= 0) size = 1;

            var rnd = new Random();
            for (var i = studentIds.Count - 1; i > 0; i--)
            {
                var j = rnd.Next(i + 1);
                (studentIds[i], studentIds[j]) = (studentIds[j], studentIds[i]);
            }

            var groups = new List<List<Guid>>();
            for (var i = 0; i < studentIds.Count; i += size)
            {
                groups.Add(studentIds.Skip(i).Take(size).ToList());
            }

            if (groups.Count > 1 && groups[^1].Count == 1)
            {
                var donor = groups.Take(groups.Count - 1).FirstOrDefault(g => g.Count > 1);
                if (donor != null)
                {
                    var moved = donor[^1];
                    donor.RemoveAt(donor.Count - 1);
                    groups[^1].Add(moved);
                }
            }

            var now = DateTime.UtcNow;
            var index = 1;
            foreach (var groupMembers in groups)
            {
                if (groupMembers.Count == 0) continue;
                var leaderId = groupMembers[0];
                var group = new ClassroomGroup
                {
                    ClassroomId = classroomId,
                    Name = $"Nhóm {index}",
                    LeaderId = leaderId,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                foreach (var memberId in groupMembers)
                {
                    group.Members.Add(new ClassroomGroupMember
                    {
                        GroupId = group.Id,
                        UserId = memberId,
                        Role = memberId == leaderId ? "Leader" : "Member",
                        JoinedAt = now
                    });
                }
                _db.ClassroomGroups.Add(group);
                index++;
            }

            await _db.SaveChangesAsync(ct);

            var created = await _db.ClassroomGroups
                .Include(g => g.Members).ThenInclude(m => m.User)
                .Where(g => g.ClassroomId == classroomId)
                .OrderBy(g => g.CreatedAt)
                .ToListAsync(ct);

            return Ok(new { message = "Đã chia nhóm ngẫu nhiên.", groups = created.Select(MapGroup) });
        }
    }
}
