#!/bin/bash

# Deploy All Bots - Hetzner Cloud Deployment Script
# This deploys all 3 bots to Hetzner VPS

set -e

echo "🤖 Deploying All Bots to Hetzner Cloud"
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
echo "════════════════════════════════════════════════════════"
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
echo "════════════════════════════════════════════════════════"
ssh ${HETZNER_USER}@${HETZNER_SERVER} "cd ${PROJECT_DIR} && \
  docker compose -f docker-compose.production.yml build --no-cache && \
  docker compose -f docker-compose.production.yml up -d"

echo ""
echo -e "${GREEN}Step 3: Waiting for containers to start...${NC}"
sleep 30

echo ""
echo -e "${GREEN}Step 4: Checking container status...${NC}"
echo "════════════════════════════════════════════════════════"
ssh ${HETZNER_USER}@${HETZNER_SERVER} "docker ps --format 'table {{.Names}}\t{{.Status}}'"

echo ""
echo "════════════════════════════════════════════════════════"
echo -e "${GREEN}Deployment Complete!${NC}"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📊 Your Three-Bot System (Hetzner VPS):"
echo ""
echo "1. Main Bot (agentflow-bot):"
echo "   • Voice-driven AI coding with Claude"
echo "   • API: http://${HETZNER_SERVER}:3001"
echo ""
echo "2. Atlas Bot (agentflow-atlas):"
echo "   • Market intelligence & crypto analysis"
echo "   • Channels: #crypto, #global-ai"
echo ""
echo "3. Financial Advisor (agentflow-advisor):"
echo "   • Personal finance with Teller API"
echo "   • Channel: #finance"
echo ""
echo "📋 Useful Commands:"
echo ""
echo "  View logs:"
echo "    ssh ${HETZNER_USER}@${HETZNER_SERVER} 'docker logs agentflow-bot -f'"
echo "    ssh ${HETZNER_USER}@${HETZNER_SERVER} 'docker logs agentflow-atlas -f'"
echo "    ssh ${HETZNER_USER}@${HETZNER_SERVER} 'docker logs agentflow-advisor -f'"
echo ""
echo "  Restart all:"
echo "    ssh ${HETZNER_USER}@${HETZNER_SERVER} 'cd /opt/agentflow && docker compose -f docker-compose.production.yml restart'"
echo ""
echo -e "${GREEN}All three bots are deployed! 🎉${NC}"
