#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROJECT_PARENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONDA_ENV_PY="$PROJECT_PARENT_DIR/.conda-envs/interactive-scaffolding/bin/python"
if [ -x "$CONDA_ENV_PY" ]; then
  BACKEND_PY="$CONDA_ENV_PY"
else
  BACKEND_PY="${PYTHON:-python3}"
fi

mkdir -p .run logs

BACKEND_PID_FILE=".run/backend.pid"
FRONTEND_PID_FILE=".run/frontend.pid"

start_if_not_running() {
  local name="$1"
  local pid_file="$2"
  local cmd="$3"
  local log_file="$4"

  if [ -f "$pid_file" ]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "$name already running (pid=$pid)"
      return 0
    fi
  fi

  echo "Starting $name..."
  nohup bash -lc "$cmd" >"$log_file" 2>&1 &
  local new_pid=$!
  echo "$new_pid" > "$pid_file"
  echo "$name started (pid=$new_pid, log=$log_file)"
}

start_if_not_running \
  "backend" \
  "$BACKEND_PID_FILE" \
  "exec env FLASK_DEBUG=0 PORT=8000 \"$BACKEND_PY\" \"$SCRIPT_DIR/api_server.py\"" \
  "logs/backend.log"

# Frontend is served by Flask in single-port mode.
rm -f "$FRONTEND_PID_FILE" 2>/dev/null || true

echo ""
echo "URLs:"
echo "- App (local):  http://localhost:8000/index.html"
echo "- App (remote): http://<server-ip>:8000/index.html"
echo "- Health:       http://<server-ip>:8000/health"
