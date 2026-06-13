using class_api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace class_api.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260605000400_ExpandLectureLessonProgressMetrics")]
    public partial class ExpandLectureLessonProgressMetrics : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TextScrollPercent",
                table: "LectureLessonProgresses",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TextDwellSeconds",
                table: "LectureLessonProgresses",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "TextCompleted",
                table: "LectureLessonProgresses",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<double>(
                name: "VideoWatchedSeconds",
                table: "LectureLessonProgresses",
                type: "float",
                nullable: false,
                defaultValue: 0d);

            migrationBuilder.AddColumn<int>(
                name: "VideoDurationSeconds",
                table: "LectureLessonProgresses",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "VideoCompleted",
                table: "LectureLessonProgresses",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "TextScrollPercent", table: "LectureLessonProgresses");
            migrationBuilder.DropColumn(name: "TextDwellSeconds", table: "LectureLessonProgresses");
            migrationBuilder.DropColumn(name: "TextCompleted", table: "LectureLessonProgresses");
            migrationBuilder.DropColumn(name: "VideoWatchedSeconds", table: "LectureLessonProgresses");
            migrationBuilder.DropColumn(name: "VideoDurationSeconds", table: "LectureLessonProgresses");
            migrationBuilder.DropColumn(name: "VideoCompleted", table: "LectureLessonProgresses");
        }
    }
}
