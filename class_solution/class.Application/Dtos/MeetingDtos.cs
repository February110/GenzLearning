using System.ComponentModel.DataAnnotations;

namespace class_api.Application.Dtos
{
    public class CreateMeetingDto
    {
        [MaxLength(200)]
        public string? Title { get; set; }
    }

    public class JoinMeetingDto
    {
        [Required]
        [MaxLength(100)]
        public string RoomCode { get; set; } = default!;
    }
}
