# Prelegal Stop Script for Windows
# This script stops the Docker container

$ErrorActionPreference = "Stop"

$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot

Set-Location $PROJECT_ROOT

Write-Host "Stopping Prelegal..." -ForegroundColor Cyan

docker-compose down

Write-Host "Prelegal stopped." -ForegroundColor Green