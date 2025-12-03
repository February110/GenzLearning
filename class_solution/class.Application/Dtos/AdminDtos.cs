using System.ComponentModel.DataAnnotations;

namespace class_api.Application.Dtos
{
    public class AdminCreateUserDto
    {
        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;
        [Required]
        public string FullName { get; set; } = string.Empty;
        [Required, MinLength(6)]
        public string Password { get; set; } = string.Empty;
        [Required]
        public string SystemRole { get; set; } = "User";
    }

    public class AdminUpdateUserDto
    {
        [Required]
        public string FullName { get; set; } = string.Empty;
        [Required]
        public string SystemRole { get; set; } = "User";
        public bool? IsActive { get; set; }
    }

    public class AdminUpsertClassDto
    {
        [Required]
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Section { get; set; }
        public string? Room { get; set; }
        public string? Schedule { get; set; }
        [Required]
        public Guid TeacherId { get; set; }
    }

    public class AdminAssignmentDto
    {
        [Required]
        public string Title { get; set; } = string.Empty;
        public string? Instructions { get; set; }
        public DateTime? DueAt { get; set; }
        [Range(1, int.MaxValue)]
        public int MaxPoints { get; set; } = 100;
    }
}
