namespace class_api.Application.Dtos
{
    public record ActivityEvent(string Type, string Actor, string Action, string? Context, DateTime Timestamp);
}
