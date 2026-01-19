namespace class_api.Application.Dtos
{
    public record UpdateAssignmentDto(
        string Title,
        string? Instructions,
        System.DateTime? DueAt,
        int MaxPoints = 100,
        string? AllowedFileTypes = null,
        int? MaxFileSizeMb = null,
        bool GroupEnabled = false,
        int? GroupMinMembers = null,
        int? GroupMaxMembers = null
    );
}

