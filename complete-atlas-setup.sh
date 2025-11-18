#!/bin/bash

# Complete Atlas Setup Script
# This script completes the Atlas bot setup after MESSAGE_CONTENT intent is enabled

echo "🌏 Completing Atlas Bot Setup..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if MESSAGE_CONTENT intent instructions have been read
echo -e "${YELLOW}══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}IMPORTANT: Before running this script${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Have you enabled MESSAGE_CONTENT intent for Atlas bot?"
echo ""
echo "To enable it:"
echo "1. Go to https://discord.com/developers/applications"
echo "2. Select Atlas app (Client ID: 1440057375527665674)"
echo "3. Go to Bot → Privileged Gateway Intents"
echo "4. Enable MESSAGE CONTENT INTENT"
echo "5. Save Changes"
echo ""
read -p "Have you completed this step? (yes/no): " response

if [[ "$response" != "yes" ]]; then
    echo -e "${RED}Please enable MESSAGE_CONTENT intent first, then run this script again.${NC}"
    echo "See ATLAS_FINAL_SETUP_STEPS.md for detailed instructions."
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Great! Proceeding with setup...${NC}"
echo ""

# Step 1: Restart Atlas on Cloud Run
echo -e "${GREEN}Step 1: Restarting Atlas on Cloud Run...${NC}"

gcloud run services update agentflow-atlas \
    --region us-central1 \
    --project agentflow-discord-bot \
    --update-env-vars "LAST_RESTART=$(date +%s)" \
    2>&1 | grep -E "(Done|Service|Revision)"

echo ""
echo -e "${GREEN}✅ Atlas restarted${NC}"
echo ""

# Step 2: Wait for Atlas to come online
echo -e "${GREEN}Step 2: Waiting for Atlas to start...${NC}"
sleep 10

# Check logs
echo ""
echo "Recent Atlas logs:"
gcloud run services logs read agentflow-atlas \
    --region us-central1 \
    --project agentflow-discord-bot \
    --limit 20 2>&1 | tail -10

echo ""

# Step 3: Check if Atlas logged in successfully
echo -e "${GREEN}Step 3: Checking Atlas status...${NC}"

LOGS=$(gcloud run services logs read agentflow-atlas \
    --region us-central1 \
    --project agentflow-discord-bot \
    --limit 30 2>&1)

if echo "$LOGS" | grep -q "Atlas bot logged in"; then
    echo -e "${GREEN}✅ Atlas successfully logged into Discord!${NC}"
elif echo "$LOGS" | grep -q "Used disallowed intents"; then
    echo -e "${RED}❌ Still getting intent error. Please verify MESSAGE_CONTENT intent is enabled and saved.${NC}"
    exit 1
else
    echo -e "${YELLOW}⚠️  Cannot confirm Atlas login status. Check logs manually.${NC}"
fi

echo ""

# Step 4: Restart main bot (if running locally)
echo -e "${GREEN}Step 4: Main bot configuration${NC}"
echo ""
echo "The main bot now ignores messages in these channels:"
echo "  - #crypto (1339709679537750036)"
echo "  - #finance (1439869363502055474)"
echo "  - #global-ai (1439887464524283924)"
echo ""
echo -e "${YELLOW}If your main bot is running locally:${NC}"
echo "  1. Stop it (Ctrl+C)"
echo "  2. Restart with: npm run dev"
echo ""
echo -e "${YELLOW}If your main bot is on Cloud Run:${NC}"
echo "  Run: gcloud run services update agentflow-discord-bot --region us-central1"
echo ""

# Step 5: Summary
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo ""
echo "🌏 Atlas Bot Status:"
echo "   Service URL: https://agentflow-atlas-213724465032.us-central1.run.app"
echo "   Monitoring: #crypto, #finance, #global-ai"
echo ""
echo "📝 Next Steps:"
echo "   1. Restart your main bot (see above)"
echo "   2. Go to Discord and test Atlas"
echo ""
echo "🧪 Test Commands (in #crypto, #finance, or #global-ai):"
echo "   btc price?"
echo "   show me the portfolio"
echo "   china economic outlook"
echo "   @Atlas what's happening with markets?"
echo ""
echo "📊 View Atlas Logs:"
echo "   gcloud run services logs read agentflow-atlas --region us-central1 --limit 50"
echo ""
echo -e "${GREEN}All done! 🎉${NC}"
