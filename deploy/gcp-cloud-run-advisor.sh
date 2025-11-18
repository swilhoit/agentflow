#!/bin/bash

# Google Cloud Run Deployment Script for Financial Advisor Bot
# This script deploys the Financial Advisor personal finance bot to Google Cloud Run

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-agentflow-discord-bot}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="agentflow-advisor"
IMAGE_NAME="agentflow-advisor"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}===================================${NC}"
echo -e "${GREEN}Financial Advisor Bot Deployment${NC}"
echo -e "${GREEN}===================================${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
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

# Build the Docker image using Advisor Dockerfile
echo -e "${GREEN}Building Financial Advisor Docker image...${NC}"
IMAGE_TAG="gcr.io/$PROJECT_ID/$IMAGE_NAME:latest"

# Use cloudbuild.yaml for custom Dockerfile
cat > cloudbuild-advisor.yaml <<EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-f', 'Dockerfile.advisor', '-t', '$IMAGE_TAG', '.']
images:
  - '$IMAGE_TAG'
EOF

gcloud builds submit \
    --config cloudbuild-advisor.yaml \
    --project=$PROJECT_ID \
    .

# Cleanup temp file
rm -f cloudbuild-advisor.yaml

# Prepare environment variables
echo -e "${GREEN}Preparing environment variables...${NC}"

# Check required variables
if [ -z "$ADVISOR_DISCORD_TOKEN" ]; then
    echo -e "${RED}Error: ADVISOR_DISCORD_TOKEN not set${NC}"
    echo "You need to create a Discord bot for Financial Advisor first."
    exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}Error: ANTHROPIC_API_KEY not set${NC}"
    exit 1
fi

if [ -z "$TELLER_API_TOKEN" ]; then
    echo -e "${RED}Error: TELLER_API_TOKEN not set${NC}"
    exit 1
fi

echo "ADVISOR_DISCORD_TOKEN: ${ADVISOR_DISCORD_TOKEN:0:20}..."
echo "TELLER_API_TOKEN: ${TELLER_API_TOKEN:0:15}..."
echo "FINANCIAL_ADVISOR_CHANNELS: $FINANCIAL_ADVISOR_CHANNELS"

# Create env vars file
cat > advisor-env.yaml <<EOF
ADVISOR_DISCORD_TOKEN: "${ADVISOR_DISCORD_TOKEN}"
ADVISOR_DISCORD_CLIENT_ID: "${ADVISOR_DISCORD_CLIENT_ID}"
ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
TELLER_API_TOKEN: "${TELLER_API_TOKEN}"
FINANCIAL_ADVISOR_CHANNELS: "${FINANCIAL_ADVISOR_CHANNELS}"
NODE_ENV: "production"
LOG_LEVEL: "INFO"
EOF

# Deploy to Cloud Run
echo -e "${GREEN}Deploying Financial Advisor to Cloud Run...${NC}"

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
    --env-vars-file advisor-env.yaml \
    --no-cpu-throttling \
    --project=$PROJECT_ID

# Cleanup
rm -f advisor-env.yaml

# Get deployment info
echo -e "${GREEN}===================================${NC}"
echo -e "${GREEN}Financial Advisor Deployment Successful!${NC}"
echo -e "${GREEN}===================================${NC}"
echo -e "Service Name: ${YELLOW}$SERVICE_NAME${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"
echo -e "Min Instances: ${YELLOW}1${NC} (Always running)"
echo -e ""
echo -e "${GREEN}View logs:${NC}"
echo -e "gcloud run services logs read $SERVICE_NAME --region $REGION --project $PROJECT_ID --limit 50"
echo -e ""
echo -e "${GREEN}Check status:${NC}"
echo -e "gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID"
echo -e ""
echo -e "${YELLOW}Note: Financial Advisor bot should now be online in Discord!${NC}"
echo -e "${YELLOW}Monitor #finance channel for personal finance assistance.${NC}"
