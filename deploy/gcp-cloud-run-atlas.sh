#!/bin/bash

# Google Cloud Run Deployment Script for Atlas Bot
# This script deploys the Atlas market intelligence bot to Google Cloud Run

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-agentflow-discord-bot}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="agentflow-atlas"
IMAGE_NAME="agentflow-atlas"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}===================================${NC}"
echo -e "${GREEN}Atlas Bot Cloud Run Deployment${NC}"
echo -e "${GREEN}===================================${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "."; then
    echo -e "${YELLOW}Not logged in to gcloud${NC}"
    echo "Running: gcloud auth login"
    gcloud auth login
fi

# Set project
echo -e "${GREEN}Setting GCP project: $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${GREEN}Enabling required Google Cloud APIs...${NC}"
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    containerregistry.googleapis.com \
    --project=$PROJECT_ID

# Build the Docker image using Atlas Dockerfile
echo -e "${GREEN}Building Atlas Docker image...${NC}"
IMAGE_TAG="gcr.io/$PROJECT_ID/$IMAGE_NAME:latest"

# Use cloudbuild.yaml for custom Dockerfile
cat > cloudbuild-atlas.yaml <<EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-f', 'Dockerfile.atlas', '-t', '$IMAGE_TAG', '.']
images:
  - '$IMAGE_TAG'
EOF

gcloud builds submit \
    --config cloudbuild-atlas.yaml \
    --project=$PROJECT_ID \
    .

# Cleanup temp file
rm -f cloudbuild-atlas.yaml

# Prepare environment variables (filter for Atlas-specific ones)
echo -e "${GREEN}Preparing environment variables...${NC}"

# Check required variables
if [ -z "$ATLAS_DISCORD_TOKEN" ]; then
    echo -e "${RED}Error: ATLAS_DISCORD_TOKEN not set${NC}"
    exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}Error: ANTHROPIC_API_KEY not set${NC}"
    exit 1
fi

if [ -z "$PERPLEXITY_API_KEY" ]; then
    echo -e "${RED}Error: PERPLEXITY_API_KEY not set${NC}"
    exit 1
fi

echo "ATLAS_DISCORD_TOKEN: ${ATLAS_DISCORD_TOKEN:0:20}..."
echo "PERPLEXITY_API_KEY: ${PERPLEXITY_API_KEY:0:15}..."
echo "GLOBAL_MARKETS_CHANNELS: $GLOBAL_MARKETS_CHANNELS"

# Create env vars file
cat > atlas-env.yaml <<EOF
ATLAS_DISCORD_TOKEN: "${ATLAS_DISCORD_TOKEN}"
ATLAS_DISCORD_CLIENT_ID: "${ATLAS_DISCORD_CLIENT_ID}"
ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
PERPLEXITY_API_KEY: "${PERPLEXITY_API_KEY}"
FINNHUB_API_KEY: "${FINNHUB_API_KEY}"
GLOBAL_MARKETS_CHANNELS: "${GLOBAL_MARKETS_CHANNELS}"
NODE_ENV: "production"
LOG_LEVEL: "INFO"
EOF

# Deploy to Cloud Run
echo -e "${GREEN}Deploying Atlas to Cloud Run...${NC}"

gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_TAG \
    --region $REGION \
    --platform managed \
    --no-allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --timeout 3600 \
    --max-instances 1 \
    --min-instances 1 \
    --env-vars-file atlas-env.yaml \
    --no-cpu-throttling \
    --project=$PROJECT_ID

# Cleanup
rm -f atlas-env.yaml

# Get deployment info
echo -e "${GREEN}===================================${NC}"
echo -e "${GREEN}Atlas Bot Deployment Successful!${NC}"
echo -e "${GREEN}===================================${NC}"
echo -e "Service Name: ${YELLOW}$SERVICE_NAME${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"
echo -e "Min Instances: ${YELLOW}1${NC} (Always running)"
echo -e ""
echo -e "${GREEN}View logs:${NC}"
echo -e "gcloud run logs read $SERVICE_NAME --region $REGION --project $PROJECT_ID --limit 50"
echo -e ""
echo -e "${GREEN}Check status:${NC}"
echo -e "gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID"
echo -e ""
echo -e "${GREEN}Update environment variables:${NC}"
echo -e "gcloud run services update $SERVICE_NAME --region $REGION --update-env-vars KEY=VALUE"
echo -e ""
echo -e "${YELLOW}Note: Atlas bot should now be online in Discord!${NC}"
