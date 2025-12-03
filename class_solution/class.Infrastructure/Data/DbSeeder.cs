using class_api.Domain;
using Microsoft.EntityFrameworkCore;

namespace class_api.Infrastructure.Data
{
    public static class DbSeeder
    {
        public static void SeedAdmin(ApplicationDbContext db)
        {
            db.Database.Migrate();

            const string adminEmail = "admin@appclass.com";
            var adminByEmail = db.Users.FirstOrDefault(u => u.Email == adminEmail);
            if (adminByEmail == null)
            {
                var anyAdmin = db.Users.FirstOrDefault(u => u.SystemRole == "Admin");
                if (anyAdmin != null)
                {
                    anyAdmin.Email = adminEmail;
                    anyAdmin.Provider = string.IsNullOrWhiteSpace(anyAdmin.Provider) ? "local" : anyAdmin.Provider;
                    if (string.IsNullOrWhiteSpace(anyAdmin.PasswordHash))
                        anyAdmin.PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456");
                    db.SaveChanges();
                    adminByEmail = anyAdmin;
                }
                else
                {
                    adminByEmail = new User
                    {
                        Email = adminEmail,
                        FullName = "System Administrator",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"),
                        SystemRole = "Admin",
                        Provider = "local",
                        Avatar = "/uploads/normal_avatar.png" 
                    };
                    db.Users.Add(adminByEmail);
                    db.SaveChanges();
                }
            }

            if (!db.Classrooms.Any())
            {
                var classroom = new Classroom
                {
                    Name = "Lớp ASP.NET Core",
                    Description = "Demo lớp seed",
                    TeacherId = adminByEmail.Id,
                    InviteCode = "CNPM01"
                };
                db.Classrooms.Add(classroom);
                db.Enrollments.Add(new Enrollment
                {
                    ClassroomId = classroom.Id,
                    UserId = adminByEmail.Id,
                    Role = "Teacher"
                });
                db.SaveChanges();
            }


            if (!db.Users.Any(u => u.SystemRole != "Admin"))
            {
                var demoUser = new User
                {
                    Email = "user@appclass.com",
                    FullName = "Demo User",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"),
                    SystemRole = "User",
                    Provider = "local",
                    Avatar = "/uploads/normal_avatar.png" 
                };
                db.Users.Add(demoUser);
                db.SaveChanges();
            }
        }
    }
}
