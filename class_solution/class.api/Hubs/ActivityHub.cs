using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace class_api.Hubs
{
    [Authorize(Policy = "AdminOnly")]
    public class ActivityHub : Hub
    {
    }
}
