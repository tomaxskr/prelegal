# Prelegal Stop Script for macOS
# This script stops the Docker container

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "Stopping Prelegal..."

docker-compose down

echo "Prelegal stopped."