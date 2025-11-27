#!/bin/bash

# Finish Setup - Restart bots on Hetzner VPS

set -e

# Configuration
HETZNER_SERVER="178.156.198.233"
HETZNER_USER="root"
PROJECT_DIR="/opt/agentflow"

echo "🔄 Restarting All Bots on Hetzner VPS..."
echo "════════════════════════════════════════════════════════"
echo ""

echo "Step 1: Restarting containers..."
ssh ${HETZNER_USER}@${HETZNER_SERVER} "cd ${PROJECT_DIR} && docker compose -f docker-compose.production.yml restart"

echo ""
echo "Step 2: Waiting for containers to start..."
sleep 30

echo ""
echo "Step 3: Checking status..."
ssh ${HETZNER_USER}@${HETZNER_SERVER} "docker ps --format 'table {{.Names}}\t{{.Status}}'"

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ SETUP COMPLETE!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📊 Configuration:"
echo "   • Atlas monitors: #crypto, #global-ai"
echo "   • Financial Advisor monitors: #finance"
echo "   • Main bot monitors: All other channels"
echo ""
echo "🧪 Test Atlas (in #crypto or #global-ai):"
echo "   btc price?"
echo "   china economic outlook"
echo ""
echo "🧪 Test Financial Advisor (in #finance):"
echo "   what's my balance?"
echo ""
echo "📝 View Logs:"
echo "   ssh root@${HETZNER_SERVER} 'docker logs agentflow-atlas -f'"
echo "   ssh root@${HETZNER_SERVER} 'docker logs agentflow-advisor -f'"
echo "   ssh root@${HETZNER_SERVER} 'docker logs agentflow-bot -f'"
echo ""
echo "🎉 All bots running on Hetzner VPS!"
