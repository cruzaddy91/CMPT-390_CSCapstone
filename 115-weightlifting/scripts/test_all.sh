#!/bin/bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

ensure_backend_venv
ensure_backend_env
ensure_frontend_env

echo "Running Django checks..."
backend_manage check

echo "Checking migrations..."
backend_manage makemigrations --check

echo "Running Django tests..."
backend_manage test

echo "Building frontend..."
frontend_npm run build

log_event "test" "success" "test_all.sh" '{"backend_checks":"passed","frontend_build":"passed"}'
"$ROOT_DIR/scripts/report.sh" >/dev/null
