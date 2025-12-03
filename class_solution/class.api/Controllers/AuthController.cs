using class_api.Infrastructure.Data;
using class_api.Domain;
using class_api.Application.Dtos;
using class_api.Services;
using class_api.Application.Interfaces;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace class_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IJwtService _jwt;
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _httpFactory;
        private readonly IActivityStream _activityStream;

        public AuthController(ApplicationDbContext db, IJwtService jwt, IConfiguration config, IHttpClientFactory httpFactory, IActivityStream activityStream)
        {
            _db = db;
            _jwt = jwt;
            _config = config;
            _httpFactory = httpFactory;
            _activityStream = activityStream;
        }
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
                return BadRequest(new { message = "Email và mật khẩu là bắt buộc." });

            var email = dto.Email.Trim().ToLower();

            if (await _db.Users.AnyAsync(u => u.Email == email))
                return BadRequest(new { message = "Email đã được sử dụng." });

            var user = new User
            {
                Email = email,
                FullName = dto.FullName.Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Avatar = $"https://api.dicebear.com/9.x/initials/svg?seed={Uri.EscapeDataString(dto.FullName)}",
                Provider = "local",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                LastLoginAt = DateTime.UtcNow,
                SystemRole = "User"
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();
            await PublishActivity("register", user.FullName, "đăng ký tài khoản", user.Email);

            user.UpdatedAt = DateTime.UtcNow;
            user.LastLoginAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await PublishActivity("login", user.FullName, "đăng nhập thành công", user.Email);
            var token = _jwt.GenerateToken(user);

            return Ok(new
            {
                accessToken = token,
                id = user.Id,
                fullName = user.FullName,
                email = user.Email,
                avatar = user.Avatar,
                systemRole = user.SystemRole
            });
        }
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            var email = dto.Email.Trim().ToLower();
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

            if (user == null)
                return Unauthorized(new { message = "Không tìm thấy tài khoản." });

            if (!user.IsActive)
                return Unauthorized(new { message = "Tài khoản đã bị khoá, liên hệ quản trị viên." });

            if (user.Provider != "local")
                return Unauthorized(new { message = $"Tài khoản này đăng nhập bằng {user.Provider}, vui lòng chọn '{user.Provider}' trên màn hình đăng nhập." });

            if (string.IsNullOrWhiteSpace(user.PasswordHash) ||
                !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                return Unauthorized(new { message = "Sai mật khẩu." });

            user.LastLoginAt = DateTime.UtcNow;
            user.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await PublishActivity("login", user.FullName, "đăng nhập thành công", user.Email);
            var token = _jwt.GenerateToken(user);

            return Ok(new
            {
                accessToken = token,
                id = user.Id,
                fullName = user.FullName,
                email = user.Email,
                avatar = user.Avatar,
                systemRole = user.SystemRole
            });
        }
        [HttpPost("sync")]
        public async Task<IActionResult> SyncOAuthUser([FromBody] OAuthUserDto dto)
        {
            if (string.IsNullOrEmpty(dto.Email))
                return BadRequest(new { message = "Email không hợp lệ." });

            var email = dto.Email.Trim().ToLower();
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

            if (user == null)
            {
                user = new User
                {
                    Email = email,
                    FullName = dto.FullName,
                    Avatar = dto.Avatar,
                    Provider = dto.Provider,
                    ProviderId = dto.ProviderId,
                    SystemRole = "User",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    LastLoginAt = DateTime.UtcNow
                };
                _db.Users.Add(user);
                await _db.SaveChangesAsync();
                await PublishActivity("register", user.FullName, "đăng ký tài khoản", user.Email);
            }
            else
            {
                user.FullName = dto.FullName;
                user.Avatar = dto.Avatar ?? user.Avatar;
                user.Provider = dto.Provider;
                user.ProviderId = dto.ProviderId;
                user.UpdatedAt = DateTime.UtcNow;
                user.LastLoginAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }

            await PublishActivity("login", user.FullName, "đăng nhập thành công", user.Email);
            var token = _jwt.GenerateToken(user);

            return Ok(new
            {
                accessToken = token,
                fullName = user.FullName,
                email = user.Email,
                avatar = user.Avatar,
                provider = user.Provider,
                systemRole = user.SystemRole
            });
        }


        [HttpGet("me")]
        public async Task<IActionResult> GetProfile()
        {
            var userIdClaim = User.FindFirst("id")?.Value;
            if (userIdClaim == null)
                return Unauthorized(new { message = "Token không hợp lệ." });

            var userId = Guid.Parse(userIdClaim);
            var user = await _db.Users.FindAsync(userId);

            if (user == null)
                return NotFound(new { message = "Không tìm thấy người dùng." });

            if (!user.IsActive)
                return Unauthorized(new { message = "Tài khoản bị khoá." });

            return Ok(new
            {
                id = user.Id,
                email = user.Email,
                fullName = user.FullName,
                avatar = user.Avatar,
                provider = user.Provider,
                systemRole = user.SystemRole,
                createdAt = user.CreatedAt
            });
        }

        [HttpPut("profile")]
        [Authorize]
        public async Task<IActionResult> UpdateProfile([FromForm] UpdateProfileDto dto)
        {
            var userIdClaim = User.FindFirst("id")?.Value;
            if (userIdClaim == null)
                return Unauthorized(new { message = "Token không hợp lệ." });

            var userId = Guid.Parse(userIdClaim);
            var user = await _db.Users.FindAsync(userId);
            if (user == null)
                return NotFound(new { message = "Không tìm thấy người dùng." });

            if (!string.IsNullOrEmpty(dto.FullName))
                user.FullName = dto.FullName;

            if (dto.Avatar != null)
            {
                var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/uploads");
                if (!Directory.Exists(uploadsPath))
                    Directory.CreateDirectory(uploadsPath);

                var fileName = $"{Guid.NewGuid()}{Path.GetExtension(dto.Avatar.FileName)}";
                var filePath = Path.Combine(uploadsPath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await dto.Avatar.CopyToAsync(stream);
                }

                user.Avatar = $"/uploads/{fileName}";
            }

            _db.Users.Update(user);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "Cập nhật hồ sơ thành công",
                user = new
                {
                    id = user.Id,
                    email = user.Email,
                    fullName = user.FullName,
                    avatar = user.Avatar
                }
            });
        }

        public class UpdateProfileDto
        {
            public string? FullName { get; set; }
            public IFormFile? Avatar { get; set; }
        }

        private Task PublishActivity(string type, string actor, string action, string? context)
        {
            return _activityStream.PublishAsync(new ActivityEvent(type, actor, action, context, DateTime.UtcNow));
        }
    }
}
