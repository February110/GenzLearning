using System.Text;
using System.Text.Json;
using class_api.Options;
using class_shared;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;

namespace class_api.Services
{
    public interface INotificationDispatcher
    {
        Task DispatchAsync(IEnumerable<Guid> userIds, string title, string message, string type, Guid? classroomId = null, Guid? assignmentId = null, object? metadata = null, CancellationToken cancellationToken = default);
    }

    public sealed class RabbitNotificationDispatcher : INotificationDispatcher
    {
        private readonly IConnection _connection;
        private readonly RabbitMqOptions _options;
        private readonly JsonSerializerOptions _serializerOptions;
        private readonly ILogger<RabbitNotificationDispatcher> _logger;

        public RabbitNotificationDispatcher(IConnection connection, IOptions<RabbitMqOptions> options, ILogger<RabbitNotificationDispatcher> logger)
        {
            _connection = connection;
            _logger = logger;
            _options = options.Value;
            _serializerOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        }

        public Task DispatchAsync(IEnumerable<Guid> userIds, string title, string message, string type, Guid? classroomId = null, Guid? assignmentId = null, object? metadata = null, CancellationToken cancellationToken = default)
        {
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
                using var channel = _connection.CreateModel();
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
