namespace class_api.Application.Interfaces
{
    public interface INotificationDispatcher
    {
        Task DispatchAsync(IEnumerable<Guid> userIds, string title, string message, string type, Guid? classroomId = null, Guid? assignmentId = null, object? metadata = null, CancellationToken cancellationToken = default);
    }
}
