using Microsoft.Extensions.DependencyInjection;

namespace class_api.Application
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddApplicationServices(this IServiceCollection services)
        {
            // register application-level services here when needed
            return services;
        }
    }
}
