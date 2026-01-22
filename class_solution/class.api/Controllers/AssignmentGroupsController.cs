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
    [Route("api/assignments/{assignmentId:guid}/groups")]
    [Authorize]
    public class AssignmentGroupsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUser _me;

        public AssignmentGroupsController(ApplicationDbContext db, ICurrentUser me)
        {
            _db = db;
            _me = me;
        }

        private async Task<(Assignment assignment, Enrollment? member, bool isTeacher)?> LoadMember(Guid assignmentId, CancellationToken ct)
        {
            var assignment = await _db.Assignments.FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
            if (assignment == null) return null;
            var member = await _db.Enrollments.Include(e => e.User)
                .FirstOrDefaultAsync(e => e.ClassroomId == assignment.ClassroomId && e.UserId == _me.UserId, ct);
            var isTeacher = member != null && string.Equals(member.Role, "Teacher", StringComparison.OrdinalIgnoreCase);
            return (assignment, member, isTeacher);
        }

        private static string ResolveGroupMode(Assignment assignment)
        {
            return string.Equals(assignment.GroupMode, "random", StringComparison.OrdinalIgnoreCase) ? "random" : "student";
        }

        private Task<bool> UserHasGroup(Guid assignmentId, Guid userId, CancellationToken ct)
        {
            return _db.AssignmentGroupMembers
                .AnyAsync(m => m.AssignmentId == assignmentId && m.UserId == userId, ct);
        }

        private async Task<IActionResult?> EnsureStudentCanEditGroup(Assignment assignment, Guid? groupId, CancellationToken ct)
        {
            if (assignment.DueAt.HasValue && assignment.DueAt.Value <= DateTime.UtcNow)
                return BadRequest(new { message = "Đã quá thời điểm chốt nhóm." });

            if (groupId.HasValue)
            {
                var hasSubmission = await _db.Submissions
                    .AnyAsync(s => s.AssignmentId == assignment.Id && s.GroupId == groupId.Value, ct);
                if (hasSubmission)
                    return BadRequest(new { message = "Nhóm đã nộp bài nên không thể thay đổi." });
            }

            return null;
        }

        private static object MapGroup(AssignmentGroup group)
        {
            var leaderMember = group.Members.FirstOrDefault(m => m.UserId == group.LeaderId) ??
                               group.Members.FirstOrDefault(m => string.Equals(m.Role, "Leader", StringComparison.OrdinalIgnoreCase));
            return new
            {
                group.Id,
                group.Name,
                group.AssignmentId,
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
                        m.CanSubmit,
                        JoinedAt = DateTime.SpecifyKind(m.JoinedAt, DateTimeKind.Utc)
                    })
            };
        }

        [HttpGet]
        public async Task<IActionResult> List(Guid assignmentId, CancellationToken ct)
        {
            var memberInfo = await LoadMember(assignmentId, ct);
            if (memberInfo == null) return NotFound();
            if (memberInfo.Value.member == null) return Forbid();
            if (!memberInfo.Value.assignment.GroupEnabled)
                return Ok(Array.Empty<object>());

            var groups = await _db.AssignmentGroups
                .Include(g => g.Members)
                .ThenInclude(m => m.User)
                .Where(g => g.AssignmentId == assignmentId)
                .OrderBy(g => g.CreatedAt)
                .ToListAsync(ct);

            return Ok(groups.Select(MapGroup));
        }

        [HttpGet("me")]
        public async Task<IActionResult> MyGroup(Guid assignmentId, CancellationToken ct)
        {
            var memberInfo = await LoadMember(assignmentId, ct);
            if (memberInfo == null) return NotFound();
            if (memberInfo.Value.member == null) return Forbid();
            if (!memberInfo.Value.assignment.GroupEnabled)
                return Ok(null);

            var member = await _db.AssignmentGroupMembers
                .Include(m => m.Group)
                .ThenInclude(g => g.Members)
                .ThenInclude(m => m.User)
                .FirstOrDefaultAsync(m => m.AssignmentId == assignmentId && m.UserId == _me.UserId, ct);

            if (member?.Group == null) return Ok(null);
            return Ok(new
            {
                Group = MapGroup(member.Group),
                Member = new
                {
                    member.UserId,
                    member.Role,
                    member.CanSubmit
                }
            });
        }

        [HttpPost]
        public async Task<IActionResult> Create(Guid assignmentId, [FromBody] CreateAssignmentGroupDto dto, CancellationToken ct)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "Vui lòng nhập tên nhóm." });

            var memberInfo = await LoadMember(assignmentId, ct);
            if (memberInfo == null) return NotFound();
            if (memberInfo.Value.member == null) return Forbid();

            var assignment = memberInfo.Value.assignment;
            var isTeacher = memberInfo.Value.isTeacher;
            var mode = ResolveGroupMode(assignment);

            if (!assignment.GroupEnabled)
                return BadRequest(new { message = "Bài tập này không bật nộp theo nhóm." });

            if (mode == "random" && !isTeacher)
                return Forbid();

            if (!isTeacher)
            {
                if (!string.Equals(memberInfo.Value.member!.Role, "Student", StringComparison.OrdinalIgnoreCase))
                    return Forbid();
                if (await UserHasGroup(assignmentId, _me.UserId, ct))
                    return Conflict(new { message = "Bạn đã có nhóm cho bài tập này." });
                var guard = await EnsureStudentCanEditGroup(assignment, null, ct);
                if (guard != null) return guard;
            }

            var leaderId = isTeacher ? dto.LeaderId : _me.UserId;
            if (!leaderId.HasValue || leaderId.Value == Guid.Empty)
                return BadRequest(new { message = "Thiếu trưởng nhóm." });

            var leaderEnrollment = await _db.Enrollments
                .FirstOrDefaultAsync(e => e.ClassroomId == assignment.ClassroomId && e.UserId == leaderId.Value, ct);
            if (leaderEnrollment == null || !string.Equals(leaderEnrollment.Role, "Student", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Trưởng nhóm phải là học viên trong lớp." });

            var memberIds = new HashSet<Guid>(dto.MemberIds ?? new List<Guid>());
            if (!isTeacher)
            {
                memberIds.Clear();
            }
            memberIds.Add(leaderId.Value);

            if (assignment.GroupMaxMembers.HasValue && memberIds.Count > assignment.GroupMaxMembers.Value)
            {
                return BadRequest(new { message = "Số thành viên vượt quá giới hạn tối đa của nhóm." });
            }

            var enrolled = await _db.Enrollments
                .Include(e => e.User)
                .Where(e => e.ClassroomId == assignment.ClassroomId && memberIds.Contains(e.UserId) && e.Role == "Student")
                .ToListAsync(ct);

            if (enrolled.Count != memberIds.Count)
                return BadRequest(new { message = "Danh sách thành viên không hợp lệ." });

            var existing = await _db.AssignmentGroupMembers
                .Where(m => m.AssignmentId == assignmentId && memberIds.Contains(m.UserId))
                .Select(m => m.UserId)
                .ToListAsync(ct);
            if (existing.Count > 0)
                return Conflict(new { message = "Một số học viên đã có nhóm cho bài tập này." });

            var now = DateTime.UtcNow;
            var group = new AssignmentGroup
            {
                AssignmentId = assignmentId,
                Name = dto.Name.Trim(),
                LeaderId = leaderId.Value,
                CreatedAt = now,
                UpdatedAt = now
            };

            foreach (var memberId in memberIds)
            {
                var role = memberId == leaderId.Value ? "Leader" : "Member";
                var canSubmit = memberId == leaderId.Value;
                group.Members.Add(new AssignmentGroupMember
                {
                    AssignmentId = assignmentId,
                    GroupId = group.Id,
                    UserId = memberId,
                    Role = role,
                    CanSubmit = canSubmit,
                    JoinedAt = now
                });
            }

            _db.AssignmentGroups.Add(group);
            await _db.SaveChangesAsync(ct);

            var reloaded = await _db.AssignmentGroups
                .Include(g => g.Members).ThenInclude(m => m.User)
                .FirstAsync(g => g.Id == group.Id, ct);

            return CreatedAtAction(nameof(MyGroup), new { assignmentId }, new { Group = MapGroup(reloaded) });
        }

        [HttpPost("{groupId:guid}/join")]
        public async Task<IActionResult> Join(Guid assignmentId, Guid groupId, CancellationToken ct)
        {
            var memberInfo = await LoadMember(assignmentId, ct);
            if (memberInfo == null) return NotFound();
            if (memberInfo.Value.member == null) return Forbid();
            if (!string.Equals(memberInfo.Value.member.Role, "Student", StringComparison.OrdinalIgnoreCase))
                return Forbid();

            if (!memberInfo.Value.assignment.GroupEnabled)
                return BadRequest(new { message = "Bài tập này không bật nộp theo nhóm." });

            var mode = ResolveGroupMode(memberInfo.Value.assignment);
            if (mode != "student") return Forbid();

            if (await UserHasGroup(assignmentId, _me.UserId, ct))
                return Conflict(new { message = "Bạn đã có nhóm cho bài tập này." });

            var group = await _db.AssignmentGroups
                .Include(g => g.Members)
                .FirstOrDefaultAsync(g => g.Id == groupId && g.AssignmentId == assignmentId, ct);
            if (group == null) return NotFound(new { message = "Không tìm thấy nhóm." });

            var guard = await EnsureStudentCanEditGroup(memberInfo.Value.assignment, groupId, ct);
            if (guard != null) return guard;

            var maxMembers = memberInfo.Value.assignment.GroupMaxMembers;
            if (maxMembers.HasValue && group.Members.Count >= maxMembers.Value)
                return BadRequest(new { message = "Nhóm đã đủ thành viên." });

            if (group.Members.Any(m => m.UserId == _me.UserId))
                return Conflict(new { message = "Bạn đã ở trong nhóm này." });

            var now = DateTime.UtcNow;
            group.Members.Add(new AssignmentGroupMember
            {
                AssignmentId = assignmentId,
                GroupId = group.Id,
                UserId = _me.UserId,
                Role = "Member",
                CanSubmit = false,
                JoinedAt = now
            });
            group.UpdatedAt = now;
            await _db.SaveChangesAsync(ct);

            return Ok(new { message = "Đã tham gia nhóm." });
        }

        [HttpPost("{groupId:guid}/leave")]
        public async Task<IActionResult> Leave(Guid assignmentId, Guid groupId, CancellationToken ct)
        {
            var memberInfo = await LoadMember(assignmentId, ct);
            if (memberInfo == null) return NotFound();
            if (memberInfo.Value.member == null) return Forbid();
            if (!string.Equals(memberInfo.Value.member.Role, "Student", StringComparison.OrdinalIgnoreCase))
                return Forbid();

            if (!memberInfo.Value.assignment.GroupEnabled)
                return BadRequest(new { message = "Bài tập này không bật nộp theo nhóm." });

            var mode = ResolveGroupMode(memberInfo.Value.assignment);
            if (mode != "student") return Forbid();

            var group = await _db.AssignmentGroups
                .Include(g => g.Members)
                .FirstOrDefaultAsync(g => g.Id == groupId && g.AssignmentId == assignmentId, ct);
            if (group == null) return NotFound(new { message = "Không tìm thấy nhóm." });

            var guard = await EnsureStudentCanEditGroup(memberInfo.Value.assignment, groupId, ct);
            if (guard != null) return guard;

            var member = group.Members.FirstOrDefault(m => m.UserId == _me.UserId);
            if (member == null) return NotFound(new { message = "Bạn chưa tham gia nhóm này." });

            var isLeader = string.Equals(member.Role, "Leader", StringComparison.OrdinalIgnoreCase);
            if (isLeader && group.Members.Count > 1)
                return BadRequest(new { message = "Trưởng nhóm cần chuyển quyền trước khi rời nhóm." });

            _db.AssignmentGroupMembers.Remove(member);

            if (group.Members.Count <= 1)
            {
                _db.AssignmentGroups.Remove(group);
            }
            else
            {
                group.UpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync(ct);

            return Ok(new { message = "Đã rời nhóm." });
        }

        [HttpPatch("{groupId:guid}")]
        public async Task<IActionResult> Update(Guid assignmentId, Guid groupId, [FromBody] UpdateAssignmentGroupDto dto, CancellationToken ct)
        {
            if (dto == null) return BadRequest(new { message = "Thiếu dữ liệu cập nhật." });
            var memberInfo = await LoadMember(assignmentId, ct);
            if (memberInfo == null) return NotFound();
            if (memberInfo.Value.member == null) return Forbid();
            if (!memberInfo.Value.assignment.GroupEnabled)
                return BadRequest(new { message = "Bài tập này không bật nộp theo nhóm." });

            var group = await _db.AssignmentGroups
                .Include(g => g.Members)
                .FirstOrDefaultAsync(g => g.Id == groupId && g.AssignmentId == assignmentId, ct);
            if (group == null) return NotFound(new { message = "Không tìm thấy nhóm." });

            var isTeacher = memberInfo.Value.isTeacher;
            var isLeader = group.LeaderId == _me.UserId;
            var mode = ResolveGroupMode(memberInfo.Value.assignment);
            if (!isTeacher && !isLeader) return Forbid();
            if (mode == "random" && !isTeacher) return Forbid();
            if (!isTeacher)
            {
                var guard = await EnsureStudentCanEditGroup(memberInfo.Value.assignment, groupId, ct);
                if (guard != null) return guard;
            }

            if (!string.IsNullOrWhiteSpace(dto.Name))
                group.Name = dto.Name.Trim();

            if (dto.LeaderId.HasValue && dto.LeaderId.Value != group.LeaderId)
            {
                var newLeader = group.Members.FirstOrDefault(m => m.UserId == dto.LeaderId.Value);
                if (newLeader == null)
                    return BadRequest(new { message = "Trưởng nhóm mới phải là thành viên trong nhóm." });

                var oldLeader = group.Members.FirstOrDefault(m => m.UserId == group.LeaderId);
                if (oldLeader != null)
                {
                    oldLeader.Role = "Member";
                    oldLeader.CanSubmit = false;
                }
                newLeader.Role = "Leader";
                newLeader.CanSubmit = true;
                group.LeaderId = newLeader.UserId;
            }

            group.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            return Ok(new { message = "Đã cập nhật nhóm." });
        }

        [HttpPost("{groupId:guid}/members")]
        public async Task<IActionResult> AddMembers(Guid assignmentId, Guid groupId, [FromBody] AddAssignmentGroupMembersDto dto, CancellationToken ct)
        {
            if (dto?.MemberIds == null || dto.MemberIds.Count == 0)
                return BadRequest(new { message = "Chưa chọn thành viên." });

            var memberInfo = await LoadMember(assignmentId, ct);
            if (memberInfo == null) return NotFound();
            if (memberInfo.Value.member == null) return Forbid();
            if (!memberInfo.Value.assignment.GroupEnabled)
                return BadRequest(new { message = "Bài tập này không bật nộp theo nhóm." });

            var group = await _db.AssignmentGroups
                .Include(g => g.Members)
                .FirstOrDefaultAsync(g => g.Id == groupId && g.AssignmentId == assignmentId, ct);
            if (group == null) return NotFound(new { message = "Không tìm thấy nhóm." });

            var isTeacher = memberInfo.Value.isTeacher;
            if (!isTeacher) return Forbid();

            var memberIds = dto.MemberIds.Where(id => id != Guid.Empty).Distinct().ToList();

            var existingMembers = await _db.AssignmentGroupMembers
                .Where(m => m.AssignmentId == assignmentId && memberIds.Contains(m.UserId))
                .Select(m => m.UserId)
                .ToListAsync(ct);
            if (existingMembers.Count > 0)
                return Conflict(new { message = "Một số học viên đã có nhóm cho bài tập này." });

            var enrolled = await _db.Enrollments
                .Where(e => e.ClassroomId == memberInfo.Value.assignment.ClassroomId && memberIds.Contains(e.UserId) && e.Role == "Student")
                .ToListAsync(ct);
            if (enrolled.Count != memberIds.Count)
                return BadRequest(new { message = "Danh sách thành viên không hợp lệ." });

            var maxMembers = memberInfo.Value.assignment.GroupMaxMembers;
            if (maxMembers.HasValue && group.Members.Count + memberIds.Count > maxMembers.Value)
                return BadRequest(new { message = "Số thành viên vượt quá giới hạn tối đa của nhóm." });

            var now = DateTime.UtcNow;
            foreach (var memberId in memberIds)
            {
                group.Members.Add(new AssignmentGroupMember
                {
                    AssignmentId = assignmentId,
                    GroupId = group.Id,
                    UserId = memberId,
                    Role = "Member",
                    CanSubmit = false,
                    JoinedAt = now
                });
            }

            group.UpdatedAt = now;
            await _db.SaveChangesAsync(ct);

            return Ok(new { message = "Đã thêm thành viên." });
        }

        [HttpPatch("{groupId:guid}/members/{userId:guid}")]
        public async Task<IActionResult> UpdateMember(Guid assignmentId, Guid groupId, Guid userId, [FromBody] UpdateAssignmentGroupMemberDto dto, CancellationToken ct)
        {
            if (dto == null) return BadRequest(new { message = "Thiếu dữ liệu cập nhật." });
            var memberInfo = await LoadMember(assignmentId, ct);
            if (memberInfo == null) return NotFound();
            if (memberInfo.Value.member == null) return Forbid();
            if (!memberInfo.Value.assignment.GroupEnabled)
                return BadRequest(new { message = "Bài tập này không bật nộp theo nhóm." });

            var group = await _db.AssignmentGroups
                .Include(g => g.Members)
                .FirstOrDefaultAsync(g => g.Id == groupId && g.AssignmentId == assignmentId, ct);
            if (group == null) return NotFound(new { message = "Không tìm thấy nhóm." });

            var isTeacher = memberInfo.Value.isTeacher;
            var isLeader = group.LeaderId == _me.UserId;
            var mode = ResolveGroupMode(memberInfo.Value.assignment);
            if (!isTeacher && !isLeader) return Forbid();
            if (mode == "random" && !isTeacher) return Forbid();
            if (!isTeacher)
            {
                var guard = await EnsureStudentCanEditGroup(memberInfo.Value.assignment, groupId, ct);
                if (guard != null) return guard;
            }

            var member = group.Members.FirstOrDefault(m => m.UserId == userId);
            if (member == null) return NotFound(new { message = "Không tìm thấy thành viên." });

            if (string.Equals(member.Role, "Leader", StringComparison.OrdinalIgnoreCase))
            {
                member.CanSubmit = true;
            }
            else
            {
                member.CanSubmit = dto.CanSubmit;
            }

            group.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            return Ok(new { message = "Đã cập nhật quyền nộp." });
        }

        [HttpDelete("{groupId:guid}/members/{userId:guid}")]
        public async Task<IActionResult> RemoveMember(Guid assignmentId, Guid groupId, Guid userId, CancellationToken ct)
        {
            var memberInfo = await LoadMember(assignmentId, ct);
            if (memberInfo == null) return NotFound();
            if (memberInfo.Value.member == null) return Forbid();
            if (!memberInfo.Value.assignment.GroupEnabled)
                return BadRequest(new { message = "Bài tập này không bật nộp theo nhóm." });

            var group = await _db.AssignmentGroups
                .Include(g => g.Members)
                .FirstOrDefaultAsync(g => g.Id == groupId && g.AssignmentId == assignmentId, ct);
            if (group == null) return NotFound(new { message = "Không tìm thấy nhóm." });

            var isTeacher = memberInfo.Value.isTeacher;
            var isLeader = group.LeaderId == _me.UserId;
            var mode = ResolveGroupMode(memberInfo.Value.assignment);
            if (!isTeacher && !isLeader) return Forbid();
            if (mode == "random" && !isTeacher) return Forbid();
            if (!isTeacher)
            {
                var guard = await EnsureStudentCanEditGroup(memberInfo.Value.assignment, groupId, ct);
                if (guard != null) return guard;
            }

            if (group.LeaderId == userId)
                return BadRequest(new { message = "Không thể xoá trưởng nhóm. Hãy đổi trưởng nhóm trước." });

            var member = group.Members.FirstOrDefault(m => m.UserId == userId);
            if (member == null) return NotFound(new { message = "Không tìm thấy thành viên." });

            _db.AssignmentGroupMembers.Remove(member);
            group.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            return Ok(new { message = "Đã xóa thành viên khỏi nhóm." });
        }

        [HttpPost("randomize")]
        public async Task<IActionResult> Randomize(Guid assignmentId, CancellationToken ct)
        {
            var memberInfo = await LoadMember(assignmentId, ct);
            if (memberInfo == null) return NotFound();
            if (memberInfo.Value.member == null) return Forbid();
            if (!memberInfo.Value.isTeacher) return Forbid();
            if (!memberInfo.Value.assignment.GroupEnabled)
                return BadRequest(new { message = "Bài tập này không bật nộp theo nhóm." });

            var mode = ResolveGroupMode(memberInfo.Value.assignment);
            if (mode != "random")
                return BadRequest(new { message = "Bài tập này không chọn hình thức chia nhóm ngẫu nhiên." });

            var existingGroups = await _db.AssignmentGroups.AnyAsync(g => g.AssignmentId == assignmentId, ct);
            if (existingGroups)
                return BadRequest(new { message = "Đã có nhóm cho bài tập này. Vui lòng xoá hoặc chỉnh sửa nhóm hiện tại." });

            var hasSubmissions = await _db.Submissions.AnyAsync(s => s.AssignmentId == assignmentId, ct);
            if (hasSubmissions)
                return BadRequest(new { message = "Đã có bài nộp nên không thể chia nhóm ngẫu nhiên." });

            var studentIds = await _db.Enrollments
                .Where(e => e.ClassroomId == memberInfo.Value.assignment.ClassroomId && e.Role == "Student")
                .Select(e => e.UserId)
                .ToListAsync(ct);

            if (studentIds.Count == 0)
                return BadRequest(new { message = "Không có học viên để chia nhóm." });

            var maxSize = memberInfo.Value.assignment.GroupMaxMembers ?? memberInfo.Value.assignment.GroupMinMembers ?? 2;
            var minSize = memberInfo.Value.assignment.GroupMinMembers ?? 1;
            if (maxSize <= 0) maxSize = 1;
            if (minSize <= 0) minSize = 1;
            if (maxSize < minSize) maxSize = minSize;

            var rnd = new Random();
            for (var i = studentIds.Count - 1; i > 0; i--)
            {
                var j = rnd.Next(i + 1);
                (studentIds[i], studentIds[j]) = (studentIds[j], studentIds[i]);
            }

            var groups = new List<List<Guid>>();
            for (var i = 0; i < studentIds.Count; i += maxSize)
            {
                groups.Add(studentIds.Skip(i).Take(maxSize).ToList());
            }

            if (groups.Count > 1)
            {
                var last = groups.Last();
                while (last.Count < minSize)
                {
                    var donor = groups.Take(groups.Count - 1).FirstOrDefault(g => g.Count > minSize);
                    if (donor == null) break;
                    var moved = donor[^1];
                    donor.RemoveAt(donor.Count - 1);
                    last.Add(moved);
                }
            }

            var now = DateTime.UtcNow;
            var index = 1;
            foreach (var groupMembers in groups)
            {
                if (groupMembers.Count == 0) continue;
                var leaderId = groupMembers[0];
                var group = new AssignmentGroup
                {
                    AssignmentId = assignmentId,
                    Name = $"Nhóm {index}",
                    LeaderId = leaderId,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                foreach (var memberId in groupMembers)
                {
                    group.Members.Add(new AssignmentGroupMember
                    {
                        AssignmentId = assignmentId,
                        GroupId = group.Id,
                        UserId = memberId,
                        Role = memberId == leaderId ? "Leader" : "Member",
                        CanSubmit = memberId == leaderId,
                        JoinedAt = now
                    });
                }
                _db.AssignmentGroups.Add(group);
                index++;
            }

            await _db.SaveChangesAsync(ct);

            var created = await _db.AssignmentGroups
                .Include(g => g.Members).ThenInclude(m => m.User)
                .Where(g => g.AssignmentId == assignmentId)
                .OrderBy(g => g.CreatedAt)
                .ToListAsync(ct);

            return Ok(new { message = "Đã chia nhóm ngẫu nhiên.", groups = created.Select(MapGroup) });
        }
    }
}
