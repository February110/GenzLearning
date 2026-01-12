using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using class_api.Infrastructure.Data;

#nullable disable

namespace class_api.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260316000100_AddGradeReturnedFile")]
    public partial class AddGradeReturnedFile : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReturnedContentType",
                table: "Grades",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReturnedAt",
                table: "Grades",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReturnedFileKey",
                table: "Grades",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReturnedFileName",
                table: "Grades",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "ReturnedFileSize",
                table: "Grades",
                type: "bigint",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReturnedContentType",
                table: "Grades");

            migrationBuilder.DropColumn(
                name: "ReturnedAt",
                table: "Grades");

            migrationBuilder.DropColumn(
                name: "ReturnedFileKey",
                table: "Grades");

            migrationBuilder.DropColumn(
                name: "ReturnedFileName",
                table: "Grades");

            migrationBuilder.DropColumn(
                name: "ReturnedFileSize",
                table: "Grades");
        }
    }
}
