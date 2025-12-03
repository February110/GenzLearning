namespace class_api.Application.Interfaces
{
    public interface INotificationService
    {
        Task NotifyUsersAsync(IEnumerable<Guid> userIds, string title, string message, string type, Guid? classroomId = null, Guid? assignmentId = null, object? metadata = null, CancellationToken ct = default);
        Task NotifyUserAsync(Guid userId, string title, string message, string type, Guid? classroomId = null, Guid? assignmentId = null, object? metadata = null, CancellationToken ct = default);
    }
}
