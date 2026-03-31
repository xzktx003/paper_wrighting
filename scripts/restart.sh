#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/.runtime"
PLAYWRIGHT_BIN_DIR="${ROOT_DIR}/.playwright-bin"
SERVER_APP_DIR="${ROOT_DIR}/apps/server"
WEB_APP_DIR="${ROOT_DIR}/apps/web"

SERVER_BIND_HOST="${SERVER_BIND_HOST:-0.0.0.0}"
SERVER_PUBLIC_HOST="${SERVER_PUBLIC_HOST:-127.0.0.1}"
SERVER_PORT="${SERVER_PORT:-4000}"

WEB_HOST="${WEB_HOST:-0.0.0.0}"
WEB_PORT="${WEB_PORT:-3000}"

BUILD_LOG="${RUNTIME_DIR}/build.log"
SERVER_LOG="${RUNTIME_DIR}/server.log"
WEB_LOG="${RUNTIME_DIR}/web.log"
SERVER_PID_FILE="${RUNTIME_DIR}/server.pid"
WEB_PID_FILE="${RUNTIME_DIR}/web.pid"

log() {
  printf '[restart] %s\n' "$*"
}

build_runtime_path() {
  if [[ -d "$PLAYWRIGHT_BIN_DIR" ]]; then
    printf '%s\n' "${PLAYWRIGHT_BIN_DIR}:${PATH}"
    return
  fi

  printf '%s\n' "$PATH"
}

normalize_url() {
  local url="$1"

  printf '%s\n' "${url%/}"
}

build_default_api_ws_url() {
  local api_base_url="$1"

  api_base_url="$(normalize_url "$api_base_url")"
  api_base_url="${api_base_url/#http:\/\//ws://}"
  api_base_url="${api_base_url/#https:\/\//wss://}"
  printf '%s/ws/agent-sessions\n' "$api_base_url"
}

kill_from_pid_file() {
  local name="$1"
  local pid_file="$2"

  if [[ ! -f "$pid_file" ]]; then
    return
  fi

  local pid
  pid="$(cat "$pid_file")"

  if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
    log "Stopping ${name} process ${pid}"
    kill "$pid" 2>/dev/null || true
    sleep 0.3

    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi

  rm -f "$pid_file"
}

kill_listeners_on_port() {
  local name="$1"
  local port="$2"
  local pids

  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"

  if [[ -z "$pids" ]]; then
    return
  fi

  log "Freeing ${name} port ${port}: ${pids//$'\n'/, }"
  kill $pids 2>/dev/null || true
  sleep 0.3

  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill -9 $pids 2>/dev/null || true
  fi
}

wait_for_http() {
  local name="$1"
  local url="$2"
  local attempts="${3:-60}"
  local curl_args=(-fsS)

  if [[ "$url" == https://* ]]; then
    curl_args=(-k -fsS)
  fi

  for ((i = 1; i <= attempts; i += 1)); do
    if curl "${curl_args[@]}" "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.3
  done

  log "${name} did not become ready: ${url}"
  return 1
}

extract_frontend_url() {
  local label="$1"
  local file="$2"
  local all_urls

  all_urls="$(sed -nE "s/.*${label}:[[:space:]]+(https?:\/\/[^[:space:]]+).*/\1/p" "$file" \
    | tr -d '\r' \
    | sed 's:/$::')"

  printf '%s\n' "$all_urls" | grep -E '//localhost[:/]|//127\.0\.0\.1[:/]' | head -n 1 \
    || printf '%s\n' "$all_urls" | head -n 1
}

wait_for_frontend_urls() {
  local file="$1"
  local attempts="${2:-60}"

  FRONTEND_LOCAL_URL=''
  FRONTEND_NETWORK_URL=''

  for ((i = 1; i <= attempts; i += 1)); do
    FRONTEND_LOCAL_URL="$(extract_frontend_url Local "$file")"
    FRONTEND_NETWORK_URL="$(extract_frontend_url Network "$file")"

    if [[ -n "$FRONTEND_LOCAL_URL" ]]; then
      return 0
    fi

    sleep 0.3
  done

  log 'frontend did not print a ready url'
  return 1
}

extract_url_port() {
  local url="$1"

  printf '%s\n' "$url" | sed -nE 's#.*:([0-9]+)$#\1#p'
}

show_log_tail() {
  local label="$1"
  local file="$2"

  if [[ -f "$file" ]]; then
    printf '\n[%s log tail]\n' "$label"
    tail -n 20 "$file" || true
  fi
}

mkdir -p "$RUNTIME_DIR"

RUNTIME_PATH="$(build_runtime_path)"
SERVER_URL="http://${SERVER_PUBLIC_HOST}:${SERVER_PORT}"
SERVER_HEALTH_URL="${SERVER_URL}/api/health"
API_BASE_URL="$(normalize_url "${API_BASE_URL:-$SERVER_URL}")"
API_WS_URL="$(normalize_url "${API_WS_URL:-$(build_default_api_ws_url "$API_BASE_URL")}")"

: >"$BUILD_LOG"

cd "$ROOT_DIR"

log "Building project with API base ${API_BASE_URL}"
if ! env PATH="$RUNTIME_PATH" \
  VITE_API_BASE_URL="$API_BASE_URL" \
  VITE_API_WS_URL="$API_WS_URL" \
  pnpm build >"$BUILD_LOG" 2>&1; then
  show_log_tail build "$BUILD_LOG"
  exit 1
fi

kill_from_pid_file backend "$SERVER_PID_FILE"
kill_from_pid_file frontend "$WEB_PID_FILE"
kill_listeners_on_port backend "$SERVER_PORT"
kill_listeners_on_port frontend "$WEB_PORT"

: >"$SERVER_LOG"
: >"$WEB_LOG"

log "Starting backend on ${SERVER_BIND_HOST}:${SERVER_PORT}"
nohup env PATH="$RUNTIME_PATH" HOST="$SERVER_BIND_HOST" PORT="$SERVER_PORT" \
  node "$SERVER_APP_DIR/dist/index.js" >"$SERVER_LOG" 2>&1 &
echo $! >"$SERVER_PID_FILE"

log "Starting frontend preview on ${WEB_HOST}:${WEB_PORT}"
nohup env PATH="$RUNTIME_PATH" pnpm --dir "$WEB_APP_DIR" exec vite preview \
  --host "$WEB_HOST" \
  --port "$WEB_PORT" >"$WEB_LOG" 2>&1 &
echo $! >"$WEB_PID_FILE"

BACKEND_OK=0
FRONTEND_OK=0

wait_for_http backend "$SERVER_HEALTH_URL" &
BACKEND_WAIT_PID=$!

(
  if ! wait_for_frontend_urls "$WEB_LOG"; then
    exit 1
  fi
  FRONTEND_LOCAL_URL="$(extract_frontend_url Local "$WEB_LOG")"
  if ! wait_for_http frontend "$FRONTEND_LOCAL_URL"; then
    exit 1
  fi
) &
FRONTEND_WAIT_PID=$!

if ! wait "$BACKEND_WAIT_PID"; then
  show_log_tail backend "$SERVER_LOG"
  BACKEND_OK=1
fi

if ! wait "$FRONTEND_WAIT_PID"; then
  show_log_tail frontend "$WEB_LOG"
  FRONTEND_OK=1
fi

if [[ "$BACKEND_OK" -ne 0 || "$FRONTEND_OK" -ne 0 ]]; then
  exit 1
fi

wait_for_frontend_urls "$WEB_LOG" 5

FRONTEND_PORT="$(extract_url_port "$FRONTEND_LOCAL_URL")"
if [[ -n "$FRONTEND_PORT" && "$FRONTEND_PORT" != "$WEB_PORT" ]]; then
  log "Requested frontend port ${WEB_PORT} was busy; preview selected ${FRONTEND_PORT}"
fi

printf '\nBackend  : %s\n' "$SERVER_URL"
printf 'Health   : %s\n' "$SERVER_HEALTH_URL"
printf 'Frontend : %s\n' "$FRONTEND_LOCAL_URL"
if [[ -n "$FRONTEND_NETWORK_URL" ]]; then
  printf 'Network  : %s\n' "$FRONTEND_NETWORK_URL"
fi
printf 'API Base : %s\n' "$API_BASE_URL"
printf 'API WS   : %s\n' "$API_WS_URL"
printf 'Logs     : %s | %s | %s\n' "$BUILD_LOG" "$SERVER_LOG" "$WEB_LOG"
