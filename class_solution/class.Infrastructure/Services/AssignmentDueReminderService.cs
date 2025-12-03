using class_api.Application.Interfaces;
using class_api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace class_api.Services
{
    public class AssignmentDueReminderService : BackgroundService
    {
        private readonly IServiceProvider _provider;
        private readonly ILogger<AssignmentDueReminderService> _logger;

        public AssignmentDueReminderService(IServiceProvider provider, ILogger<AssignmentDueReminderService> logger)
        {
            _provider = provider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _provider.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    var dispatcher = scope.ServiceProvider.GetRequiredService<INotificationDispatcher>();

                    var now = DateTime.UtcNow;
                    var dueWindow = now.AddHours(24);

                    var assignments = await db.Assignments
                        .Where(a => a.DueAt != null && a.DueAt > now && a.DueAt <= dueWindow)
                        .Select(a => new
                        {
                            a.Id,
                            a.Title,
                            a.ClassroomId,
                            a.DueAt
                        })
                        .ToListAsync(stoppingToken);

                    foreach (var assignment in assignments)
                    {
                        var alreadyNotified = await db.Notifications.AnyAsync(n => n.AssignmentId == assignment.Id && n.Type == "assignment-due", stoppingToken);
                        if (alreadyNotified) continue;

                        var studentIds = await db.Enrollments
                            .Where(e => e.ClassroomId == assignment.ClassroomId && e.Role == "Student")
                            .Select(e => e.UserId)
                            .ToListAsync(stoppingToken);

                        if (studentIds.Any())
                        {
                            var dueLocal = ConvertToVietnamTime(assignment.DueAt!.Value);
                            var message = $"Bài tập \"{assignment.Title}\" sắp đến hạn vào {dueLocal:dd/MM HH:mm}.";
                            await dispatcher.DispatchAsync(studentIds, "Bài tập sắp đến hạn", message, "assignment-due", assignment.ClassroomId, assignment.Id, null, stoppingToken);
                }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Assignment due reminder failed");
                }

                await Task.Delay(TimeSpan.FromMinutes(15), stoppingToken);
            }
        }
        private static readonly string[] VietnamTimeZoneIds = new[]
        {
            "Asia/Ho_Chi_Minh",
            "SE Asia Standard Time"
        };

        private static DateTime ConvertToVietnamTime(DateTime utc)
        {
            var normalized = DateTime.SpecifyKind(utc, DateTimeKind.Utc);
            foreach (var id in VietnamTimeZoneIds)
            {
                try
                {
                    var tz = TimeZoneInfo.FindSystemTimeZoneById(id);
                    return TimeZoneInfo.ConvertTimeFromUtc(normalized, tz);
                }
                catch (TimeZoneNotFoundException)
                {
                    continue;
                }
                catch (InvalidTimeZoneException)
                {
                    continue;
                }
            }

            return normalized.ToLocalTime();
        }
    }
}
