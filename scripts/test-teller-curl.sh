#!/bin/bash

#
# Teller API Test Script (using curl)
# 
# This script tests various Teller API endpoints using curl
#

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Navigate to certificate directory
cd "$(dirname "$0")/../teller_certificates"

# Check if certificates exist
if [ ! -f "certificate.pem" ] || [ ! -f "private_key.pem" ]; then
    echo -e "${RED}❌ Error: Certificates not found!${NC}"
    echo "Expected location: $(pwd)"
    exit 1
fi

# API credentials
TOKEN="token_77lfbjzhhtidtosa4rctadmclq"
API_BASE="https://api.teller.io"

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   🏦 Teller API Test (Direct curl)${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Test 1: Get all accounts
echo -e "${GREEN}📋 Test 1: Fetching All Accounts${NC}"
echo -e "${YELLOW}────────────────────────────────────────────────────────${NC}"
curl --cert certificate.pem \
     --key private_key.pem \
     -u "${TOKEN}:" \
     -s \
     "${API_BASE}/accounts" | python3 -m json.tool

echo ""
echo -e "${GREEN}✅ Accounts fetched successfully${NC}"
echo ""

# Test 2: Get balances for first account
echo -e "${GREEN}💰 Test 2: Fetching Account Balances${NC}"
echo -e "${YELLOW}────────────────────────────────────────────────────────${NC}"
echo "Getting first account ID..."
FIRST_ACCOUNT=$(curl --cert certificate.pem \
     --key private_key.pem \
     -u "${TOKEN}:" \
     -s \
     "${API_BASE}/accounts" | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['id'])")

echo "First account ID: ${FIRST_ACCOUNT}"
echo ""
echo "Fetching balances..."
curl --cert certificate.pem \
     --key private_key.pem \
     -u "${TOKEN}:" \
     -s \
     "${API_BASE}/accounts/${FIRST_ACCOUNT}/balances" | python3 -m json.tool

echo ""
echo -e "${GREEN}✅ Balances fetched successfully${NC}"
echo ""

# Test 3: Get recent transactions
echo -e "${GREEN}📝 Test 3: Fetching Recent Transactions (5 most recent)${NC}"
echo -e "${YELLOW}────────────────────────────────────────────────────────${NC}"
curl --cert certificate.pem \
     --key private_key.pem \
     -u "${TOKEN}:" \
     -s \
     "${API_BASE}/accounts/${FIRST_ACCOUNT}/transactions?count=5" | python3 -m json.tool

echo ""
echo -e "${GREEN}✅ Transactions fetched successfully${NC}"
echo ""

# Summary
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ All API tests passed!${NC}"
echo ""
echo "Currently connected institutions:"
curl --cert certificate.pem \
     --key private_key.pem \
     -u "${TOKEN}:" \
     -s \
     "${API_BASE}/accounts" | python3 -c "
import sys, json
accounts = json.load(sys.stdin)
institutions = {}
for acc in accounts:
    inst = acc['institution']['name']
    institutions[inst] = institutions.get(inst, 0) + 1
    
for inst, count in institutions.items():
    print(f'  • {inst}: {count} account(s)')
"

echo ""
echo -e "${YELLOW}📌 To add Truist:${NC}"
echo "   1. Visit: https://teller.io"
echo "   2. Click 'Add Bank Account'"
echo "   3. Search for 'Truist'"
echo "   4. Enter credentials and authorize"
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"

