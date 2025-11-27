#!/bin/bash

# Verify All Bots Are Online on Hetzner VPS
# Run this to check the status of all 3 bots

set -e

# Configuration
HETZNER_SERVER="178.156.198.233"
HETZNER_USER="root"

echo "🔍 Checking Bot Status on Hetzner VPS..."
echo "════════════════════════════════════════════════════════"
echo ""

# Check all containers
echo "📊 Container Status:"
echo "────────────────────────────────────────────────────────"
ssh ${HETZNER_USER}@${HETZNER_SERVER} "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'" 2>/dev/null || {
    echo "❌ Could not connect to Hetzner VPS"
    exit 1
}

echo ""
echo "════════════════════════════════════════════════════════"
echo ""

# Check health endpoints
echo "🏥 Health Checks:"
echo "────────────────────────────────────────────────────────"

HEALTHY_COUNT=0

# Check Main Bot
echo -n "1️⃣  Main Bot (agentflow-bot)... "
if curl -s --max-time 5 "http://${HETZNER_SERVER}:3001/health" | grep -q "healthy"; then
    echo "✅ Healthy"
    HEALTHY_COUNT=$((HEALTHY_COUNT + 1))
else
    echo "❌ Unhealthy or unreachable"
fi

# Check Atlas
echo -n "2️⃣  Atlas (agentflow-atlas)... "
ATLAS_HEALTH=$(ssh ${HETZNER_USER}@${HETZNER_SERVER} "docker exec agentflow-atlas wget -q -O- http://localhost:8082/health 2>/dev/null" || echo "")
if echo "$ATLAS_HEALTH" | grep -q "healthy"; then
    echo "✅ Healthy"
    HEALTHY_COUNT=$((HEALTHY_COUNT + 1))
else
    echo "❌ Unhealthy or unreachable"
fi

# Check Financial Advisor
echo -n "3️⃣  Financial Advisor (agentflow-advisor)... "
ADVISOR_HEALTH=$(ssh ${HETZNER_USER}@${HETZNER_SERVER} "docker exec agentflow-advisor wget -q -O- http://localhost:8081/health 2>/dev/null" || echo "")
if echo "$ADVISOR_HEALTH" | grep -q "healthy"; then
    echo "✅ Healthy"
    HEALTHY_COUNT=$((HEALTHY_COUNT + 1))
else
    echo "❌ Unhealthy or unreachable"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "📊 Summary: $HEALTHY_COUNT out of 3 bots are healthy"
echo ""

if [ $HEALTHY_COUNT -eq 3 ]; then
    echo "🎉 All bots are online! Your three-bot system is ready!"
    echo ""
    echo "Test commands:"
    echo "  • Main Bot (#agent-chat): !help"
    echo "  • Atlas (#crypto): btc price?"
    echo "  • Financial Advisor (#finance): what's my balance?"
else
    echo "⚠️  Some bots need attention. Check logs:"
    echo ""
    echo "  ssh root@${HETZNER_SERVER} 'docker logs agentflow-bot --tail 50'"
    echo "  ssh root@${HETZNER_SERVER} 'docker logs agentflow-atlas --tail 50'"
    echo "  ssh root@${HETZNER_SERVER} 'docker logs agentflow-advisor --tail 50'"
fi

echo ""
