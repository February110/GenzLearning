@echo off
setlocal
echo ========================================
echo Starting Class Management System via Docker
echo ========================================
echo.

docker compose up -d --build
if errorlevel 1 (
  echo Docker compose failed. Check logs for details.
  exit /b 1
)

echo.
echo Waiting for services to warm up...
timeout /t 10 /nobreak > nul

echo.
echo ========================================
echo Services Status
echo ========================================
docker compose ps

echo.
echo Frontend: http://localhost:3000
echo API: http://localhost:5081
echo SQL Server: localhost:1433 (sa / %SA_PASSWORD%)
echo.
echo Use docker-logs.bat or "docker compose logs -f" to inspect logs.
echo ========================================
endlocal
