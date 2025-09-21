#!/usr/bin/env bash
# Simple smoke script: login, create team, add member, submit roster
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="http://localhost:5001"
 # pick admin credentials from backend-start.log (last created admin)
ADMIN_EMAIL=$(tail -n 200 ../backend-start.log | grep "Admin erstellt" | tail -n1 | sed -E 's/.*\(([^)]+)\).*/\1/')
if [ -z "$ADMIN_EMAIL" ] || [ "$ADMIN_EMAIL" = "" ]; then
  auth_email="admin@example.com"
else
  auth_email="$ADMIN_EMAIL"
fi
PASSWORD="test1234"

echo "Logging in as $auth_email"
TOKEN=$(curl -sS -X POST "$API/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$auth_email\",\"password\":\"$PASSWORD\"}" | jq -r .token)
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Login failed" >&2
  exit 2
fi

echo "Creating team"
TEAM=$(curl -sS -X POST "$API/teams" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"name":"Smoke Team","league_id":1,"sport_id":1}' )
TEAM_ID=$(echo "$TEAM" | jq -r '.team.id')
if [ -z "$TEAM_ID" ] || [ "$TEAM_ID" = "null" ]; then
  echo "Team creation failed: $TEAM" >&2
  exit 3
fi

echo "Team created: $TEAM_ID"

echo "Adding member user_id=1"
ADD=$(curl -sS -X POST "$API/teams/$TEAM_ID/members" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"user_id":1}')
echo "add response: $ADD"

echo "Submitting roster (match_id=1, user 1 starter)"
ROSTER_PAY='{"match_id":1,"players":[{"user_id":1,"role":"starter"}]}'
SUB=$(curl -sS -X POST "$API/teams/$TEAM_ID/roster" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$ROSTER_PAY")
echo "roster response: $SUB"

echo "Smoke finished"
