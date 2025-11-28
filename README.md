# GenzLearning — Tổng quan dự án

Mono-repo gồm 3 phần chính:

- Backend: `class_api` — ASP.NET Core (.NET 9), EF Core, JWT, Swagger, SQL Server
- Frontend: `class_web` — Next.js 16, React 19, Tailwind, NextAuth
- Hạ tầng: `docker-compose.yml` — Orchestrate SQL Server + API + Web

## Cấu trúc thư mục

```
.
├── class_api/                # ASP.NET Core API (.NET 9)
│   ├── Controllers, Services # Business/API layers
│   ├── Data, Migrations      # EF Core & migrations
│   ├── Program.cs            # Entry point
│   └── Dockerfile            # Docker image cho API
├── class_web/                # Next.js 16 app
│   ├── app, components       # App Router + UI
│   ├── .env.local            # Biến môi trường (Front-end)
│   └── Dockerfile            # Docker image cho Web
├── docker-compose.yml        # Compose SQL + API + Web
├── docker-*.bat              # Script nhanh cho Windows
└── README_DOCKER.md          # Hướng dẫn chạy với Docker
```

## Yêu cầu hệ thống (Dev)

- .NET SDK 9.0
- Node.js >= 18 (khuyến nghị 20 LTS)
- Docker Desktop (để chạy bằng Docker)

## Chạy nhanh bằng Docker

Xem hướng dẫn chi tiết trong `README_DOCKER.md`. Tóm tắt:

```bash
docker compose up -d    # hoặc: docker-compose up -d
```

Truy cập: Web `http://localhost:3000`, API `http://localhost:5081`, Swagger `http://localhost:5081/swagger`.

## Phát triển cục bộ (không dùng Docker)

### API (class_api)

```bash
cd class_api
dotnet restore
# (Tùy chọn) Áp dụng migrations nếu bạn dùng SQL local:
# dotnet tool install --global dotnet-ef
# dotnet ef database update
dotnet run     # http://localhost:5081 (Development)
```

Lưu ý: Kiểm tra/điều chỉnh `ConnectionStrings:DefaultConnection` trong `class_api/appsettings.json:1` cho môi trường local của bạn.

### Web (class_web)

```bash
cd class_web
npm install
npm run dev    # http://localhost:3000
```

Đảm bảo `class_web/.env.local:1` có `NEXT_PUBLIC_API_BASE_URL=http://localhost:5081/api` để kết nối API local.

## Ghi chú bảo mật

- Tránh commit khóa bí mật lên repo công khai. Di chuyển các secret (OAuth, JWT, Azure, v.v.) sang biến môi trường hoặc secret manager khi triển khai thực tế.

## Tài liệu liên quan

- `README_DOCKER.md:1` — Hướng dẫn chạy nhanh và chi tiết bằng Docker Compose.

