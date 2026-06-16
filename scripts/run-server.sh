#!/bin/bash
# Paper Writer persistent server launcher
# Auto-restarts on crash, survives SSH disconnect via setsid

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Source .env for OPENPRISM_* config
if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  . "${ROOT_DIR}/.env"
  set +a
fi

# Explicitly override to avoid system PORT=4000 conflict
export OPENPRISM_PORT="${OPENPRISM_PORT:-8787}"
export OPENPRISM_PUBLIC_HOST="${OPENPRISM_PUBLIC_HOST:-10.30.0.22}"

BACKEND_DIR="${ROOT_DIR}/app/apps/backend"
NODE_BIN="${NODE_BIN:-node}"
LOG_FILE="${LOG_FILE:-/tmp/paper-writer.log}"

cd "$BACKEND_DIR"

echo "[paper-writer] Starting on http://${OPENPRISM_PUBLIC_HOST}:${OPENPRISM_PORT}" | tee "$LOG_FILE"

RESTART_COUNT=0
MAX_DELAY=60

while true; do
    if [ $RESTART_COUNT -gt 0 ]; then
        DELAY=$(( 3 * (2 ** (RESTART_COUNT - 1)) ))
        [ $DELAY -gt $MAX_DELAY ] && DELAY=$MAX_DELAY
        echo "[paper-writer] Restarting in ${DELAY}s (attempt #${RESTART_COUNT})"
        sleep $DELAY
    fi

    echo "[paper-writer] Launching node..."
    "$NODE_BIN" src/index.js 2>&1 | tee -a "$LOG_FILE"
    EXIT_CODE=$?

    echo "[paper-writer] Node exited with code $EXIT_CODE"
    RESTART_COUNT=$((RESTART_COUNT + 1))
done
