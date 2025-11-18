#!/bin/bash

# Fully Automated Atlas Setup
# This script does everything automatically

set -e

echo "🌏 Fully Automated Atlas Setup"
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

echo -e "${GREEN}Step 1: Updating channel configuration...${NC}"
echo "  Atlas will now monitor:"
echo "    - #crypto (1339709679537750036)"
echo "    - #global-ai (1439887464524283924)"
echo "  Atlas will NOT monitor:"
echo "    - #finance (your private portfolio tracker)"
echo ""
sleep 2

echo -e "${GREEN}Step 2: Deploying updated Atlas to Cloud Run...${NC}"
./deploy/gcp-cloud-run-atlas.sh 2>&1 | grep -E "(Building|Deploying|Done|Service URL|ERROR)" || true
echo ""

echo -e "${GREEN}Step 3: Waiting for Atlas to start...${NC}"
sleep 15
echo ""

echo -e "${GREEN}Step 4: Checking Atlas status...${NC}"
LOGS=$(gcloud run services logs read agentflow-atlas --region us-central1 --project agentflow-discord-bot --limit 50 2>&1 || echo "")

if echo "$LOGS" | grep -q "Atlas bot logged in"; then
    echo -e "${GREEN}✅ Atlas successfully logged into Discord!${NC}"
    echo ""
    ATLAS_USER=$(echo "$LOGS" | grep "Atlas bot logged in" | tail -1)
    echo "   $ATLAS_USER"
elif echo "$LOGS" | grep -q "Used disallowed intents"; then
    echo -e "${YELLOW}⚠️  Atlas needs MESSAGE_CONTENT intent enabled${NC}"
    echo ""
    echo "Opening Discord Developer Portal..."
    echo ""

    # Try to open browser
    if command -v open &> /dev/null; then
        open "https://discord.com/developers/applications/1440057375527665674/bot"
        echo -e "${YELLOW}Browser opened! Please:${NC}"
        echo "  1. Scroll to 'Privileged Gateway Intents'"
        echo "  2. Toggle ON 'MESSAGE CONTENT INTENT'"
        echo "  3. Click 'Save Changes'"
        echo ""
        read -p "Press ENTER after you've enabled it..."

        echo ""
        echo "Restarting Atlas..."
        gcloud run services update agentflow-atlas --region us-central1 --update-env-vars "RESTART=$(date +%s)" 2>&1 | grep -E "(Done|Deploying)" || true

        echo "Waiting for restart..."
        sleep 15

        LOGS=$(gcloud run services logs read agentflow-atlas --region us-central1 --project agentflow-discord-bot --limit 30 2>&1)
        if echo "$LOGS" | grep -q "Atlas bot logged in"; then
            echo -e "${GREEN}✅ Atlas now online!${NC}"
        else
            echo -e "${RED}Still having issues. Check logs:${NC}"
            echo "gcloud run services logs read agentflow-atlas --region us-central1 --limit 50"
        fi
    else
        echo "Please enable MESSAGE_CONTENT intent manually:"
        echo "https://discord.com/developers/applications/1440057375527665674/bot"
    fi
else
    echo -e "${YELLOW}⚠️  Cannot determine Atlas status. Recent logs:${NC}"
    echo "$LOGS" | tail -10
fi

echo ""
echo -e "${GREEN}Step 5: Restarting main bot...${NC}"
pkill -f "node dist/index.js" 2>/dev/null || true
sleep 2
npm start > bot.log 2>&1 &
echo "   Main bot restarted (PID: $!)"
sleep 5

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo ""
echo "📊 Configuration:"
echo "   Atlas monitors: #crypto, #global-ai"
echo "   Main bot monitors: All other channels"
echo ""
echo "🧪 Test Atlas (in #crypto or #global-ai):"
echo "   btc price?"
echo "   china economic outlook"
echo ""
echo "📝 View Atlas logs:"
echo "   gcloud run services logs read agentflow-atlas --region us-central1 --limit 50"
echo ""
echo -e "${GREEN}Done! 🎉${NC}"
