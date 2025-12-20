using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace class_api.Migrations
{
    /// <inheritdoc />
    public partial class AddAssignmentSubmissionLimits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AllowedFileTypes",
                table: "Assignments",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "MaxFileSizeBytes",
                table: "Assignments",
                type: "bigint",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AllowedFileTypes",
                table: "Assignments");

            migrationBuilder.DropColumn(
                name: "MaxFileSizeBytes",
                table: "Assignments");
        }
    }
}
