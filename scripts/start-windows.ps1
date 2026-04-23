# Prelegal Start Script for Windows
# This script builds and starts the app using Docker

$ErrorActionPreference = "Stop"

$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot

Set-Location $PROJECT_ROOT

Write-Host "Building and starting Prelegal with Docker..." -ForegroundColor Cyan

# Build and start container
docker-compose up --build -d

Write-Host ""
Write-Host "Prelegal is running in Docker!" -ForegroundColor Green
Write-Host "Backend + Frontend: http://localhost:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Use .\scripts\stop-windows.ps1 to stop" -ForegroundColor Gray