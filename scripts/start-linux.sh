#!/bin/bash
# Prelegal Start Script for Linux
# This script starts the app using Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "Building and starting Prelegal with Docker..."

# Build and start container
docker-compose up --build -d

echo ""
echo "Prelegal is running in Docker!"
echo "Backend + Frontend: http://localhost:8000"
echo ""
echo "Use ./scripts/stop-linux.sh to stop"