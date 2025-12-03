using class_api.Options;
using class_api.Services;
using class_shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using System.Text.Json;

namespace class_api.Controllers
{
    [ApiController]
    [Route("api/internal/notifications")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public class InternalNotificationsController : ControllerBase
    {
        private readonly INotificationService _notifications;
        private readonly WorkerAuthOptions _authOptions;

        public InternalNotificationsController(INotificationService notifications, IOptions<WorkerAuthOptions> authOptions)
        {
            _notifications = notifications;
            _authOptions = authOptions.Value;
        }

        [HttpPost("deliver")]
        public async Task<IActionResult> Deliver([FromBody] NotificationQueueMessage payload, [FromHeader(Name = "X-Worker-Key")] string? workerKey, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(_authOptions.ApiKey))
                return StatusCode(503, "Worker authentication is not configured.");

            if (!string.Equals(workerKey, _authOptions.ApiKey, StringComparison.Ordinal))
                return Unauthorized();

            if (payload.UserIds == null || payload.UserIds.Count == 0)
                return BadRequest("UserIds required.");

            object? metadata = null;
            if (!string.IsNullOrEmpty(payload.MetadataJson))
            {
                metadata = JsonSerializer.Deserialize<JsonElement>(payload.MetadataJson);
            }

            await _notifications.NotifyUsersAsync(payload.UserIds, payload.Title, payload.Message, payload.Type, payload.ClassroomId, payload.AssignmentId, metadata, ct);
            return Ok(new { delivered = payload.UserIds.Count });
        }
    }
}
