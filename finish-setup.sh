#!/bin/bash

# Finish Setup - Run this after enabling MESSAGE_CONTENT intent

echo "🔄 Restarting Atlas with enabled intent..."
echo ""

gcloud run services update agentflow-atlas \
  --region us-central1 \
  --project agentflow-discord-bot \
  --update-env-vars "RESTART=$(date +%s)" \
  2>&1 | grep -E "(Done|Deploying|Routing)" || true

echo ""
echo "⏳ Waiting for Atlas to come online..."
sleep 15

echo ""
echo "📊 Checking Atlas status..."
LOGS=$(gcloud run services logs read agentflow-atlas --region us-central1 --project agentflow-discord-bot --limit 50 2>&1)

if echo "$LOGS" | grep -q "Atlas bot logged in"; then
    echo "✅ SUCCESS! Atlas is now online in Discord!"
    echo ""
    echo "$LOGS" | grep "Atlas bot logged in" | tail -1
    echo "$LOGS" | grep "Monitoring" | tail -1
elif echo "$LOGS" | grep -q "Used disallowed intents"; then
    echo "❌ Still getting intent error"
    echo "   Please verify MESSAGE_CONTENT intent is enabled and saved"
    exit 1
else
    echo "⚠️  Uncertain status. Recent logs:"
    echo "$LOGS" | tail -10
fi

echo ""
echo "🔄 Restarting main bot..."
pkill -f "node dist/index.js" 2>/dev/null || true
sleep 2
npm start > bot.log 2>&1 &
MAIN_PID=$!
echo "   Main bot started (PID: $MAIN_PID)"

sleep 5

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ SETUP COMPLETE!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📊 Configuration:"
echo "   • Atlas monitors: #crypto, #global-ai"
echo "   • Main bot monitors: All other channels (#finance, #general, etc.)"
echo ""
echo "🧪 Test Atlas (in #crypto or #global-ai):"
echo "   btc price?"
echo "   china economic outlook"
echo "   show me the portfolio"
echo ""
echo "🧪 Test Main Bot (in #general or #agent-chat):"
echo "   !help"
echo ""
echo "📝 View Logs:"
echo "   Atlas:  gcloud run services logs read agentflow-atlas --region us-central1 --limit 50"
echo "   Main:   tail -f bot.log"
echo ""
echo "🎉 All done! Atlas is live on Cloud Run!"
