namespace class_api.Application.Dtos
{
    public record GradeDto(double Grade, string? Feedback, string Status = "graded");
}
