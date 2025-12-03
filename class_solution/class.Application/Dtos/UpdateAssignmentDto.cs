namespace class_api.Application.Dtos
{
    public record UpdateAssignmentDto(
        string Title,
        string? Instructions,
        System.DateTime? DueAt,
        int MaxPoints = 100
    );
}

