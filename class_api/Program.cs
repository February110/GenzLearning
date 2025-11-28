using class_api.Data;
using class_api.Filters;
using class_api.Services;
using class_api.Hubs;
using class_api.Options;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using class_api.Json;
using StackExchange.Redis;
using RabbitMQ.Client;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

var redisConfiguration = builder.Configuration.GetConnectionString("Redis") ?? builder.Configuration["Redis:Configuration"];
if (!string.IsNullOrWhiteSpace(redisConfiguration))
{
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = redisConfiguration;
        options.InstanceName = builder.Configuration["Redis:InstanceName"] ?? "class:";
    });
    builder.Services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(redisConfiguration));
}
else
{
    builder.Services.AddDistributedMemoryCache();
}

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddScoped<IStorage, AzureStorage>();
builder.Services.AddHttpClient();
builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.Converters.Add(new DateTimeUtcConverter());
    o.JsonSerializerOptions.Converters.Add(new NullableDateTimeUtcConverter());
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddScoped<JwtService>();
var key = Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]);

builder.Services.AddSignalR();
builder.Services.AddHttpClient();
builder.Services.AddSingleton<IActivityStream, ActivityStream>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddHostedService<AssignmentDueReminderService>();
builder.Services.Configure<RabbitMqOptions>(builder.Configuration.GetSection("RabbitMQ"));
var rabbitSection = builder.Configuration.GetSection("RabbitMQ").Get<RabbitMqOptions>();
if (rabbitSection is null || !rabbitSection.Enabled)
{
    throw new InvalidOperationException("RabbitMQ configuration is required. Please provide RabbitMQ settings in appsettings or environment variables.");
}

builder.Services.AddSingleton<IConnection>(_ =>
{
    var factory = new ConnectionFactory
    {
        HostName = rabbitSection.HostName,
        Port = rabbitSection.Port,
        UserName = rabbitSection.UserName,
        Password = rabbitSection.Password
    };
    return factory.CreateConnection();
});
builder.Services.AddScoped<INotificationDispatcher, RabbitNotificationDispatcher>();
builder.Services.Configure<WorkerAuthOptions>(builder.Configuration.GetSection("WorkerAuth"));

builder.Services.AddAuthentication("Bearer")
   .AddJwtBearer(opt =>
   {
       var key = Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]);
       opt.TokenValidationParameters = new TokenValidationParameters
       {
           ValidateIssuer = true,
           ValidateAudience = true,
           ValidateLifetime = true,
           ValidateIssuerSigningKey = true,
           ValidIssuer = builder.Configuration["Jwt:Issuer"],
           ValidAudience = builder.Configuration["Jwt:Audience"],
           IssuerSigningKey = new SymmetricSecurityKey(key)
       };

       opt.Events = new JwtBearerEvents
       {
           OnAuthenticationFailed = ctx =>
           {
               Console.WriteLine($"❌ JWT invalid: {ctx.Exception.Message}");
               return Task.CompletedTask;
           },
           OnTokenValidated = ctx =>
           {
               Console.WriteLine("✅ JWT validated successfully");
               return Task.CompletedTask;
           },
           OnMessageReceived = ctx =>
           {
               var accessToken = ctx.Request.Query["access_token"];
               var path = ctx.HttpContext.Request.Path;
               if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
               {
                   ctx.Token = accessToken;
               }
               return Task.CompletedTask;
           }
       };
   });


builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
        policy.RequireClaim("systemRole", "Admin"));
});

builder.Services.AddCors(o =>
{
    o.AddPolicy("app", p =>
        p.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>())
         .AllowAnyHeader()
         .AllowAnyMethod()
         .AllowCredentials());
});
builder.Services.AddControllers(options =>
{
    options.Filters.Add<ApiExceptionFilter>();
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowNextJS",
        b => b
            .WithOrigins("http://localhost:3000") 
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()); 
});
builder.Configuration
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true);
    
    if (builder.Environment.IsEnvironment("Docker"))
    {
        builder.Configuration.AddJsonFile("appsettings.Docker.json", optional: true, reloadOnChange: true);
    }

builder.Configuration.AddEnvironmentVariables();

var app = builder.Build();
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    DbSeeder.SeedAdmin(db);
}
app.UseSwagger();
app.UseSwaggerUI();
app.UseStaticFiles();
app.UseCors("AllowNextJS");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ClassroomHub>("/hubs/classroom");
app.MapHub<MeetingHub>("/hubs/meeting");
app.MapHub<NotificationHub>("/hubs/notifications");
app.MapHub<ActivityHub>("/hubs/activity");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

app.Run();
