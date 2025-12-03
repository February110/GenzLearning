using System.Collections.Concurrent;
using class_api.Infrastructure.Data;
using class_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace class_api.Hubs
{
    [Authorize]
    public class MeetingHub : Hub
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUser _me;
        private sealed class ConnectionInfo
        {
            public Guid MeetingId { get; }
            public string RoomCode { get; }
            public Guid UserId { get; }
            public string UserName { get; }
            public bool CameraOn { get; set; } = true;

            public ConnectionInfo(Guid meetingId, string roomCode, Guid userId, string userName)
            {
                MeetingId = meetingId;
                RoomCode = roomCode;
                UserId = userId;
                UserName = userName;
            }
        }

        private static readonly ConcurrentDictionary<string, ConnectionInfo> _connections = new();

        public MeetingHub(ApplicationDbContext db, ICurrentUser me)
        {
            _db = db;
            _me = me;
        }

        public async Task JoinRoom(string roomCode)
        {
            if (string.IsNullOrWhiteSpace(roomCode)) throw new HubException("ROOM_INVALID");
            var code = roomCode.Trim().ToUpperInvariant();

            var meeting = await _db.Meetings
                .Include(m => m.Classroom)
                .FirstOrDefaultAsync(m => m.RoomCode == code && m.Status == "active");
            if (meeting == null) throw new HubException("ROOM_NOT_FOUND");

            var member = await _db.Enrollments
                .AnyAsync(e => e.ClassroomId == meeting.ClassroomId && e.UserId == _me.UserId);
            if (!member) throw new HubException("NOT_IN_CLASS");

            await Groups.AddToGroupAsync(Context.ConnectionId, code);
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == _me.UserId);
            var userName = user?.FullName ?? "Người tham gia";
            _connections[Context.ConnectionId] = new ConnectionInfo(meeting.Id, code, _me.UserId, userName);

            var snapshot = _connections
                .Where(x => x.Value.RoomCode == code)
                .Select(x => new
                {
                    connectionId = x.Key,
                    x.Value.UserName,
                    userId = x.Value.UserId,
                    cameraOn = x.Value.CameraOn
                })
                .ToList();
            await Clients.Group(code).SendAsync("ParticipantsSnapshot", snapshot);

            await Clients.GroupExcept(code, Context.ConnectionId)
                .SendAsync("ParticipantJoined", new
                {
                    meetingId = meeting.Id,
                    userId = _me.UserId,
                    connectionId = Context.ConnectionId,
                    userName,
                    cameraOn = true
                });
        }

        public async Task LeaveRoom()
        {
            if (!_connections.TryRemove(Context.ConnectionId, out var info)) return;
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, info.RoomCode);
            await Clients.Group(info.RoomCode).SendAsync("ParticipantLeft", new
            {
                meetingId = info.MeetingId,
                userId = info.UserId,
                connectionId = Context.ConnectionId
            });
        }

        public async Task UpdateScreenShare(bool active, string? label)
        {
            if (!_connections.TryGetValue(Context.ConnectionId, out var info)) return;
            await Clients.Group(info.RoomCode).SendAsync("ScreenShareUpdated", new
            {
                connectionId = Context.ConnectionId,
                userId = info.UserId,
                active,
                label
            });
        }

        public async Task UpdateCameraState(bool enabled)
        {
            if (!_connections.TryGetValue(Context.ConnectionId, out var info)) return;
            info.CameraOn = enabled;
            await Clients.Group(info.RoomCode).SendAsync("CameraStateUpdated", new
            {
                connectionId = Context.ConnectionId,
                userId = info.UserId,
                enabled
            });
        }

        public Task SendOffer(string targetConnectionId, object payload)
            => Clients.Client(targetConnectionId).SendAsync("ReceiveOffer", new { from = Context.ConnectionId, payload });

        public Task SendAnswer(string targetConnectionId, object payload)
            => Clients.Client(targetConnectionId).SendAsync("ReceiveAnswer", new { from = Context.ConnectionId, payload });

        public Task SendIceCandidate(string targetConnectionId, object candidate)
            => Clients.Client(targetConnectionId).SendAsync("ReceiveIceCandidate", new { from = Context.ConnectionId, candidate });

        public async Task SendChatMessage(string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return;
            if (!_connections.TryGetValue(Context.ConnectionId, out var info)) return;
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == info.UserId);
            var name = user?.FullName ?? "Người tham gia";
            await Clients.Group(info.RoomCode).SendAsync("ReceiveChatMessage", new
            {
                message = message.Trim(),
                userId = info.UserId,
                userName = name,
                sentAt = DateTime.UtcNow
            });
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            await LeaveRoom();
            await base.OnDisconnectedAsync(exception);
        }
    }
}
