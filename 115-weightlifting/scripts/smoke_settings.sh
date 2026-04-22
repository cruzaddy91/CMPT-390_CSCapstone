#!/bin/bash
# Smoke: settings.py must refuse to boot with DEBUG=False + insecure SECRET_KEY.
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

ensure_backend_venv
ensure_backend_env

# Run in a clean env so the developer's real .env does not mask the guard.
output="$(
  env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    PYTHONPATH="$BACKEND_DIR" \
    DJANGO_SETTINGS_MODULE=config.settings \
    DEBUG=False \
    SECRET_KEY='django-insecure-change-this-in-production' \
    "$BACKEND_PYTHON" -c "import django; django.setup()" 2>&1 || true
)"

if ! printf '%s\n' "$output" | grep -q 'Refusing to start'; then
  echo "FAIL: insecure SECRET_KEY guard did not fire under DEBUG=False" >&2
  printf '%s\n' "$output" >&2
  exit 1
fi

good_output="$(
  env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    PYTHONPATH="$BACKEND_DIR" \
    DJANGO_SETTINGS_MODULE=config.settings \
    DEBUG=TRUE \
    SECRET_KEY='django-insecure-change-this-in-production' \
    "$BACKEND_PYTHON" -c "import django; django.setup(); print('DEBUG_BOOT_OK')" 2>&1
)"
if ! printf '%s\n' "$good_output" | grep -q 'DEBUG_BOOT_OK'; then
  echo "FAIL: DEBUG=True boot with insecure key should succeed but did not" >&2
  printf '%s\n' "$good_output" >&2
  exit 1
fi

prod_output="$(
  env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    PYTHONPATH="$BACKEND_DIR" \
    DJANGO_SETTINGS_MODULE=config.settings \
    DEBUG=False \
    SECRET_KEY='prod-grade-random-$'"$(date +%s%N)"'-key' \
    "$BACKEND_PYTHON" -c "import django; django.setup(); print('PROD_BOOT_OK')" 2>&1
)"
if ! printf '%s\n' "$prod_output" | grep -q 'PROD_BOOT_OK'; then
  echo "FAIL: DEBUG=False boot with strong key should succeed but did not" >&2
  printf '%s\n' "$prod_output" >&2
  exit 1
fi

echo 'ok settings.py hardening: insecure-key-refused, dev-boot-ok, prod-boot-ok'
