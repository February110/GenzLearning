using class_api.Application.Dtos;
using class_api.Application.Interfaces;
using class_api.Infrastructure.Data;
using class_api.Domain;
using class_api.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace class_api.Services
{
    public sealed class NotificationService : INotificationService
    {
        private readonly ApplicationDbContext _db;
        private readonly IHubContext<NotificationHub> _hub;

        public NotificationService(ApplicationDbContext db, IHubContext<NotificationHub> hub)
        {
            _db = db;
            _hub = hub;
        }

        public Task NotifyUserAsync(Guid userId, string title, string message, string type, Guid? classroomId = null, Guid? assignmentId = null, object? metadata = null, CancellationToken ct = default)
        {
            return NotifyUsersAsync(new[] { userId }, title, message, type, classroomId, assignmentId, metadata, ct);
        }

        public async Task NotifyUsersAsync(IEnumerable<Guid> userIds, string title, string message, string type, Guid? classroomId = null, Guid? assignmentId = null, object? metadata = null, CancellationToken ct = default)
        {
            var users = userIds.Distinct().ToList();
            if (!users.Any()) return;

            var notifications = users.Select(uid => new Notification
            {
                UserId = uid,
                Title = title,
                Message = message,
                Type = type,
                ClassroomId = classroomId,
                AssignmentId = assignmentId,
                MetadataJson = metadata != null ? JsonSerializer.Serialize(metadata) : null
            }).ToList();

            _db.Notifications.AddRange(notifications);
            await _db.SaveChangesAsync(ct);

            foreach (var notification in notifications)
            {
                var payload = new NotificationDto(
                    notification.Id,
                    notification.Title,
                    notification.Message,
                    notification.Type,
                    notification.ClassroomId,
                    notification.AssignmentId,
                    notification.IsRead,
                    notification.CreatedAt);

                await _hub.Clients.Group($"user:{notification.UserId}").SendAsync("NotificationReceived", payload, ct);
            }
        }
    }
}
