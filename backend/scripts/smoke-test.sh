#!/usr/bin/env bash
# Быстрая проверка, что API поднялось и основные сценарии работают.
# Использование: BASE_URL=http://localhost:8010 ./scripts/smoke-test.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8010}"
EMAIL="smoke-$(date +%s)@example.com"
PASSWORD="SmokeTest12345"
COOKIE_JAR="$(mktemp)"

echo "== health =="
curl -sf "$BASE_URL/api/health" | tee /dev/stderr
echo

echo "== register =="
REGISTER_RESPONSE=$(curl -sf -c "$COOKIE_JAR" -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"displayName\":\"Smoke Test\"}")
echo "$REGISTER_RESPONSE"
ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).accessToken))")

echo "== me =="
curl -sf "$BASE_URL/api/auth/me" -H "Authorization: Bearer $ACCESS_TOKEN"
echo

echo "== save progress =="
curl -sf -X PUT "$BASE_URL/api/progress" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"xpTotal":120,"streakDays":3,"lessonsDone":{"l1":true}}'
echo

echo "== get progress =="
curl -sf "$BASE_URL/api/progress" -H "Authorization: Bearer $ACCESS_TOKEN"
echo

echo "== refresh (using cookie jar) =="
curl -sf -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "$BASE_URL/api/auth/refresh"
echo

rm -f "$COOKIE_JAR"
echo "OK: все базовые сценарии прошли успешно."
