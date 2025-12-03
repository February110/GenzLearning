using System.Security.Claims;
using class_api.Application.Interfaces;

namespace class_api.Services
{
    public sealed class CurrentUser : ICurrentUser
    {
        private readonly IHttpContextAccessor _http;

        public CurrentUser(IHttpContextAccessor http) => _http = http;

        public bool IsAuthenticated => _http.HttpContext?.User?.Identity?.IsAuthenticated == true;

        public Guid UserId
        {
            get
            {
                var raw = _http.HttpContext?.User?.FindFirst("id")?.Value
                          ?? _http.HttpContext?.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                return Guid.TryParse(raw, out var id) ? id : Guid.Empty;
            }
        }

        public string Email => _http.HttpContext?.User?.FindFirst(ClaimTypes.Email)?.Value ?? string.Empty;
    }
}
