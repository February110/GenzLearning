using System.Text.Json.Serialization;

namespace class_shared
{
    public sealed class NotificationQueueMessage
    {
        [JsonPropertyName("userIds")]
        public List<Guid> UserIds { get; init; } = new();

        [JsonPropertyName("title")]
        public string Title { get; init; } = string.Empty;

        [JsonPropertyName("message")]
        public string Message { get; init; } = string.Empty;

        [JsonPropertyName("type")]
        public string Type { get; init; } = string.Empty;

        [JsonPropertyName("classroomId")]
        public Guid? ClassroomId { get; init; }

        [JsonPropertyName("assignmentId")]
        public Guid? AssignmentId { get; init; }

        [JsonPropertyName("metadata")]
        public string? MetadataJson { get; init; }
    }
}
