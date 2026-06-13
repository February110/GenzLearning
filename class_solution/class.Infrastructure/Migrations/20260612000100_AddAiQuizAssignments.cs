using System;
using class_api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace class_api.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260612000100_AddAiQuizAssignments")]
    public partial class AddAiQuizAssignments : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AssignmentType",
                table: "Assignments",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "standard");

            migrationBuilder.AddColumn<DateTime>(
                name: "PublishedAt",
                table: "Assignments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QuizBlobKey",
                table: "Assignments",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QuizDifficulty",
                table: "Assignments",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "QuizQuestionCount",
                table: "Assignments",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "QuizTimeLimitMinutes",
                table: "Assignments",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QuizTopic",
                table: "Assignments",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Assignments",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "published");

            migrationBuilder.Sql("UPDATE Assignments SET PublishedAt = CreatedAt WHERE PublishedAt IS NULL AND Status = 'published'");

            migrationBuilder.CreateTable(
                name: "QuizSubmissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AnswersJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CorrectCount = table.Column<int>(type: "int", nullable: false),
                    TotalQuestions = table.Column<int>(type: "int", nullable: false),
                    Score = table.Column<double>(type: "float", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuizSubmissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuizSubmissions_Assignments_AssignmentId",
                        column: x => x.AssignmentId,
                        principalTable: "Assignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_QuizSubmissions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_QuizSubmissions_AssignmentId_UserId",
                table: "QuizSubmissions",
                columns: new[] { "AssignmentId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuizSubmissions_UserId",
                table: "QuizSubmissions",
                column: "UserId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "QuizSubmissions");

            migrationBuilder.DropColumn(name: "AssignmentType", table: "Assignments");
            migrationBuilder.DropColumn(name: "PublishedAt", table: "Assignments");
            migrationBuilder.DropColumn(name: "QuizBlobKey", table: "Assignments");
            migrationBuilder.DropColumn(name: "QuizDifficulty", table: "Assignments");
            migrationBuilder.DropColumn(name: "QuizQuestionCount", table: "Assignments");
            migrationBuilder.DropColumn(name: "QuizTimeLimitMinutes", table: "Assignments");
            migrationBuilder.DropColumn(name: "QuizTopic", table: "Assignments");
            migrationBuilder.DropColumn(name: "Status", table: "Assignments");
        }
    }
}
