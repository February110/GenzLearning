using class_api.Infrastructure.Data;
using class_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace class_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUser _me;

        public NotificationsController(ApplicationDbContext db, ICurrentUser me)
        {
            _db = db;
            _me = me;
        }

        [HttpGet]
        public async Task<IActionResult> GetMyNotifications(int take = 20)
        {
            var userId = _me.UserId;
            if (userId == Guid.Empty) return Unauthorized();
            take = Math.Clamp(take, 5, 100);

            var items = await _db.Notifications
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(take)
                .Select(n => new
                {
                    n.Id,
                    n.Title,
                    n.Message,
                    n.Type,
                    n.IsRead,
                    n.ClassroomId,
                    n.AssignmentId,
                    n.CreatedAt
                })
                .ToListAsync();

            var unread = await _db.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead);

            return Ok(new { unread, items });
        }

        [HttpPost("{id:guid}/read")]
        public async Task<IActionResult> MarkRead(Guid id)
        {
            var userId = _me.UserId;
            var notif = await _db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
            if (notif == null) return NotFound();
            if (!notif.IsRead)
            {
                notif.IsRead = true;
                notif.ReadAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }
            return Ok();
        }

        [HttpPost("read-all")]
        public async Task<IActionResult> MarkAllRead()
        {
            var userId = _me.UserId;
            var unread = await _db.Notifications.Where(n => n.UserId == userId && !n.IsRead).ToListAsync();
            foreach (var n in unread)
            {
                n.IsRead = true;
                n.ReadAt = DateTime.UtcNow;
            }
            await _db.SaveChangesAsync();
            return Ok();
        }
    }
}
