namespace class_api.Application.Dtos
{
    public record CreateAssignmentGroupDto(
        string Name,
        Guid? LeaderId = null,
        List<Guid>? MemberIds = null
    );

    public record UpdateAssignmentGroupDto(
        string? Name = null,
        Guid? LeaderId = null
    );

    public record AddAssignmentGroupMembersDto(
        List<Guid> MemberIds
    );

    public record UpdateAssignmentGroupMemberDto(
        bool CanSubmit
    );
}
