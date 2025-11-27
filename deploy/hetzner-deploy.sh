#!/bin/bash
# Hetzner Cloud Deployment Script for AgentFlow
# Usage: ./deploy/hetzner-deploy.sh

set -e

# Configuration
HETZNER_SERVER="178.156.198.233"
HETZNER_USER="root"
PROJECT_DIR="/opt/agentflow"

echo "🚀 Deploying AgentFlow to Hetzner Cloud..."

# Sync source code (excluding unnecessary files)
echo "📁 Syncing source code..."
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

# Build and deploy
echo "🔨 Building and deploying containers..."
ssh ${HETZNER_USER}@${HETZNER_SERVER} "cd ${PROJECT_DIR} && \
  docker compose -f docker-compose.production.yml build --no-cache && \
  docker compose -f docker-compose.production.yml up -d"

# Wait for health checks
echo "⏳ Waiting for containers to become healthy..."
sleep 30

# Check status
echo "📊 Checking container status..."
ssh ${HETZNER_USER}@${HETZNER_SERVER} "docker ps --format 'table {{.Names}}\t{{.Status}}'"

echo "✅ Deployment complete!"
echo ""
echo "📍 Server: ${HETZNER_SERVER}"
echo "🌐 Main Bot API: http://${HETZNER_SERVER}:3001"
