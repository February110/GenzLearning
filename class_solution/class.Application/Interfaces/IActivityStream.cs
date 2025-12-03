using class_api.Application.Dtos;

namespace class_api.Application.Interfaces
{
    public interface IActivityStream
    {
        Task PublishAsync(ActivityEvent payload, CancellationToken cancellationToken = default);
        Task<IReadOnlyList<ActivityEvent>> GetRecentAsync(int take, CancellationToken cancellationToken = default);
    }
}
