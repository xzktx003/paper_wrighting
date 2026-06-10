#!/bin/bash
# Paper Writer persistent server launcher
# Auto-restarts on crash, survives SSH disconnect via setsid

BACKEND_DIR="/data01/home/xuzk/workspace/ai_agent/paper_wrighting/app/apps/backend"
NODE_BIN="/data01/home/xuzk/.nvm/versions/node/v24.14.0/bin/node"
export OPENPRISM_PORT=8787

cd "$BACKEND_DIR"

echo "[paper-writer] Starting on port $OPENPRISM_PORT, PID=$$"

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
    "$NODE_BIN" src/index.js 2>&1
    EXIT_CODE=$?

    echo "[paper-writer] Node exited with code $EXIT_CODE"
    RESTART_COUNT=$((RESTART_COUNT + 1))
done
