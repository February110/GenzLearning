namespace class_api.Application.Dtos
{
    public record CreateClassroomGroupDto(
        string Name,
        Guid? LeaderId = null,
        List<Guid>? MemberIds = null
    );
}
