#!/bin/bash

# Deploy All Bots - Complete Setup Script
# This deploys both Atlas and Financial Advisor to Cloud Run

set -e

echo "🤖 Deploying All Bots to Cloud Run"
echo "════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Load environment
export GCP_PROJECT_ID=agentflow-discord-bot
export GCP_REGION=us-central1
set -a
source .env 2>/dev/null
set +a

echo -e "${YELLOW}IMPORTANT: Enable MESSAGE_CONTENT intent for both bots:${NC}"
echo ""
echo "1. Atlas Bot:"
echo "   https://discord.com/developers/applications/1440057375527665674/bot"
echo ""
echo "2. Financial Advisor Bot:"
echo "   https://discord.com/developers/applications/1440082655449321582/bot"
echo ""
echo "For each bot:"
echo "  • Scroll to 'Privileged Gateway Intents'"
echo "  • Toggle ON 'MESSAGE CONTENT INTENT'"
echo "  • Click 'Save Changes'"
echo ""
read -p "Have you enabled intents for BOTH bots? (yes/no): " response

if [[ "$response" != "yes" ]]; then
    echo -e "${RED}Please enable intents first, then run this script again.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Step 1: Deploying Atlas Bot (Market Intelligence)...${NC}"
echo "════════════════════════════════════════════════════════"
./deploy/gcp-cloud-run-atlas.sh 2>&1 | grep -E "(Building|Deploying|Done|Service URL|ERROR|Successful)" || true

echo ""
echo -e "${GREEN}Step 2: Deploying Financial Advisor Bot (Personal Finance)...${NC}"
echo "════════════════════════════════════════════════════════"
./deploy/gcp-cloud-run-advisor.sh 2>&1 | grep -E "(Building|Deploying|Done|Service URL|ERROR|Successful)" || true

echo ""
echo -e "${GREEN}Step 3: Waiting for bots to start...${NC}"
sleep 20

echo ""
echo -e "${GREEN}Step 4: Checking Atlas status...${NC}"
ATLAS_LOGS=$(gcloud run services logs read agentflow-atlas --region us-central1 --project agentflow-discord-bot --limit 30 2>&1)

if echo "$ATLAS_LOGS" | grep -q "Atlas bot logged in"; then
    echo -e "${GREEN}✅ Atlas is online!${NC}"
    echo "$ATLAS_LOGS" | grep "Atlas bot logged in" | tail -1
elif echo "$ATLAS_LOGS" | grep -q "Used disallowed intents"; then
    echo -e "${RED}❌ Atlas: MESSAGE_CONTENT intent not enabled${NC}"
else
    echo -e "${YELLOW}⚠️  Atlas: Status unclear${NC}"
fi

echo ""
echo -e "${GREEN}Step 5: Checking Financial Advisor status...${NC}"
ADVISOR_LOGS=$(gcloud run services logs read agentflow-advisor --region us-central1 --project agentflow-discord-bot --limit 30 2>&1)

if echo "$ADVISOR_LOGS" | grep -q "Financial Advisor bot logged in"; then
    echo -e "${GREEN}✅ Financial Advisor is online!${NC}"
    echo "$ADVISOR_LOGS" | grep "Financial Advisor bot logged in" | tail -1
elif echo "$ADVISOR_LOGS" | grep -q "Used disallowed intents"; then
    echo -e "${RED}❌ Financial Advisor: MESSAGE_CONTENT intent not enabled${NC}"
else
    echo -e "${YELLOW}⚠️  Financial Advisor: Status unclear${NC}"
fi

echo ""
echo -e "${GREEN}Step 6: Restarting Main Bot...${NC}"
pkill -f "node dist/index.js" 2>/dev/null || true
sleep 2
npm start > bot.log 2>&1 &
echo "   Main bot restarted (PID: $!)"

echo ""
echo "════════════════════════════════════════════════════════"
echo -e "${GREEN}Deployment Complete!${NC}"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📊 Your Three-Bot System:"
echo ""
echo "1. Main Bot (Local):"
echo "   • Channels: All except #crypto, #global-ai, #finance"
echo "   • Status: Running locally"
echo ""
echo "2. Atlas Bot (Cloud Run):"
echo "   • Channels: #crypto, #global-ai"
echo "   • URL: https://agentflow-atlas-213724465032.us-central1.run.app"
echo "   • Logs: gcloud run services logs read agentflow-atlas --region us-central1 --limit 50"
echo ""
echo "3. Financial Advisor (Cloud Run):"
echo "   • Channels: #finance"
echo "   • URL: https://agentflow-advisor-213724465032.us-central1.run.app"
echo "   • Logs: gcloud run services logs read agentflow-advisor --region us-central1 --limit 50"
echo ""
echo "🧪 Test Commands:"
echo ""
echo "Main Bot (#general):"
echo "   !help"
echo ""
echo "Atlas (#crypto or #global-ai):"
echo "   btc price?"
echo "   show me the portfolio"
echo ""
echo "Financial Advisor (#finance):"
echo "   what's my balance?"
echo "   how much did I spend on dining?"
echo ""
echo -e "${GREEN}All three bots are deployed! 🎉${NC}"
