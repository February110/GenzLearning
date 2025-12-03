namespace class_api.Application.Dtos
{
    public record CreateAssignmentDto(
       Guid ClassroomId,
       string Title,
       string? Instructions,
       DateTime? DueAt,
       int MaxPoints = 100
   );
}
