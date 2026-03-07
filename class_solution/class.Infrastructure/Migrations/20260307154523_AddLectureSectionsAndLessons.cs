using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace class_api.Migrations
{
    /// <inheritdoc />
    public partial class AddLectureSectionsAndLessons : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LectureSections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClassroomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    OrderIndex = table.Column<int>(type: "int", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LectureSections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LectureSections_Classrooms_ClassroomId",
                        column: x => x.ClassroomId,
                        principalTable: "Classrooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LectureSections_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "LectureLessons",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SectionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    OrderIndex = table.Column<int>(type: "int", nullable: false),
                    VideoKey = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    VideoName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    VideoSizeBytes = table.Column<long>(type: "bigint", nullable: true),
                    DurationSeconds = table.Column<int>(type: "int", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LectureLessons", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LectureLessons_LectureSections_SectionId",
                        column: x => x.SectionId,
                        principalTable: "LectureSections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LectureLessons_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_LectureLessons_CreatedBy",
                table: "LectureLessons",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_LectureLessons_SectionId_OrderIndex",
                table: "LectureLessons",
                columns: new[] { "SectionId", "OrderIndex" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LectureSections_ClassroomId_OrderIndex",
                table: "LectureSections",
                columns: new[] { "ClassroomId", "OrderIndex" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LectureSections_CreatedBy",
                table: "LectureSections",
                column: "CreatedBy");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LectureLessons");

            migrationBuilder.DropTable(
                name: "LectureSections");
        }
    }
}
