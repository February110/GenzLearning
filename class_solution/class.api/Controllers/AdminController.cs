using class_api.Infrastructure.Data;
using class_api.Domain;
using class_api.Application.Dtos;
using class_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Options;
using System.Globalization;
using System.Text.Json;

namespace class_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AdminController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IActivityStream _activityStream;
        private readonly INotificationDispatcher _dispatcher;
        private readonly IDistributedCache _cache;
        private readonly JsonSerializerOptions _jsonOptions;
        private readonly TimeSpan _overviewCacheDuration;
        private readonly bool _shouldCacheOverview;
        private const string OverviewCacheKey = "admin:overview";

        public AdminController(
            ApplicationDbContext db,
            IActivityStream activityStream,
            INotificationDispatcher dispatcher,
            IDistributedCache cache,
            IConfiguration configuration,
            IOptions<JsonOptions> jsonOptionsAccessor)
        {
            _db = db;
            _activityStream = activityStream;
            _dispatcher = dispatcher;
            _cache = cache;
            _jsonOptions = jsonOptionsAccessor.Value.JsonSerializerOptions;

            var configuredSeconds = configuration.GetValue<int?>("Redis:OverviewCacheSeconds");
            if (configuredSeconds.HasValue && configuredSeconds.Value <= 0)
            {
                _shouldCacheOverview = false;
                _overviewCacheDuration = TimeSpan.Zero;
            }
            else
            {
                _shouldCacheOverview = true;
                _overviewCacheDuration = TimeSpan.FromSeconds(configuredSeconds ?? 60);
            }
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpGet("overview")]
        public async Task<IActionResult> GetOverview(CancellationToken ct)
        {
            OverviewCachePayload? cachedPayload = null;
            if (_shouldCacheOverview)
            {
                var cached = await _cache.GetStringAsync(OverviewCacheKey, ct);
                if (!string.IsNullOrEmpty(cached))
                {
                    try
                    {
                        cachedPayload = JsonSerializer.Deserialize<OverviewCachePayload>(cached, _jsonOptions);
                    }
                    catch
                    {
                        cachedPayload = null;
                    }
                }
            }

            OverviewTotals totals;
            OverviewCharts charts;
            OverviewQuality quality;

            if (cachedPayload != null)
            {
                totals = cachedPayload.Totals;
                charts = cachedPayload.Charts;
                quality = cachedPayload.Quality;
            }
            else
            {
                var now = DateTime.UtcNow;
                var dayStart = now.Date;
                var weekStart = now.AddDays(-7);
                var currentMonthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
                var previousMonthStart = currentMonthStart.AddMonths(-1);
                var sixMonthsAgo = currentMonthStart.AddMonths(-5);
                var heatmapStart = dayStart.AddDays(-6);
                var viCulture = new CultureInfo("vi-VN");

                var users = await _db.Users.CountAsync(ct);
                var classes = await _db.Classrooms.CountAsync(ct);
                var assignmentsCount = await _db.Assignments.CountAsync(ct);
                var submissionsCount = await _db.Submissions.CountAsync(ct);
                var dailyVisits = await _db.Users.CountAsync(u => u.LastLoginAt >= dayStart, ct);
                var weeklyVisits = await _db.Users.CountAsync(u => u.LastLoginAt >= weekStart, ct);

                var currentEnrollments = await _db.Enrollments.CountAsync(e => e.JoinedAt >= currentMonthStart, ct);
                var previousEnrollments = await _db.Enrollments.CountAsync(e => e.JoinedAt >= previousMonthStart && e.JoinedAt < currentMonthStart, ct);
                var growthRate = previousEnrollments == 0
                    ? (currentEnrollments > 0 ? 100d : 0d)
                    : Math.Round(((double)(currentEnrollments - previousEnrollments) / previousEnrollments) * 100d, 1);

                var monthlySubmissionsRaw = await _db.Submissions
                    .Where(s => s.SubmittedAt >= sixMonthsAgo)
                    .GroupBy(s => new { s.SubmittedAt.Year, s.SubmittedAt.Month })
                    .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count() })
                    .ToListAsync(ct);
                var submissionsPerMonth = Enumerable.Range(0, 6)
                    .Select(i => sixMonthsAgo.AddMonths(i))
                    .Select(d => new LabelValue(d.ToString("MMM", viCulture), monthlySubmissionsRaw.FirstOrDefault(m => m.Year == d.Year && m.Month == d.Month)?.Count ?? 0))
                    .ToList();

                var weekAnchor = StartOfWeek(now);
                var eightWeeksAgo = weekAnchor.AddDays(-7 * 7);
                var weeklyLoginDates = await _db.Users
                    .Where(u => u.LastLoginAt >= eightWeeksAgo && u.LastLoginAt != null)
                    .Select(u => u.LastLoginAt)
                    .ToListAsync(ct);
                var weeklyLoginMap = weeklyLoginDates
                    .Where(d => d.HasValue)
                    .Select(d => d!.Value)
                    .GroupBy(d => StartOfWeek(d))
                    .ToDictionary(g => g.Key, g => g.Count());
                var loginsPerWeek = Enumerable.Range(0, 8)
                    .Select(i => weekAnchor.AddDays(-7 * (7 - i)))
                    .OrderBy(d => d)
                    .Select(start => new LabelValue($"{start:dd/MM}", weeklyLoginMap.TryGetValue(start, out var count) ? count : 0))
                    .ToList();

                var teacherCount = await _db.Enrollments
                    .Where(e => e.Role == "Teacher")
                    .Select(e => e.UserId)
                    .Distinct()
                    .CountAsync(ct);
                var studentCount = await _db.Enrollments
                    .Where(e => e.Role == "Student")
                    .Select(e => e.UserId)
                    .Distinct()
                    .CountAsync(ct);
                var roleDistribution = new List<LabelValue>
                {
                    new("Giáo viên", teacherCount),
                    new("Học viên", studentCount)
                };

                var submissionHours = await _db.Submissions
                    .Where(s => s.SubmittedAt >= heatmapStart)
                    .Select(s => s.SubmittedAt)
                    .ToListAsync(ct);
                var hourMap = submissionHours
                    .GroupBy(d => $"{d.Date:yyyy-MM-dd}-{d.Hour}")
                    .ToDictionary(g => g.Key, g => g.Count());
                var heatmapSlots = new[]
                {
                    new { label = "0-3h", start = 0, end = 3 },
                    new { label = "4-7h", start = 4, end = 7 },
                    new { label = "8-11h", start = 8, end = 11 },
                    new { label = "12-15h", start = 12, end = 15 },
                    new { label = "16-19h", start = 16, end = 19 },
                    new { label = "20-23h", start = 20, end = 23 }
                };
                var activityHeatmap = new List<HeatmapCell>();
                for (var i = 0; i < 7; i++)
                {
                    var day = heatmapStart.AddDays(i);
                    foreach (var slot in heatmapSlots)
                    {
                        var total = 0;
                        for (var hour = slot.start; hour <= slot.end; hour++)
                        {
                            var key = $"{day:yyyy-MM-dd}-{hour}";
                            if (hourMap.TryGetValue(key, out var count))
                            {
                                total += count;
                            }
                        }
                        activityHeatmap.Add(new HeatmapCell(day.ToString("ddd", viCulture), slot.label, total));
                    }
                }

                var gradeCount = await _db.Grades.CountAsync(ct);
                double averageScore = 0;
                if (gradeCount > 0)
                {
                    averageScore = Math.Round(await _db.Grades.AverageAsync(g => g.Score, ct), 1);
                }
                var completionRate = assignmentsCount == 0 ? 0 : Math.Round((double)submissionsCount / assignmentsCount * 100d, 1);
                var overdueAssignments = await _db.Assignments.CountAsync(a => a.DueAt != null && a.DueAt < now && !a.Submissions.Any(), ct);
                var sevenDaysAgo = now.AddDays(-7);
                var topClassRaw = await _db.Submissions
                    .Where(s => s.SubmittedAt >= sevenDaysAgo)
                    .GroupBy(s => new { s.Assignment!.ClassroomId, s.Assignment.Classroom!.Name })
                    .Select(g => new { g.Key.ClassroomId, g.Key.Name, Count = g.Count() })
                    .OrderByDescending(g => g.Count)
                    .FirstOrDefaultAsync(ct);
                var mostActiveClass = topClassRaw != null
                    ? new MostActiveClass(topClassRaw.ClassroomId, topClassRaw.Name, topClassRaw.Count)
                    : null;

                totals = new OverviewTotals(users, classes, assignmentsCount, submissionsCount, dailyVisits, weeklyVisits, growthRate);
                charts = new OverviewCharts(submissionsPerMonth, loginsPerWeek, roleDistribution, activityHeatmap);
                quality = new OverviewQuality(averageScore, completionRate, overdueAssignments, mostActiveClass);

                if (_shouldCacheOverview && _overviewCacheDuration > TimeSpan.Zero)
                {
                    var cachePayload = new OverviewCachePayload(totals, charts, quality);
                    var serialized = JsonSerializer.Serialize(cachePayload, _jsonOptions);
                    var cacheOptions = new DistributedCacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow = _overviewCacheDuration
                    };
                    await _cache.SetStringAsync(OverviewCacheKey, serialized, cacheOptions, ct);
                }
            }

            var activitiesList = await _activityStream.GetRecentAsync(20, ct);
            var activities = activitiesList
                .OrderByDescending(a => a.Timestamp)
                .Select(a => new
                {
                    a.Type,
                    a.Actor,
                    a.Action,
                    a.Context,
                    timestamp = a.Timestamp
                })
                .ToList();

            return Ok(new
            {
                totals,
                charts,
                activities,
                quality
            });
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpGet("users")]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _db.Users
                .OrderByDescending(u => u.CreatedAt)
                .Select(u => new { u.Id, u.Email, u.FullName, u.SystemRole, u.IsActive, u.CreatedAt })
                .ToListAsync();
            return Ok(users);
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost("users")]
        public async Task<IActionResult> CreateUser(AdminCreateUserDto dto)
        {
            var email = dto.Email.Trim().ToLower();
            if (await _db.Users.AnyAsync(u => u.Email == email))
            {
                return Conflict("Email đã tồn tại.");
            }
            var user = new User
            {
                Email = email,
                FullName = dto.FullName.Trim(),
                SystemRole = dto.SystemRole.Trim(),
                Provider = "local",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Avatar = "/images/default-avatar.png"
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();
            return Ok(new { user.Id, user.Email, user.FullName, user.SystemRole, user.IsActive });
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPut("users/{id:guid}")]
        public async Task<IActionResult> UpdateUser(Guid id, AdminUpdateUserDto dto)
        {
            var user = await _db.Users.FindAsync(id);
            if (user == null) return NotFound();
            user.FullName = dto.FullName.Trim();
            user.SystemRole = dto.SystemRole.Trim();
            if (dto.IsActive.HasValue) user.IsActive = dto.IsActive.Value;
            await _db.SaveChangesAsync();
            return Ok(new { user.Id, user.FullName, user.SystemRole, user.IsActive });
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost("users/{id:guid}/toggle-active")]
        public async Task<IActionResult> ToggleUserActive(Guid id)
        {
            var u = await _db.Users.FindAsync(id);
            if (u == null) return NotFound();
            u.IsActive = !u.IsActive;
            await _db.SaveChangesAsync();
            return Ok(new { u.Id, u.IsActive });
        }

        private static string PickBanner()
        {
            var bannerList = new[]
            {
                "/images/banners/banner-1.svg",
                "/images/banners/banner-2.svg",
                "/images/banners/banner-3.svg",
                "/images/banners/banner-4.svg",
            };
            var rand = new Random();
            return bannerList[rand.Next(bannerList.Length)];
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpGet("classes")]
        public async Task<IActionResult> GetClasses()
        {
            var data = await _db.Classrooms
                .Include(c => c.Teacher)
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => new
                {
                    c.Id,
                    c.Name,
                    c.Description,
                    c.Section,
                    c.Room,
                    c.Schedule,
                    c.TeacherId,
                    teacherName = c.Teacher != null ? c.Teacher.FullName : "",
                    c.CreatedAt
                })
                .ToListAsync();
            return Ok(data);
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpGet("classes/{id:guid}/detail")]
        public async Task<IActionResult> GetClassDetail(Guid id)
        {
            var classroom = await _db.Classrooms
                .Include(c => c.Teacher)
                .Include(c => c.Enrollments)
                    .ThenInclude(e => e.User)
                .FirstOrDefaultAsync(c => c.Id == id);
            if (classroom == null) return NotFound();

            var members = classroom.Enrollments
                .OrderBy(e => e.Role)
                .Select(e => new
                {
                    e.UserId,
                    FullName = e.User!.FullName,
                    Email = e.User.Email,
                    e.Role
                })
                .ToList();

            return Ok(new
            {
                classroom.Id,
                classroom.Name,
                classroom.Description,
                classroom.Section,
                classroom.Room,
                classroom.Schedule,
                classroom.InviteCode,
                classroom.TeacherId,
                TeacherName = classroom.Teacher?.FullName ?? "",
                MembersCount = members.Count,
                Members = members
            });
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost("classes")]
        public async Task<IActionResult> CreateClass(AdminUpsertClassDto dto)
        {
            var teacher = await _db.Users.FirstOrDefaultAsync(u => u.Id == dto.TeacherId);
            if (teacher == null) return BadRequest("Teacher không tồn tại.");

            var classroom = new Classroom
            {
                Name = dto.Name.Trim(),
                Description = dto.Description,
                Section = dto.Section,
                Room = dto.Room,
                Schedule = dto.Schedule,
                TeacherId = dto.TeacherId,
                InviteCode = Guid.NewGuid().ToString("N")[..6].ToUpper(),
                BannerUrl = PickBanner()
            };
            _db.Classrooms.Add(classroom);
            _db.Enrollments.Add(new Enrollment { ClassroomId = classroom.Id, UserId = dto.TeacherId, Role = "Teacher" });
            await _db.SaveChangesAsync();
            await PublishActivity("class", teacher.FullName ?? "Giáo viên", $"tạo lớp {classroom.Name}", dto.Section);
            return Ok(new { classroom.Id, classroom.Name, classroom.TeacherId });
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPut("classes/{id:guid}")]
        public async Task<IActionResult> UpdateClass(Guid id, AdminUpsertClassDto dto)
        {
            var classroom = await _db.Classrooms.Include(c => c.Enrollments).FirstOrDefaultAsync(c => c.Id == id);
            if (classroom == null) return NotFound();
            var teacher = await _db.Users.FindAsync(dto.TeacherId);
            if (teacher == null) return BadRequest("Teacher không tồn tại.");

            if (dto.TeacherId != classroom.TeacherId)
            {
                var prev = classroom.Enrollments.FirstOrDefault(e => e.UserId == classroom.TeacherId);
                if (prev != null) prev.Role = "Student";

                var newTeacherEnroll = classroom.Enrollments.FirstOrDefault(e => e.UserId == dto.TeacherId);
                if (newTeacherEnroll == null)
                {
                    classroom.Enrollments.Add(new Enrollment { ClassroomId = classroom.Id, UserId = dto.TeacherId, Role = "Teacher" });
                }
                else
                {
                    newTeacherEnroll.Role = "Teacher";
                }
                classroom.TeacherId = dto.TeacherId;
            }

            classroom.Name = dto.Name.Trim();
            classroom.Description = dto.Description;
            classroom.Section = dto.Section;
            classroom.Room = dto.Room;
            classroom.Schedule = dto.Schedule;
            classroom.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { classroom.Id, classroom.Name, classroom.TeacherId });
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpDelete("classes/{id:guid}")]
        public async Task<IActionResult> DeleteClass(Guid id)
        {
            var c = await _db.Classrooms.FindAsync(id);
            if (c == null) return NotFound();
            _db.Classrooms.Remove(c);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpGet("classes/{id:guid}/assignments")]
        public async Task<IActionResult> GetAssignmentsForClass(Guid id)
        {
            var assignments = await _db.Assignments
                .Where(a => a.ClassroomId == id)
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new
                {
                    a.Id,
                    a.Title,
                    a.Instructions,
                    a.MaxPoints,
                    DueAt = a.DueAt,
                    a.CreatedAt
                })
                .ToListAsync();
            return Ok(assignments);
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost("classes/{id:guid}/assignments")]
        public async Task<IActionResult> CreateAssignmentForClass(Guid id, AdminAssignmentDto dto)
        {
            var classroom = await _db.Classrooms.Include(c => c.Teacher).FirstOrDefaultAsync(c => c.Id == id);
            if (classroom == null) return NotFound("Classroom không tồn tại.");

            var assignment = new Assignment
            {
                ClassroomId = classroom.Id,
                Title = dto.Title.Trim(),
                Instructions = dto.Instructions,
                DueAt = dto.DueAt?.ToUniversalTime(),
                MaxPoints = dto.MaxPoints,
                CreatedBy = classroom.TeacherId
            };
            _db.Assignments.Add(assignment);
            await _db.SaveChangesAsync();
            await PublishActivity("assignment", classroom.Teacher?.FullName ?? "Giáo viên", $"tạo bài tập \"{assignment.Title}\"", classroom.Name ?? string.Empty);

            var studentIds = await _db.Enrollments
                .Where(e => e.ClassroomId == classroom.Id && e.Role == "Student")
                .Select(e => e.UserId)
                .ToListAsync();
            if (studentIds.Any())
            {
                await _dispatcher.DispatchAsync(studentIds, "Bài tập mới", $"\"{assignment.Title}\" vừa được đăng.", "assignment", classroom.Id, assignment.Id);
            }
            return Ok(new { assignment.Id, assignment.Title });
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPut("assignments/{id:guid}")]
        public async Task<IActionResult> UpdateAssignment(Guid id, AdminAssignmentDto dto)
        {
            var assignment = await _db.Assignments
                .Include(a => a.Classroom)
                    .ThenInclude(c => c.Teacher)
                .FirstOrDefaultAsync(a => a.Id == id);
            if (assignment == null) return NotFound();
            assignment.Title = dto.Title.Trim();
            assignment.Instructions = dto.Instructions;
            assignment.DueAt = dto.DueAt?.ToUniversalTime();
            assignment.MaxPoints = dto.MaxPoints;
            assignment.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await PublishActivity("assignment",
                assignment.Classroom?.Teacher?.FullName ?? "Admin",
                $"cập nhật bài tập \"{assignment.Title}\"",
                assignment.Classroom?.Name ?? string.Empty);
            return Ok(new { assignment.Id, assignment.Title });
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpDelete("assignments/{id:guid}")]
        public async Task<IActionResult> DeleteAssignment(Guid id)
        {
            var assignment = await _db.Assignments
                .Include(a => a.Classroom)
                    .ThenInclude(c => c.Teacher)
                .FirstOrDefaultAsync(a => a.Id == id);
            if (assignment == null) return NotFound();
            _db.Assignments.Remove(assignment);
            await _db.SaveChangesAsync();
            await PublishActivity("assignment",
                assignment.Classroom?.Teacher?.FullName ?? "Admin",
                $"xoá bài tập \"{assignment.Title}\"",
                assignment.Classroom?.Name ?? string.Empty);
            return NoContent();
        }

        private static DateTime StartOfWeek(DateTime date)
        {
            var diff = (7 + (int)date.DayOfWeek - (int)DayOfWeek.Monday) % 7;
            return date.Date.AddDays(-diff);
        }

        private Task PublishActivity(string type, string actor, string action, string? context)
        {
            return _activityStream.PublishAsync(new ActivityEvent(type, actor, action, context, DateTime.UtcNow));
        }

        private sealed record OverviewCachePayload(OverviewTotals Totals, OverviewCharts Charts, OverviewQuality Quality);
        private sealed record OverviewTotals(int Users, int Classes, int Assignments, int Submissions, int DailyVisits, int WeeklyVisits, double GrowthRate);
        private sealed record LabelValue(string Label, int Value);
        private sealed record HeatmapCell(string Day, string Slot, int Value);
        private sealed record OverviewCharts(List<LabelValue> SubmissionsPerMonth, List<LabelValue> LoginsPerWeek, List<LabelValue> RoleDistribution, List<HeatmapCell> ActivityHeatmap);
        private sealed record OverviewQuality(double AverageScore, double CompletionRate, int OverdueAssignments, MostActiveClass? MostActiveClass);
        private sealed record MostActiveClass(Guid Id, string Name, int Submissions);
    }
}
