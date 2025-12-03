namespace class_api.Application.Dtos
{
    public record NotificationDto(Guid Id, string Title, string Message, string Type, Guid? ClassroomId, Guid? AssignmentId, bool IsRead, DateTime CreatedAt);
}
