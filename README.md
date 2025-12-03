# GenzLearning — Kiến trúc mới & hướng dẫn chạy

Mono-repo gồm API .NET, web Next.js và worker. API đã refactor sang Clean Architecture với 4 project trong `class_solution/`.

## Cấu trúc chính
```
class_solution/
├── class.api/             # ASP.NET Core API (entry)
├── class.Application/     # DTOs + Interfaces
├── class.Domain/          # Entities (mỗi class 1 file)
├── class.Infrastructure/  # DbContext, EF configs, services (Storage, JWT, RabbitMQ, Background)
class_web/                 # Next.js 16
class_worker/              # .NET worker (RabbitMQ consumer)
class_shared/              # Shared contracts (NotificationQueueMessage)
docker-compose.yml         # SQL Server + API + Web + Redis + RabbitMQ + worker
seed/                      # SQL backup for seeding
```

## Yêu cầu
- .NET SDK 9.0
- Node.js ≥ 18 (khuyến nghị 20 LTS)
- Docker Desktop (nếu chạy bằng Docker)

## Chạy API cục bộ (không Docker)
```
cd class_solution/class.api
dotnet run           # mặc định http://localhost:5081 (set ASPNETCORE_URLS nếu cần)
```
Kết nối DB: chỉnh `ConnectionStrings:DefaultConnection` qua biến môi trường hoặc appsettings (không commit secrets).

Migrations (DbContext: `class_api.Infrastructure.Data.ApplicationDbContext`):
```
cd class_solution
dotnet ef migrations add <Name> -p class.Infrastructure -s class.api
dotnet ef database update -p class.Infrastructure -s class.api
```

## Chạy web cục bộ
```
cd class_web
npm install
npm run dev          # http://localhost:3000
# đảm bảo NEXT_PUBLIC_API_BASE_URL trỏ http://localhost:5081/api
```

## Chạy bằng Docker Compose
```
cd .
docker compose up --build
```
Ports: API `5081:8080`, Web `3000:3000`, SQL `1433`, Redis `6379`, RabbitMQ `5672/15672`.

## Lưu ý bảo mật / push protection
- Tuyệt đối không commit appsettings chứa secret. `.gitignore` đã chặn appsettings trong `class_solution/class.api`.
- Nếu lỡ commit secret, rotate key và dùng `git filter-repo`/rebase để xóa khỏi lịch sử trước khi push.

## Nơi xem Swagger
- Khi chạy local/Docker: `http://localhost:5081/swagger`
