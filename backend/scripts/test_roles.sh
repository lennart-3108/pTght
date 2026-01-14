#!/bin/bash
# Test script for roles and license purchase

echo "=== Testing Roles & Licenses System ==="
echo ""

# Backend URL
API="http://localhost:5001/api"

# Test 1: Get all roles
echo "1. Fetching all roles..."
curl -s "${API}/roles" | jq -c '.[] | {name, display_name, requires_license}'
echo ""

# Test 2: Get all license plans
echo "2. Fetching all license plans..."
curl -s "${API}/roles/license-plans" | jq -c '.[] | {id, name, role_name, price}'
echo ""

# Test 3: Get specific license plan
echo "3. Fetching License Plan #1..."
curl -s "${API}/roles/license-plans/1" | jq '{name, price, role_name, features}'
echo ""

echo "=== Test Complete ==="
echo ""
echo "To test purchase endpoint, use:"
echo "curl -X POST ${API}/roles/purchase \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  -d '{\"license_plan_id\": 1, \"amount\": 9.99}'"
