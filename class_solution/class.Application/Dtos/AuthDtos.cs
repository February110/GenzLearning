using System.ComponentModel.DataAnnotations;

namespace class_api.Application.Dtos
{
    public record RegisterDto(string Email, string Password, string FullName);
    public record LoginDto(string Email, string Password);
    public class OAuthUserDto
    {
        public string Email { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string? Avatar { get; set; }
        [MaxLength(50)]
        public string Provider { get; set; } = "local"; 
        public string? ProviderId { get; set; } 
    }
}
