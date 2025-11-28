namespace class_api.Dtos
{
    public record CreateClassroomDto(
      string Name,
      string? Description,
      string? Section,
      string? Room,
      string? Schedule
  );

    public record JoinClassroomDto(string InviteCode);

    public record UpdateInviteCodeVisibilityDto(bool Visible);
}
