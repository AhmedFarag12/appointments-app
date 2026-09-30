#!/usr/bin/env bash
# Quick end-to-end check that the running app responds correctly.
# Exits non-zero on the first failure, so it can gate a deploy or CI step.
#
# Usage: scripts/smoke-test.sh [base-url]     (default: http://localhost:3000)
set -uo pipefail

BASE_URL="${1:-${BASE_URL:-http://localhost:3000}}"
failed=0

# check <description> <expected-status> <curl args...>
check() {
  local desc="$1" expected="$2"; shift 2
  local status
  status=$(curl -s -o /dev/null -w '%{http_code}' "$@")
  if [[ "$status" == "$expected" ]]; then
    echo "✔ $desc ($status)"
  else
    echo "✘ $desc — expected $expected, got $status"
    failed=1
  fi
}

# Wait up to 30s for the app to come up (useful right after `docker compose up`).
for _ in $(seq 1 30); do
  curl -s -o /dev/null "$BASE_URL/providers" && break
  sleep 1
done

check "home page"                  200 "$BASE_URL/"
check "frontend script"            200 "$BASE_URL/app.js"
check "list providers"             200 "$BASE_URL/providers"
check "/auth/me without token"     401 "$BASE_URL/auth/me"
check "invalid register payload"   400 -X POST "$BASE_URL/auth/register" -H 'Content-Type: application/json' -d '{"email":"bad"}'
check "wrong login"                401 -X POST "$BASE_URL/auth/login" -H 'Content-Type: application/json' -d '{"email":"nobody@x.com","password":"nope"}'

if (( failed )); then echo "Smoke test FAILED"; exit 1; fi
echo "All checks passed"
