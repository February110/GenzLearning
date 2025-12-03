using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace class_api.Hubs
{
    [Authorize]
    public class ClassroomHub : Hub
    {
        public async Task Join(string classroomId)
        {
            if (string.IsNullOrWhiteSpace(classroomId)) return;
            await Groups.AddToGroupAsync(Context.ConnectionId, classroomId);
        }

        public async Task Leave(string classroomId)
        {
            if (string.IsNullOrWhiteSpace(classroomId)) return;
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, classroomId);
        }
    }
}

