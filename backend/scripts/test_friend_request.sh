#!/bin/bash
# Test friend request notifications

API="http://localhost:5001/api"

echo "=== Testing Friend Request System ==="
echo ""

# Erstelle Test-Token (simuliert)
echo "1. Testing friend request creation..."
echo "   (Manual test needed with real users in browser)"
echo ""

echo "2. Checking notifications table structure..."
curl -s "${API}/news" -H "Authorization: Bearer TEST_TOKEN" 2>/dev/null | head -20
echo ""

echo "=== Test Complete ==="
echo ""
echo "To test friend request flow:"
echo "1. Login as User A"
echo "2. Send friend request to User B at /user/B_ID"
echo "3. User B should receive:"
echo "   - Notification in /news"
echo "   - Email (check mailhog at http://localhost:1025)"
echo "   - Popup notification in header"
