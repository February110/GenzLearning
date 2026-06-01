using System.Text;
using System.Text.Json;
using class_api.Application.Interfaces;
using class_api.Options;
using class_shared;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;

namespace class_api.Services
{
    public sealed class RabbitNotificationDispatcher : INotificationDispatcher
    {
        private readonly RabbitMqOptions _options;
        private readonly JsonSerializerOptions _serializerOptions;
        private readonly ILogger<RabbitNotificationDispatcher> _logger;

        public RabbitNotificationDispatcher(IOptions<RabbitMqOptions> options, ILogger<RabbitNotificationDispatcher> logger)
        {
            _logger = logger;
            _options = options.Value;
            _serializerOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        }

        public Task DispatchAsync(IEnumerable<Guid> userIds, string title, string message, string type, Guid? classroomId = null, Guid? assignmentId = null, object? metadata = null, CancellationToken cancellationToken = default)
        {
            if (!_options.Enabled || string.IsNullOrWhiteSpace(_options.HostName))
            {
                _logger.LogWarning("RabbitMQ is not configured. Notification dispatch skipped.");
                throw new InvalidOperationException("RabbitMQ is not configured.");
            }

            var payload = new NotificationQueueMessage
            {
                UserIds = userIds.Distinct().ToList(),
                Title = title,
                Message = message,
                Type = type,
                ClassroomId = classroomId,
                AssignmentId = assignmentId,
                MetadataJson = metadata != null ? JsonSerializer.Serialize(metadata, _serializerOptions) : null
            };

            try
            {
                var factory = new ConnectionFactory
                {
                    HostName = _options.HostName,
                    Port = _options.Port,
                    UserName = _options.UserName,
                    Password = _options.Password
                };

                using var connection = factory.CreateConnection();
                using var channel = connection.CreateModel();
                channel.QueueDeclare(queue: _options.QueueName, durable: true, exclusive: false, autoDelete: false);
                var body = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload, _serializerOptions));
                var props = channel.CreateBasicProperties();
                props.Persistent = true;
                channel.BasicPublish(exchange: string.Empty, routingKey: _options.QueueName, basicProperties: props, body: body);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to publish notification message to RabbitMQ");
                throw;
            }

            return Task.CompletedTask;
        }
    }
}
