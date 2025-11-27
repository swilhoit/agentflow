#!/bin/bash

# Fully Automated Bot Setup on Hetzner VPS
# This script deploys and verifies all bots

set -e

echo "🤖 Fully Automated Bot Setup (Hetzner VPS)"
echo "════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
HETZNER_SERVER="178.156.198.233"
HETZNER_USER="root"
PROJECT_DIR="/opt/agentflow"

# Load environment
set -a
source .env 2>/dev/null
set +a

echo -e "${GREEN}Step 1: Syncing code to Hetzner VPS...${NC}"
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude '*.log' \
  --exclude 'dashboard' \
  --exclude 'scripts' \
  --exclude 'docs' \
  --exclude '.github' \
  . ${HETZNER_USER}@${HETZNER_SERVER}:${PROJECT_DIR}/

echo ""
echo -e "${GREEN}Step 2: Building and deploying containers...${NC}"
ssh ${HETZNER_USER}@${HETZNER_SERVER} "cd ${PROJECT_DIR} && \
  docker compose -f docker-compose.production.yml build --no-cache && \
  docker compose -f docker-compose.production.yml up -d"

echo ""
echo -e "${GREEN}Step 3: Waiting for containers to start...${NC}"
sleep 30

echo ""
echo -e "${GREEN}Step 4: Checking container status...${NC}"
ssh ${HETZNER_USER}@${HETZNER_SERVER} "docker ps --format 'table {{.Names}}\t{{.Status}}'"

echo ""
echo -e "${GREEN}Step 5: Verifying health checks...${NC}"

HEALTHY_COUNT=0

# Check Main Bot
echo -n "  Main Bot... "
if curl -s --max-time 5 "http://${HETZNER_SERVER}:3001/health" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Healthy${NC}"
    HEALTHY_COUNT=$((HEALTHY_COUNT + 1))
else
    echo -e "${RED}❌ Unhealthy${NC}"
fi

# Check Atlas (internal healthcheck)
echo -n "  Atlas... "
ATLAS_HEALTH=$(ssh ${HETZNER_USER}@${HETZNER_SERVER} "docker exec agentflow-atlas wget -q -O- http://localhost:8082/health 2>/dev/null" || echo "")
if echo "$ATLAS_HEALTH" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Healthy${NC}"
    HEALTHY_COUNT=$((HEALTHY_COUNT + 1))
else
    echo -e "${RED}❌ Unhealthy${NC}"
fi

# Check Advisor (internal healthcheck)
echo -n "  Advisor... "
ADVISOR_HEALTH=$(ssh ${HETZNER_USER}@${HETZNER_SERVER} "docker exec agentflow-advisor wget -q -O- http://localhost:8081/health 2>/dev/null" || echo "")
if echo "$ADVISOR_HEALTH" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Healthy${NC}"
    HEALTHY_COUNT=$((HEALTHY_COUNT + 1))
else
    echo -e "${RED}❌ Unhealthy${NC}"
fi

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"

if [ $HEALTHY_COUNT -eq 3 ]; then
    echo -e "${GREEN}✅ Setup Complete! All 3 bots are healthy!${NC}"
else
    echo -e "${YELLOW}⚠️  Setup complete but only $HEALTHY_COUNT/3 bots are healthy${NC}"
    echo ""
    echo "Check logs with:"
    echo "  ssh root@${HETZNER_SERVER} 'docker logs agentflow-bot --tail 50'"
fi

echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo ""
echo "📊 Configuration:"
echo "   Atlas monitors: #crypto, #global-ai"
echo "   Advisor monitors: #finance"
echo "   Main bot monitors: All other channels"
echo ""
echo "🧪 Test Atlas (in #crypto or #global-ai):"
echo "   btc price?"
echo "   china economic outlook"
echo ""
echo "📝 View Logs:"
echo "   ssh root@${HETZNER_SERVER} 'docker logs agentflow-atlas -f'"
echo ""
echo -e "${GREEN}Done! 🎉${NC}"
