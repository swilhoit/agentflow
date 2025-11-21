#!/bin/bash

#
# Teller Enrollment Diagnostic Script
# 
# This script helps diagnose how your accounts are connected
# and provides guidance on adding Truist
#

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Navigate to certificate directory
cd "$(dirname "$0")/../teller_certificates"

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   🔍 Teller Enrollment Diagnostic${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# API credentials
TOKEN="token_77lfbjzhhtidtosa4rctadmclq"
API_BASE="https://api.teller.io"

# Test 1: Get current accounts
echo -e "${GREEN}📋 Step 1: Checking Current Accounts${NC}"
echo -e "${YELLOW}────────────────────────────────────────────────────────${NC}"

ACCOUNTS=$(curl --cert certificate.pem \
     --key private_key.pem \
     -u "${TOKEN}:" \
     -s \
     "${API_BASE}/accounts")

echo "$ACCOUNTS" | python3 << 'EOF'
import sys, json
try:
    accounts = json.loads(sys.stdin.read())
    if not accounts:
        print("❌ No accounts found")
        sys.exit(0)
    
    print(f"✅ Found {len(accounts)} account(s):\n")
    
    institutions = {}
    enrollments = set()
    
    for i, acc in enumerate(accounts, 1):
        inst_name = acc['institution']['name']
        inst_id = acc['institution']['id']
        enrollment_id = acc['enrollment_id']
        
        print(f"{i}. {acc['name']}")
        print(f"   Institution: {inst_name} (ID: {inst_id})")
        print(f"   Type: {acc['type']} / {acc['subtype']}")
        print(f"   Enrollment ID: {enrollment_id}")
        print(f"   Account ID: {acc['id']}")
        print()
        
        institutions[inst_name] = institutions.get(inst_name, 0) + 1
        enrollments.add(enrollment_id)
    
    print(f"📊 Summary:")
    print(f"   Total Accounts: {len(accounts)}")
    print(f"   Institutions: {', '.join(institutions.keys())}")
    print(f"   Unique Enrollments: {len(enrollments)}")
    
    # Save enrollment ID for later use
    if enrollments:
        with open('/tmp/teller_enrollment_id.txt', 'w') as f:
            f.write(list(enrollments)[0])
    
except json.JSONDecodeError:
    print("❌ Error: Invalid JSON response from API")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
EOF

echo ""
echo -e "${GREEN}📝 Step 2: Checking Enrollment Details${NC}"
echo -e "${YELLOW}────────────────────────────────────────────────────────${NC}"

# Try to get enrollment ID
if [ -f /tmp/teller_enrollment_id.txt ]; then
    ENROLLMENT_ID=$(cat /tmp/teller_enrollment_id.txt)
    echo "Enrollment ID: ${ENROLLMENT_ID}"
    echo ""
    
    # Check if this is sandbox or production
    if [[ $ENROLLMENT_ID == *"test"* ]]; then
        echo -e "${YELLOW}⚠️  SANDBOX MODE DETECTED${NC}"
        echo ""
        echo "Your accounts are in Teller's sandbox/testing environment."
        echo ""
        echo "To add Truist in sandbox:"
        echo "  1. Use Teller's test credentials"
        echo "  2. Visit: https://teller.io/docs/sandbox"
        echo "  3. Use the same method you used to add AmEx test accounts"
        echo ""
    else
        echo -e "${GREEN}✅ PRODUCTION MODE${NC}"
        echo ""
        echo "Your accounts are real production accounts."
        echo "To add Truist, you'll need to use the same method you used for AmEx."
        echo ""
    fi
else
    echo "⚠️  Could not determine enrollment ID"
    echo ""
fi

echo -e "${GREEN}🔗 Step 3: Checking Available Endpoints${NC}"
echo -e "${YELLOW}────────────────────────────────────────────────────────${NC}"

# Try common endpoints
echo "Testing enrollments endpoint..."
ENROLLMENT_RESPONSE=$(curl --cert certificate.pem \
     --key private_key.pem \
     -u "${TOKEN}:" \
     -s \
     -w "\nHTTP_STATUS:%{http_code}" \
     "${API_BASE}/enrollments" 2>&1)

HTTP_STATUS=$(echo "$ENROLLMENT_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Enrollments endpoint accessible"
    echo ""
    echo "Response:"
    echo "$ENROLLMENT_RESPONSE" | grep -v "HTTP_STATUS" | python3 -m json.tool 2>/dev/null || echo "$ENROLLMENT_RESPONSE" | grep -v "HTTP_STATUS"
elif [ "$HTTP_STATUS" = "404" ]; then
    echo "⚠️  Enrollments endpoint not available (404)"
    echo "   This is normal - Teller may not expose this endpoint"
else
    echo "⚠️  Unexpected response: HTTP $HTTP_STATUS"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}📋 How You Connected Your AmEx Accounts${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""
echo "Since you already have 5 AmEx accounts connected, you used one of:"
echo ""
echo "  1. 🌐 Teller Connect Widget"
echo "     - A popup/iframe where you entered credentials"
echo "     - Integrated into a web application"
echo "     - Requires Application ID: app_xxxxxxxxxxxxx"
echo ""
echo "  2. 🖥️  Teller Dashboard"
echo "     - Clicked a button like 'Add Account' or 'Connect Bank'"
echo "     - Entered credentials in a web form"
echo "     - Look for same button/section in dashboard"
echo ""
echo "  3. 🧪 Test/Sandbox Interface"
echo "     - Used test credentials from Teller docs"
echo "     - Added via developer testing interface"
echo ""

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🎯 Recommended Next Steps${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""
echo "Option 1: Email Teller Support (FASTEST! ⭐)"
echo "  📧 support@teller.io"
echo "  Message: 'I have token token_77lfbjzhhtidto... with 5 AmEx"
echo "           accounts. Where do I add Truist?'"
echo ""
echo "Option 2: Check Teller Dashboard More Carefully"
echo "  🌐 https://teller.io or https://dashboard.teller.io"
echo "  Look for:"
echo "    - 'Accounts' or 'Enrollments' section"
echo "    - '+ Add Account' or 'Connect Institution' button"
echo "    - 'Manage Enrollments' link"
echo ""
echo "Option 3: Find Your Application ID"
echo "  Look in Teller dashboard for:"
echo "    - Settings → API Keys"
echo "    - Application ID: app_xxxxxxxxxxxxx"
echo "  Then use the teller-connect.html file provided"
echo ""
echo "Option 4: Check Teller Connect Documentation"
echo "  🌐 https://teller.io/docs/connect"
echo "  🌐 https://teller.io/docs/api/enrollments"
echo ""

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Diagnostic Complete${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""
echo "💡 Pro Tip: Since you already connected 5 accounts successfully,"
echo "   adding Truist should use the EXACT same method. If you can't"
echo "   remember how you did it, Teller support can help immediately."
echo ""
echo "📧 Best action: Email support@teller.io - they respond quickly!"
echo ""

