using class_api.Infrastructure.Data;
using class_api.Domain;
using class_api.Application.Dtos;
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
    public class ClassroomsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUser _me;
        private readonly IHubContext<ClassroomHub> _hub;

        public ClassroomsController(ApplicationDbContext db, ICurrentUser me, IHubContext<ClassroomHub> hub)
        {
            _db = db; _me = me; _hub = hub;
        }

        [HttpPost]
        public async Task<IActionResult> Create(CreateClassroomDto dto)
        {
            var bannerList = new[]
            {
                "/images/banners/banner-1.svg",
                "/images/banners/banner-2.svg",
                "/images/banners/banner-3.svg",
                "/images/banners/banner-4.svg",
            };
            var rand = new Random();
            var banner = bannerList[rand.Next(bannerList.Length)];

            var classroom = new Classroom
            {
                Name = dto.Name.Trim(),
                Description = dto.Description,
                Section = dto.Section,
                Room = dto.Room,
                Schedule = dto.Schedule,
                TeacherId = _me.UserId,
                InviteCode = Guid.NewGuid().ToString("N")[..6].ToUpper(),
                BannerUrl = banner
            };

            _db.Classrooms.Add(classroom);

            _db.Enrollments.Add(new Enrollment
            {
                ClassroomId = classroom.Id,
                UserId = _me.UserId,
                Role = "Teacher"
            });

            await _db.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = classroom.Id }, new
            {
                classroom.Id,
                classroom.Name,
                classroom.InviteCode,
                classroom.BannerUrl
            });
        }

        [HttpPost("join")]
        public async Task<IActionResult> Join(JoinClassroomDto dto)
        {
            var code = dto.InviteCode.Trim().ToUpper();
            var classroom = await _db.Classrooms.FirstOrDefaultAsync(c => c.InviteCode == code);
            if (classroom == null) return NotFound("Invalid invite code");

            var exists = await _db.Enrollments.AnyAsync(e => e.ClassroomId == classroom.Id && e.UserId == _me.UserId);
            if (exists) return Conflict("You already joined this classroom");

            _db.Enrollments.Add(new Enrollment
            {
                ClassroomId = classroom.Id,
                UserId = _me.UserId,
                Role = "Student"
            });
            await _db.SaveChangesAsync();

            var joinedUser = await _db.Users.FindAsync(_me.UserId);

            await _hub.Clients.Group(classroom.Id.ToString()).SendAsync("MemberJoined", new
            {
                classroomId = classroom.Id,
                userId = _me.UserId,
                fullName = joinedUser?.FullName ?? "",
                avatar = joinedUser?.Avatar
            });

            return Ok(new { message = "Joined", classroomId = classroom.Id });
        }

        [HttpGet]
        public async Task<IActionResult> MyClassrooms()
        {
            var data = await _db.Enrollments
                .Where(e => e.UserId == _me.UserId)
                .Include(e => e.Classroom)
                .Select(e => new
                {
                    e.ClassroomId,
                    e.Role,
                    e.Classroom!.Name,
                    e.Classroom.Description,
                    e.Classroom.InviteCode,
                    e.Classroom.Section,
                    BannerUrl = e.Classroom.BannerUrl,
                    InviteCodeVisible = e.Classroom.InviteCodeVisible
                })
                .ToListAsync();

            return Ok(data);
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var member = await _db.Enrollments.FirstOrDefaultAsync(e => e.ClassroomId == id && e.UserId == _me.UserId);
            if (member == null) return Forbid();

            var c = await _db.Classrooms
                .Include(x => x.Enrollments).ThenInclude(e => e.User)
                .Include(x => x.Assignments).ThenInclude(a => a.Grades)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (c == null) return NotFound();

            return Ok(new
            {
                c.Id,
                c.Name,
                c.Description,
                c.InviteCode,
                c.BannerUrl,
                c.Section,
                c.Room,
                c.Schedule,
                c.InviteCodeVisible,
                Members = c.Enrollments.Select(e => new { e.UserId, e.User!.FullName, e.User!.Email, e.User!.Avatar, e.Role }),
                Assignments = c.Assignments
                    .OrderByDescending(a => a.CreatedAt)
                    .Select(a => new
                    {
                        a.Id,
                        a.Title,
                        DueAt = (DateTime?)(a.DueAt.HasValue ? DateTime.SpecifyKind(a.DueAt.Value, DateTimeKind.Utc) : null),
                        a.MaxPoints,
                        CreatedAt = DateTime.SpecifyKind(a.CreatedAt, DateTimeKind.Utc),
                        Grades = a.Grades.Select(g => new
                        {
                            g.Id,
                            g.UserId,
                            g.Score,
                            g.Feedback,
                            g.Status,
                            g.SubmissionId,
                            UpdatedAt = DateTime.SpecifyKind(g.UpdatedAt, DateTimeKind.Utc)
                        })
                    })
            });
        }

        [HttpPost("{id:guid}/change-banner")]
        public async Task<IActionResult> ChangeBanner(Guid id)
        {
            var c = await _db.Classrooms.FirstOrDefaultAsync(x => x.Id == id);
            if (c == null) return NotFound();
            if (c.TeacherId != _me.UserId) return Forbid();

            var bannerList = new[]
            {
                "/images/banners/banner-1.svg",
                "/images/banners/banner-2.svg",
                "/images/banners/banner-3.svg",
                "/images/banners/banner-4.svg",
            };
            var rand = new Random();
            var candidates = bannerList.Where(b => b != c.BannerUrl).ToArray();
            var next = (candidates.Length > 0 ? candidates : bannerList)[rand.Next(candidates.Length > 0 ? candidates.Length : bannerList.Length)];
            c.BannerUrl = next;
            c.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { bannerUrl = c.BannerUrl });
        }

        [HttpPost("{id:guid}/invite-code-visibility")]
        public async Task<IActionResult> SetInviteCodeVisibility(Guid id, UpdateInviteCodeVisibilityDto dto)
        {
            var c = await _db.Classrooms.FirstOrDefaultAsync(x => x.Id == id);
            if (c == null) return NotFound();
            if (c.TeacherId != _me.UserId) return Forbid();

            c.InviteCodeVisible = dto.Visible;
            c.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return Ok(new { c.InviteCodeVisible });
        }
    }
}
