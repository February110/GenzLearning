@echo off
echo Restarting containers...
docker compose down
docker compose up -d
echo Restart complete.
