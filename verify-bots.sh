#!/bin/bash

# Verify Both Bots Are Online
# Run this after enabling MESSAGE_CONTENT intent for both bots

set -e

echo "🔍 Checking Bot Status..."
echo "════════════════════════════════════════════════════════"
echo ""

# Check Atlas
echo "1️⃣  Checking Atlas Bot (Market Intelligence)..."
echo "────────────────────────────────────────────────────────"
ATLAS_LOGS=$(gcloud run services logs read agentflow-atlas --region us-central1 --project agentflow-discord-bot --limit 50 2>&1)

if echo "$ATLAS_LOGS" | grep -q "Atlas bot logged in"; then
    echo "✅ Atlas is ONLINE!"
    echo "$ATLAS_LOGS" | grep "Atlas bot logged in" | tail -1
elif echo "$ATLAS_LOGS" | grep -q "Used disallowed intents"; then
    echo "❌ Atlas: MESSAGE_CONTENT intent NOT enabled"
    echo "   Please enable it at:"
    echo "   https://discord.com/developers/applications/1440057375527665674/bot"
else
    echo "⚠️  Atlas: Status unclear"
    echo "$ATLAS_LOGS" | tail -5
fi

echo ""

# Check Financial Advisor
echo "2️⃣  Checking Financial Advisor Bot..."
echo "────────────────────────────────────────────────────────"
ADVISOR_LOGS=$(gcloud run services logs read agentflow-advisor --region us-central1 --project agentflow-discord-bot --limit 50 2>&1)

if echo "$ADVISOR_LOGS" | grep -q "Financial Advisor bot logged in"; then
    echo "✅ Financial Advisor is ONLINE!"
    echo "$ADVISOR_LOGS" | grep "Financial Advisor bot logged in" | tail -1
elif echo "$ADVISOR_LOGS" | grep -q "Used disallowed intents"; then
    echo "❌ Financial Advisor: MESSAGE_CONTENT intent NOT enabled"
    echo "   Please enable it at:"
    echo "   https://discord.com/developers/applications/1440082655449321582/bot"
else
    echo "⚠️  Financial Advisor: Status unclear"
    echo "$ADVISOR_LOGS" | tail -5
fi

echo ""

# Check Main Bot
echo "3️⃣  Checking Main Bot (Local)..."
echo "────────────────────────────────────────────────────────"
if pgrep -f "node dist/index.js" > /dev/null; then
    echo "✅ Main Bot is running locally"
else
    echo "⚠️  Main Bot not running - start with: npm start"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "📊 Summary:"
echo ""

# Count online bots
ONLINE_COUNT=0

if echo "$ATLAS_LOGS" | grep -q "Atlas bot logged in"; then
    ONLINE_COUNT=$((ONLINE_COUNT + 1))
fi

if echo "$ADVISOR_LOGS" | grep -q "Financial Advisor bot logged in"; then
    ONLINE_COUNT=$((ONLINE_COUNT + 1))
fi

if pgrep -f "node dist/index.js" > /dev/null; then
    ONLINE_COUNT=$((ONLINE_COUNT + 1))
fi

echo "   $ONLINE_COUNT out of 3 bots are online"

if [ $ONLINE_COUNT -eq 3 ]; then
    echo ""
    echo "🎉 All bots are online! Your three-bot system is ready!"
    echo ""
    echo "Test commands:"
    echo "  • Main Bot (#general): !help"
    echo "  • Atlas (#crypto): btc price?"
    echo "  • Financial Advisor (#finance): what's my balance?"
else
    echo ""
    echo "⚠️  Some bots need attention. See details above."
fi

echo ""
