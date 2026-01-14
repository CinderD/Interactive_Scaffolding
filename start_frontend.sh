#!/bin/bash
set -euo pipefail

# Start a simple static server for the frontend.
# Then visit: http://localhost:8000/index.html

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${PORT:-8000}"

echo "Starting frontend static server on http://localhost:${PORT}/index.html"
python3 -m http.server "$PORT"
