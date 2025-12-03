using class_api.Application.Interfaces;
using class_api.Infrastructure.Data;
using class_api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace class_api.Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
        {
            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseSqlServer(configuration.GetConnectionString("DefaultConnection")));

            services.AddScoped<IStorage, AzureStorage>();
            services.AddScoped<IJwtService, JwtService>();
            services.AddScoped<INotificationDispatcher, RabbitNotificationDispatcher>();
            services.AddHostedService<AssignmentDueReminderService>();

            return services;
        }
    }
}
