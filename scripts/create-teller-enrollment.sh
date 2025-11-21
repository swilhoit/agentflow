#!/bin/bash

#
# Create Teller Enrollment Link - NO SUPPORT NEEDED
# 
# This script attempts to create a new enrollment link programmatically
#

set -e

cd "$(dirname "$0")/../teller_certificates"

TOKEN="token_77lfbjzhhtidtosa4rctadmclq"
API_BASE="https://api.teller.io"

echo "🔧 Attempting to create Teller enrollment link..."
echo ""

# Try Method 1: POST to /enrollment
echo "Method 1: POST /enrollment..."
RESPONSE=$(curl --cert certificate.pem \
     --key private_key.pem \
     -u "${TOKEN}:" \
     -X POST \
     -H "Content-Type: application/json" \
     -s -w "\n%{http_code}" \
     "${API_BASE}/enrollment" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "✅ Success! Enrollment link created:"
    echo "$BODY" | python3 -m json.tool
    exit 0
fi

# Try Method 2: POST to /enrollments
echo "Method 2: POST /enrollments..."
RESPONSE2=$(curl --cert certificate.pem \
     --key private_key.pem \
     -u "${TOKEN}:" \
     -X POST \
     -H "Content-Type: application/json" \
     -s -w "\n%{http_code}" \
     "${API_BASE}/enrollments" 2>&1)

HTTP_CODE2=$(echo "$RESPONSE2" | tail -n1)
BODY2=$(echo "$RESPONSE2" | head -n -1)

if [ "$HTTP_CODE2" = "200" ] || [ "$HTTP_CODE2" = "201" ]; then
    echo "✅ Success! Enrollment link created:"
    echo "$BODY2" | python3 -m json.tool
    exit 0
fi

# Try Method 3: POST to /enrollment/tokens
echo "Method 3: POST /enrollment/tokens..."
RESPONSE3=$(curl --cert certificate.pem \
     --key private_key.pem \
     -u "${TOKEN}:" \
     -X POST \
     -H "Content-Type: application/json" \
     -s -w "\n%{http_code}" \
     "${API_BASE}/enrollment/tokens" 2>&1)

HTTP_CODE3=$(echo "$RESPONSE3" | tail -n1)
BODY3=$(echo "$RESPONSE3" | head -n -1)

if [ "$HTTP_CODE3" = "200" ] || [ "$HTTP_CODE3" = "201" ]; then
    echo "✅ Success! Enrollment token created:"
    echo "$BODY3" | python3 -m json.tool
    exit 0
fi

# All methods failed
echo "❌ All API methods returned errors."
echo ""
echo "Responses:"
echo "  Method 1 (HTTP $HTTP_CODE): $BODY"
echo "  Method 2 (HTTP $HTTP_CODE2): $BODY2"
echo "  Method 3 (HTTP $HTTP_CODE3): $BODY3"
echo ""
echo "This likely means your API token doesn't have permission to create enrollments."
echo ""
echo "🎯 SOLUTION: Use the manual Teller Connect method instead"
echo "   See: MANUAL_TELLER_CONNECT.md"

