namespace class_api.Application.Interfaces
{
    public interface ICurrentUser
    {
        Guid UserId { get; }
        string Email { get; }
        bool IsAuthenticated { get; }
    }
}
