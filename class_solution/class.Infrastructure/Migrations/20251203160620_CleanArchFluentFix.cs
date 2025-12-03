using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace class_api.Migrations
{
    /// <inheritdoc />
    public partial class CleanArchFluentFix : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Assignments_Users_CreatorId",
                table: "Assignments");

            migrationBuilder.DropForeignKey(
                name: "FK_Enrollments_Users_UserId1",
                table: "Enrollments");

            migrationBuilder.DropForeignKey(
                name: "FK_Submissions_Assignments_AssignmentId1",
                table: "Submissions");

            migrationBuilder.DropForeignKey(
                name: "FK_Submissions_Users_UserId1",
                table: "Submissions");

            migrationBuilder.DropIndex(
                name: "IX_Submissions_AssignmentId1",
                table: "Submissions");

            migrationBuilder.DropIndex(
                name: "IX_Submissions_UserId1",
                table: "Submissions");

            migrationBuilder.DropIndex(
                name: "IX_Enrollments_UserId1",
                table: "Enrollments");

            migrationBuilder.DropIndex(
                name: "IX_Assignments_CreatorId",
                table: "Assignments");

            migrationBuilder.DropColumn(
                name: "AssignmentId1",
                table: "Submissions");

            migrationBuilder.DropColumn(
                name: "UserId1",
                table: "Submissions");

            migrationBuilder.DropColumn(
                name: "UserId1",
                table: "Enrollments");

            migrationBuilder.DropColumn(
                name: "CreatorId",
                table: "Assignments");

            migrationBuilder.AlterColumn<string>(
                name: "SystemRole",
                table: "Users",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "User",
                oldClrType: typeof(string),
                oldType: "nvarchar(20)",
                oldMaxLength: 20);

            migrationBuilder.AlterColumn<string>(
                name: "Provider",
                table: "Users",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "local",
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Meetings",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "active",
                oldClrType: typeof(string),
                oldType: "nvarchar(20)",
                oldMaxLength: 20);

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Grades",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "pending",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "Role",
                table: "Enrollments",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Student",
                oldClrType: typeof(string),
                oldType: "nvarchar(20)",
                oldMaxLength: 20);

            migrationBuilder.AlterColumn<int>(
                name: "MaxPoints",
                table: "Assignments",
                type: "int",
                nullable: false,
                defaultValue: 100,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.CreateIndex(
                name: "IX_Assignments_CreatedBy",
                table: "Assignments",
                column: "CreatedBy");

            migrationBuilder.AddForeignKey(
                name: "FK_Assignments_Users_CreatedBy",
                table: "Assignments",
                column: "CreatedBy",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Assignments_Users_CreatedBy",
                table: "Assignments");

            migrationBuilder.DropIndex(
                name: "IX_Assignments_CreatedBy",
                table: "Assignments");

            migrationBuilder.AlterColumn<string>(
                name: "SystemRole",
                table: "Users",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(20)",
                oldMaxLength: 20,
                oldDefaultValue: "User");

            migrationBuilder.AlterColumn<string>(
                name: "Provider",
                table: "Users",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50,
                oldDefaultValue: "local");

            migrationBuilder.AddColumn<Guid>(
                name: "AssignmentId1",
                table: "Submissions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UserId1",
                table: "Submissions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Meetings",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(20)",
                oldMaxLength: 20,
                oldDefaultValue: "active");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Grades",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50,
                oldDefaultValue: "pending");

            migrationBuilder.AlterColumn<string>(
                name: "Role",
                table: "Enrollments",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(20)",
                oldMaxLength: 20,
                oldDefaultValue: "Student");

            migrationBuilder.AddColumn<Guid>(
                name: "UserId1",
                table: "Enrollments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "MaxPoints",
                table: "Assignments",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldDefaultValue: 100);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatorId",
                table: "Assignments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Submissions_AssignmentId1",
                table: "Submissions",
                column: "AssignmentId1");

            migrationBuilder.CreateIndex(
                name: "IX_Submissions_UserId1",
                table: "Submissions",
                column: "UserId1");

            migrationBuilder.CreateIndex(
                name: "IX_Enrollments_UserId1",
                table: "Enrollments",
                column: "UserId1");

            migrationBuilder.CreateIndex(
                name: "IX_Assignments_CreatorId",
                table: "Assignments",
                column: "CreatorId");

            migrationBuilder.AddForeignKey(
                name: "FK_Assignments_Users_CreatorId",
                table: "Assignments",
                column: "CreatorId",
                principalTable: "Users",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Enrollments_Users_UserId1",
                table: "Enrollments",
                column: "UserId1",
                principalTable: "Users",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Submissions_Assignments_AssignmentId1",
                table: "Submissions",
                column: "AssignmentId1",
                principalTable: "Assignments",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Submissions_Users_UserId1",
                table: "Submissions",
                column: "UserId1",
                principalTable: "Users",
                principalColumn: "Id");
        }
    }
}
