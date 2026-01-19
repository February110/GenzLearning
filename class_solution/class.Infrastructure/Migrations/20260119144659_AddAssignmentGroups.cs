using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace class_api.Migrations
{
    /// <inheritdoc />
    public partial class AddAssignmentGroups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "GroupId",
                table: "Submissions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "GroupEnabled",
                table: "Assignments",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "GroupMaxMembers",
                table: "Assignments",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GroupMinMembers",
                table: "Assignments",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AssignmentGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    LeaderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssignmentGroups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AssignmentGroups_Assignments_AssignmentId",
                        column: x => x.AssignmentId,
                        principalTable: "Assignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AssignmentGroups_Users_LeaderId",
                        column: x => x.LeaderId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "AssignmentGroupMembers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Role = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    CanSubmit = table.Column<bool>(type: "bit", nullable: false),
                    JoinedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssignmentGroupMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AssignmentGroupMembers_AssignmentGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "AssignmentGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AssignmentGroupMembers_Assignments_AssignmentId",
                        column: x => x.AssignmentId,
                        principalTable: "Assignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.NoAction);
                    table.ForeignKey(
                        name: "FK_AssignmentGroupMembers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Submissions_GroupId",
                table: "Submissions",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentGroupMembers_AssignmentId_UserId",
                table: "AssignmentGroupMembers",
                columns: new[] { "AssignmentId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentGroupMembers_GroupId",
                table: "AssignmentGroupMembers",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentGroupMembers_UserId",
                table: "AssignmentGroupMembers",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentGroups_AssignmentId",
                table: "AssignmentGroups",
                column: "AssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentGroups_LeaderId",
                table: "AssignmentGroups",
                column: "LeaderId");

            migrationBuilder.AddForeignKey(
                name: "FK_Submissions_AssignmentGroups_GroupId",
                table: "Submissions",
                column: "GroupId",
                principalTable: "AssignmentGroups",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Submissions_AssignmentGroups_GroupId",
                table: "Submissions");

            migrationBuilder.DropTable(
                name: "AssignmentGroupMembers");

            migrationBuilder.DropTable(
                name: "AssignmentGroups");

            migrationBuilder.DropIndex(
                name: "IX_Submissions_GroupId",
                table: "Submissions");

            migrationBuilder.DropColumn(
                name: "GroupId",
                table: "Submissions");

            migrationBuilder.DropColumn(
                name: "GroupEnabled",
                table: "Assignments");

            migrationBuilder.DropColumn(
                name: "GroupMaxMembers",
                table: "Assignments");

            migrationBuilder.DropColumn(
                name: "GroupMinMembers",
                table: "Assignments");
        }
    }
}
