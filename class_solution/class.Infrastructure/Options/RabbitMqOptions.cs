namespace class_api.Options
{
    public sealed class RabbitMqOptions
    {
        public string? HostName { get; set; }
        public int Port { get; set; } = 5672;
        public string UserName { get; set; } = "guest";
        public string Password { get; set; } = "guest";
        public string QueueName { get; set; } = "notifications";

        public bool Enabled => !string.IsNullOrWhiteSpace(HostName);
    }
}
