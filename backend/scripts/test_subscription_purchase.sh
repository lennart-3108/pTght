#!/bin/bash

# Test subscription purchase with PayPal simulation
# This script tests the complete purchase flow

API_BASE="http://localhost:5001/api"

echo "=== Testing Subscription Purchase Flow ==="
echo

# 1. Get license plans
echo "1. Fetching available license plans..."
PLANS=$(curl -s "${API_BASE}/roles/license-plans")
echo "Found $(echo "$PLANS" | jq 'length') plans"
echo

# Get first plan
FIRST_PLAN=$(echo "$PLANS" | jq '.[0]')
PLAN_ID=$(echo "$FIRST_PLAN" | jq -r '.id')
PLAN_NAME=$(echo "$FIRST_PLAN" | jq -r '.name')
PLAN_PRICE=$(echo "$FIRST_PLAN" | jq -r '.price')
ROLE_NAME=$(echo "$FIRST_PLAN" | jq -r '.role_display_name')

echo "Selected plan for test:"
echo "  ID: $PLAN_ID"
echo "  Name: $PLAN_NAME"
echo "  Role: $ROLE_NAME"
echo "  Price: €$PLAN_PRICE"
echo

# 2. Login as test user
echo "2. Logging in as test user..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "$LOGIN_RESPONSE" | jq '.'
  exit 1
fi

echo "✓ Login successful"
echo

# 3. Check current roles
echo "3. Checking current user roles..."
USER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.user.id')
CURRENT_ROLES=$(curl -s "${API_BASE}/roles/users/${USER_ID}/roles")
echo "Current roles:"
echo "$CURRENT_ROLES" | jq -r '.[] | "  - \(.name) (\(.display_name))"'
echo

# 4. Simulate PayPal purchase
echo "4. Simulating PayPal purchase..."
PURCHASE_RESPONSE=$(curl -s -X POST "${API_BASE}/roles/purchase" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"license_plan_id\": $PLAN_ID,
    \"payment_method\": \"paypal_simulated\",
    \"amount\": $PLAN_PRICE
  }")

echo "$PURCHASE_RESPONSE" | jq '.'

SUCCESS=$(echo "$PURCHASE_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  echo "✓ Purchase successful!"
  echo
  
  # 5. Verify new roles
  echo "5. Verifying new user roles..."
  sleep 1
  NEW_ROLES=$(curl -s "${API_BASE}/roles/users/${USER_ID}/roles")
  echo "Updated roles:"
  echo "$NEW_ROLES" | jq -r '.[] | "  - \(.name) (\(.display_name))"'
  echo
  
  # 6. Check license
  echo "6. Checking user license..."
  LICENSES=$(curl -s "${API_BASE}/roles/users/${USER_ID}/licenses")
  echo "$LICENSES" | jq -r '.[] | "  License: \(.plan_name) - Status: \(.status) - Expires: \(.expires_at // "Never")"' | head -5
  echo
  
  echo "✅ All tests passed!"
  echo
  echo "📧 Check Mailhog at http://localhost:1025 for confirmation email"
else
  echo "❌ Purchase failed!"
  ERROR=$(echo "$PURCHASE_RESPONSE" | jq -r '.error')
  echo "Error: $ERROR"
fi
