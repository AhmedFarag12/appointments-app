#!/usr/bin/env bash
# Seeds demo accounts and provider profiles through the API.
# Safe to re-run: existing accounts are logged into instead of re-created.
#
# Usage: scripts/seed.sh [base-url]     (default: http://localhost:3000)
set -euo pipefail

BASE_URL="${1:-${BASE_URL:-http://localhost:3000}}"
PASSWORD="password123"

# POST JSON and print the raw response body. Extra args are passed to curl.
# The body goes through stdin: on Windows, non-ASCII text in curl arguments gets mangled.
post() {
  local path="$1" body="$2"; shift 2
  printf '%s' "$body" | curl -s -X POST "$BASE_URL$path" -H 'Content-Type: application/json; charset=utf-8' "$@" --data-binary @-
}

json_field() {
  sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p" | head -n1
}

# Registers a user, or logs in if the email already exists. Prints the access token.
get_token() {
  local name="$1" email="$2" role="$3" res
  res=$(post /auth/register "{\"name\":\"$name\",\"email\":\"$email\",\"password\":\"$PASSWORD\",\"role\":\"$role\"}")
  if [[ "$res" != *accessToken* ]]; then
    res=$(post /auth/login "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}")
  fi
  local token
  token=$(json_field accessToken <<<"$res")
  [[ -n "$token" ]] || { echo "Auth failed for $email: $res" >&2; exit 1; }
  echo "$token"
}

# Weekdays Sunday–Thursday, 09:00–17:00
HOURS='[{"day":0,"start":"09:00","end":"17:00"},{"day":1,"start":"09:00","end":"17:00"},{"day":2,"start":"09:00","end":"17:00"},{"day":3,"start":"09:00","end":"17:00"},{"day":4,"start":"09:00","end":"17:00"}]'

seed_provider() {
  local name="$1" email="$2" business="$3" specialty="$4" address="$5" duration="$6"
  local token res
  token=$(get_token "$name" "$email" provider)
  res=$(post /providers \
    "{\"businessName\":\"$business\",\"specialty\":\"$specialty\",\"address\":\"$address\",\"slotDuration\":$duration,\"workingHours\":$HOURS}" \
    -H "Authorization: Bearer $token")
  if [[ "$res" == *'"success":true'* ]]; then
    echo "✔ provider  $business"
  else
    echo "• provider  $business (already exists)"
  fi
}

echo "Seeding $BASE_URL ..."
curl -sf -o /dev/null "$BASE_URL/providers" || { echo "API not reachable at $BASE_URL" >&2; exit 1; }

seed_provider "د. منى"   "mona@demo.com"   "عيادة الابتسامة" "طبيب أسنان"  "مدينة نصر، القاهرة" 30
seed_provider "د. كريم"  "karim@demo.com"  "مركز الشفاء"     "باطنة"       "المعادي، القاهرة"   20
seed_provider "أ. سارة"  "sara@demo.com"   "صالون لمسة"      "تجميل"       "سموحة، الإسكندرية"  45

get_token "أحمد" "customer@demo.com" customer >/dev/null
echo "✔ customer  customer@demo.com"

echo
echo "Done. All demo accounts use password: $PASSWORD"
