namespace class_api.Dtos
{
    public record GradeDto(double Grade, string? Feedback, string Status = "graded");
}
