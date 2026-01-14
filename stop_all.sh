#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BACKEND_PID_FILE=".run/backend.pid"
FRONTEND_PID_FILE=".run/frontend.pid"

stop_by_pidfile() {
  local name="$1"
  local pid_file="$2"

  if [ ! -f "$pid_file" ]; then
    echo "$name not tracked (no $pid_file)"
    return 0
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"

  if [ -z "$pid" ]; then
    echo "$name not tracked (empty pid)"
    rm -f "$pid_file"
    return 0
  fi

  if kill -0 "$pid" 2>/dev/null; then
    echo "Stopping $name (pid=$pid)..."
    kill "$pid" 2>/dev/null || true
    # give it a moment, then force if needed
    sleep 0.5
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  else
    echo "$name already stopped (pid=$pid)"
  fi

  rm -f "$pid_file"
}

stop_by_pidfile "frontend" "$FRONTEND_PID_FILE"
stop_by_pidfile "backend" "$BACKEND_PID_FILE"

# If PID tracking is stale (e.g., reloader, manual starts), also stop listeners by port.
stop_by_port() {
  local name="$1"
  local port="$2"

  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | tr '\n' ' ' || true)"
    if [ -n "$pids" ]; then
      echo "Stopping $name listeners on port $port (pids=$pids)..."
      kill $pids 2>/dev/null || true
      sleep 0.5
      for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
          kill -9 "$pid" 2>/dev/null || true
        fi
      done
    fi
    return 0
  fi

  if command -v ss >/dev/null 2>&1; then
    # Best-effort fallback without lsof
    local pids
    pids="$(ss -lptn "sport = :$port" 2>/dev/null | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u | tr '\n' ' ' || true)"
    if [ -n "$pids" ]; then
      echo "Stopping $name listeners on port $port (pids=$pids)..."
      kill $pids 2>/dev/null || true
      sleep 0.5
      for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
          kill -9 "$pid" 2>/dev/null || true
        fi
      done
    fi
  fi
}

stop_by_port "app" 8000

echo "Done."
