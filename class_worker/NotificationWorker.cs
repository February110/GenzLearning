using System.Net.Http;
using System.Text;
using class_shared;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text.Json;

namespace class_worker;

public class NotificationWorker : BackgroundService
{
    private readonly ILogger<NotificationWorker> _logger;
    private readonly WorkerSettings _settings;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConnection _connection;
    private IModel? _channel;

    public NotificationWorker(ILogger<NotificationWorker> logger, IOptions<WorkerSettings> settings, IHttpClientFactory httpClientFactory, IConnection connection)
    {
        _logger = logger;
        _settings = settings.Value;
        _httpClientFactory = httpClientFactory;
        _connection = connection;

        if (string.IsNullOrWhiteSpace(_settings.Api.WorkerKey))
        {
            throw new InvalidOperationException("Api.WorkerKey must be configured for the notification worker.");
        }
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _channel = _connection.CreateModel();
        _channel.QueueDeclare(queue: _settings.RabbitMQ.QueueName, durable: true, exclusive: false, autoDelete: false);
        _channel.BasicQos(0, 1, false);

        var consumer = new AsyncEventingBasicConsumer(_channel);
        consumer.Received += async (sender, ea) =>
        {
            var body = ea.Body.ToArray();
            var rawMessage = Encoding.UTF8.GetString(body);
            try
            {
                var client = _httpClientFactory.CreateClient("api");
                var request = new HttpRequestMessage(HttpMethod.Post, "api/internal/notifications/deliver")
                {
                    Content = new StringContent(rawMessage, Encoding.UTF8, "application/json")
                };
                request.Headers.Add("X-Worker-Key", _settings.Api.WorkerKey);
                var response = await client.SendAsync(request, stoppingToken);
                response.EnsureSuccessStatusCode();
                _channel!.BasicAck(ea.DeliveryTag, false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to deliver notification payload. Will requeue.");
                if (_channel != null && _channel.IsOpen)
                {
                    _channel.BasicNack(ea.DeliveryTag, multiple: false, requeue: true);
                }
            }
        };

        _channel.BasicConsume(queue: _settings.RabbitMQ.QueueName, autoAck: false, consumer: consumer);
        return Task.CompletedTask;
    }

    public override void Dispose()
    {
        _channel?.Close();
        _channel?.Dispose();
        base.Dispose();
    }
}
