using class_worker;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.Configure<WorkerSettings>(builder.Configuration);
builder.Services.AddSingleton(sp => sp.GetRequiredService<IOptions<WorkerSettings>>().Value);

builder.Services.AddHttpClient("api", (sp, client) =>
{
    var settings = sp.GetRequiredService<WorkerSettings>();
    client.BaseAddress = new Uri(settings.Api.BaseUrl.TrimEnd('/') + "/");
});

builder.Services.AddSingleton<IConnection>(sp =>
{
    var settings = sp.GetRequiredService<WorkerSettings>().RabbitMQ;
    var factory = new ConnectionFactory
    {
        HostName = settings.HostName,
        Port = settings.Port,
        UserName = settings.UserName,
        Password = settings.Password,
        DispatchConsumersAsync = true
    };
    return factory.CreateConnection();
});

builder.Services.AddHostedService<NotificationWorker>();

var host = builder.Build();
host.Run();
