using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace class_api.Migrations
{
    /// <inheritdoc />
    public partial class MakeClassGroupModeOptional : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "ClassGroupMode",
                table: "Classrooms",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(16)",
                oldMaxLength: 16,
                oldDefaultValue: "student");

            migrationBuilder.Sql(
                @"UPDATE Classrooms
                  SET ClassGroupMode = NULL
                  WHERE ClassGroupMode IS NOT NULL
                    AND Id NOT IN (SELECT DISTINCT ClassroomId FROM ClassroomGroups)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE Classrooms SET ClassGroupMode = 'student' WHERE ClassGroupMode IS NULL");
            migrationBuilder.AlterColumn<string>(
                name: "ClassGroupMode",
                table: "Classrooms",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "student",
                oldClrType: typeof(string),
                oldType: "nvarchar(16)",
                oldMaxLength: 16,
                oldNullable: true);
        }
    }
}
