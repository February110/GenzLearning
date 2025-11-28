namespace class_api.Dtos
{
    public record UpdateAssignmentDto(
        string Title,
        string? Instructions,
        System.DateTime? DueAt,
        int MaxPoints = 100
    );
}

