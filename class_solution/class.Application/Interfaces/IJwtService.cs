using class_api.Domain;

namespace class_api.Application.Interfaces
{
    public interface IJwtService
    {
        string GenerateToken(User user);
    }
}
