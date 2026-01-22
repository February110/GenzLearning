namespace class_api.Application.Dtos
{
    public record CreateClassroomGroupDto(
        string Name,
        Guid? LeaderId = null,
        List<Guid>? MemberIds = null
    );

    public record UpdateClassroomGroupDto(
        string? Name = null,
        Guid? LeaderId = null
    );

    public record AddClassroomGroupMemberDto(
        Guid UserId
    );

    public record RandomizeClassroomGroupsDto(
        int? GroupSize = null
    );
}
