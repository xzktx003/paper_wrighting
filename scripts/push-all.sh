#!/usr/bin/env bash
# 一键推送到 GitLab 和 GitHub
# 用法: ./scripts/push-all.sh [分支名]
# 默认推当前分支

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BRANCH="${1:-$(git symbolic-ref --short HEAD 2>/dev/null || echo 'main')}"

echo "=== 推送 $BRANCH 到 GitLab ==="
git push gitlab "$BRANCH"

echo ""
echo "=== 推送 $BRANCH 到 GitHub ==="
git push origin "$BRANCH"

echo ""
echo "✓ 已推送到 GitLab 和 GitHub（分支: $BRANCH）"
