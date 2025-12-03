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
    public class UsersController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUser _me;

        public UsersController(ApplicationDbContext db, ICurrentUser me)
        {
            _db = db;
            _me = me;
        }

        [HttpGet("me")]
        public async Task<IActionResult> GetProfile()
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == _me.UserId);
            if (user == null) return NotFound();
            return Ok(new
            {
                user.Id,
                user.Email,
                user.FullName,
                user.Avatar,
                user.SystemRole,
                user.CreatedAt
            });
        }

        [HttpPut("me")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == _me.UserId);
            if (user == null) return NotFound();

            user.FullName = dto.FullName ?? user.FullName;
            user.Avatar = dto.Avatar ?? user.Avatar;
            user.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return Ok(new { message = "Profile updated" });
        }
    }

    public record UpdateProfileDto(string? FullName, string? Avatar);
}
