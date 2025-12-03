using class_api.Infrastructure.Data;
using class_api.Domain;
using class_api.Application.Dtos;
using class_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using class_api.Hubs;

namespace class_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class MeetingsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUser _me;
        private readonly IHubContext<MeetingHub> _hub;

        public MeetingsController(ApplicationDbContext db, ICurrentUser me, IHubContext<MeetingHub> hub)
        {
            _db = db;
            _me = me;
            _hub = hub;
        }

        [HttpGet("classrooms/{classroomId:guid}/active")]
        public async Task<IActionResult> GetActive(Guid classroomId)
        {
            var member = await _db.Enrollments.AnyAsync(e => e.ClassroomId == classroomId && e.UserId == _me.UserId);
            if (!member) return Forbid();

            var meeting = await _db.Meetings
                .Where(m => m.ClassroomId == classroomId && m.Status == "active")
                .OrderByDescending(m => m.StartedAt)
                .Select(m => new
                {
                    m.Id,
                    m.RoomCode,
                    m.Title,
                    m.Status,
                    m.StartedAt
                })
                .FirstOrDefaultAsync();

            if (meeting == null) return NotFound();
            return Ok(new
            {
                meeting.Id,
                meeting.RoomCode,
                meeting.Title,
                meeting.Status,
                StartedAt = DateTime.SpecifyKind(meeting.StartedAt, DateTimeKind.Utc)
            });
        }

        [HttpGet("classrooms/{classroomId:guid}/history")]
        public async Task<IActionResult> GetHistory(Guid classroomId, [FromQuery] int take = 20)
        {
            var member = await _db.Enrollments.AnyAsync(e => e.ClassroomId == classroomId && e.UserId == _me.UserId);
            if (!member) return Forbid();

            take = Math.Clamp(take, 1, 50);

            var history = await _db.Meetings
                .Where(m => m.ClassroomId == classroomId && m.Status != "active")
                .OrderByDescending(m => m.StartedAt)
                .Take(take)
                .Select(m => new
                {
                    m.Id,
                    m.RoomCode,
                    m.Title,
                    m.Status,
                    m.StartedAt,
                    m.EndedAt
                })
                .ToListAsync();

            var mapped = history.Select(m => new
            {
                m.Id,
                m.RoomCode,
                m.Title,
                m.Status,
                StartedAt = DateTime.SpecifyKind(m.StartedAt, DateTimeKind.Utc),
                EndedAt = m.EndedAt.HasValue ? DateTime.SpecifyKind(m.EndedAt.Value, DateTimeKind.Utc) : (DateTime?)null
            });

            return Ok(mapped);
        }

        [HttpPost("classrooms/{classroomId:guid}")]
        public async Task<IActionResult> Create(Guid classroomId, CreateMeetingDto dto)
        {
            var classroom = await _db.Classrooms.FirstOrDefaultAsync(c => c.Id == classroomId);
            if (classroom == null) return NotFound("Không tìm thấy lớp học");
            if (classroom.TeacherId != _me.UserId) return Forbid();

            var existing = await _db.Meetings.FirstOrDefaultAsync(m => m.ClassroomId == classroomId && m.Status == "active");
            if (existing != null) return Conflict("Lớp đang có cuộc họp đang hoạt động");

            var meeting = new Meeting
            {
                ClassroomId = classroomId,
                CreatedBy = _me.UserId,
                Title = string.IsNullOrWhiteSpace(dto.Title) ? classroom.Name : dto.Title!.Trim(),
                RoomCode = await GenerateRoomCodeAsync()
            };

            _db.Meetings.Add(meeting);

            _db.MeetingParticipants.Add(new MeetingParticipant
            {
                MeetingId = meeting.Id,
                UserId = _me.UserId
            });

            await _db.SaveChangesAsync();

            return Ok(new
            {
                meeting.Id,
                meeting.RoomCode,
                meeting.Title,
                StartedAt = DateTime.SpecifyKind(meeting.StartedAt, DateTimeKind.Utc),
                meeting.Status
            });
        }

        [HttpPost("join")]
        public async Task<IActionResult> Join(JoinMeetingDto dto)
        {
            var code = dto.RoomCode.Trim().ToUpperInvariant();
            var meeting = await _db.Meetings
                .Include(m => m.Classroom)
                .FirstOrDefaultAsync(m => m.RoomCode == code && m.Status == "active");
            if (meeting == null) return NotFound("Cuộc họp không tồn tại hoặc đã kết thúc");

            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == meeting.ClassroomId && e.UserId == _me.UserId);
            if (member == null) return Forbid();

            var participant = await _db.MeetingParticipants
                .FirstOrDefaultAsync(p => p.MeetingId == meeting.Id && p.UserId == _me.UserId);

            if (participant == null)
            {
                participant = new MeetingParticipant
                {
                    MeetingId = meeting.Id,
                    UserId = _me.UserId
                };
                _db.MeetingParticipants.Add(participant);
            }
            else if (participant.LeftAt.HasValue)
            {
                participant.LeftAt = null;
                participant.JoinedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();

            var members = await _db.Enrollments
                .Where(e => e.ClassroomId == meeting.ClassroomId)
                .Include(e => e.User)
                .Select(e => new
                {
                    e.UserId,
                    FullName = e.User!.FullName,
                    e.User!.Avatar
                })
                .ToListAsync();

            return Ok(new
            {
                meeting.Id,
                meeting.RoomCode,
                meeting.Title,
                StartedAt = DateTime.SpecifyKind(meeting.StartedAt, DateTimeKind.Utc),
                meeting.Status,
                classroom = new
                {
                    meeting.Classroom!.Id,
                    meeting.Classroom!.Name,
                    Members = members
                },
                member.Role
            });
        }

        [HttpPost("{meetingId:guid}/leave")]
        public async Task<IActionResult> Leave(Guid meetingId)
        {
            var participant = await _db.MeetingParticipants
                .FirstOrDefaultAsync(p => p.MeetingId == meetingId && p.UserId == _me.UserId);
            if (participant == null) return NotFound();

            participant.LeftAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("{meetingId:guid}/end")]
        public async Task<IActionResult> End(Guid meetingId)
        {
            var meeting = await _db.Meetings.FirstOrDefaultAsync(m => m.Id == meetingId);
            if (meeting == null) return NotFound();
            if (meeting.CreatedBy != _me.UserId) return Forbid();

            meeting.Status = "ended";
            meeting.EndedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            await _hub.Clients.Group(meeting.RoomCode).SendAsync("MeetingEnded", new
            {
                meetingId = meeting.Id,
                meeting.RoomCode
            });

            return Ok();
        }

        private async Task<string> GenerateRoomCodeAsync()
        {
            const string letters = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
            var rand = new Random();

            while (true)
            {
                var code = new string(Enumerable.Range(0, 8).Select(_ => letters[rand.Next(letters.Length)]).ToArray());
                var exists = await _db.Meetings.AnyAsync(m => m.RoomCode == code);
                if (!exists) return code;
            }
        }
    }
}
