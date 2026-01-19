using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace class_api.Migrations
{
    /// <inheritdoc />
    public partial class AddAssignmentGroupMode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GroupMode",
                table: "Assignments",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: true,
                defaultValue: "student");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GroupMode",
                table: "Assignments");
        }
    }
}
