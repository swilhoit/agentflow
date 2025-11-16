#!/bin/bash
# Digital Ocean App Platform Deployment Script for AgentFlow

set -e

echo "Deploying AgentFlow to Digital Ocean..."

# Configuration
APP_NAME="agentflow"
REGISTRY_NAME="${DO_REGISTRY_NAME:-agentflow-registry}"

# Build Docker image
echo "Building Docker image..."
docker build -t ${APP_NAME}:latest .

# Login to Digital Ocean Container Registry
echo "Logging in to DO Container Registry..."
doctl registry login

# Tag and push image
echo "Pushing image to DO Registry..."
docker tag ${APP_NAME}:latest registry.digitalocean.com/${REGISTRY_NAME}/${APP_NAME}:latest
docker push registry.digitalocean.com/${REGISTRY_NAME}/${APP_NAME}:latest

echo "Deployment complete!"
echo "Next steps:"
echo "1. Go to Digital Ocean App Platform"
echo "2. Create a new app from the pushed container image"
echo "3. Configure environment variables"
echo "4. Set port to 3001"
