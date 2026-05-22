#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

expected_app_dir="$REPO_ROOT/app"
expected_backend_dir="$expected_app_dir/apps/backend"
expected_frontend_dir="$expected_app_dir/apps/frontend"

output_from_root="$(cd "$REPO_ROOT" && sh scripts/restart.sh --check-paths)"
output_from_scripts="$(cd "$REPO_ROOT/scripts" && sh ./restart.sh --check-paths)"

assert_contains() {
  haystack="$1"
  needle="$2"
  if ! printf '%s\n' "$haystack" | grep -Fqx "$needle"; then
    echo "Expected output to contain: $needle" >&2
    echo "$haystack" >&2
    exit 1
  fi
}

for output in "$output_from_root" "$output_from_scripts"; do
  assert_contains "$output" "APP_DIR=$expected_app_dir"
  assert_contains "$output" "BACKEND_DIR=$expected_backend_dir"
  assert_contains "$output" "FRONTEND_DIR=$expected_frontend_dir"
done
