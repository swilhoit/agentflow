#!/bin/bash

# Google Cloud Run Deployment Script
# This script deploys the AgentFlow bot to Google Cloud Run

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-agentflow-discord-bot}"
IMAGE_NAME="agentflow"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}===================================${NC}"
echo -e "${GREEN}AgentFlow Cloud Run Deployment${NC}"
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

# Build the Docker image
echo -e "${GREEN}Building Docker image...${NC}"
IMAGE_TAG="gcr.io/$PROJECT_ID/$IMAGE_NAME:latest"

gcloud builds submit \
    --tag $IMAGE_TAG \
    --project=$PROJECT_ID \
    .

# Deploy to Cloud Run
echo -e "${GREEN}Deploying to Cloud Run...${NC}"

gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_TAG \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --timeout 3600 \
    --max-instances 10 \
    --set-env-vars="$(cat .env | grep -v '^#' | grep -v '^$' | tr '\n' ',' | sed 's/,$//')" \
    --project=$PROJECT_ID

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --region $REGION \
    --project=$PROJECT_ID \
    --format='value(status.url)')

echo -e "${GREEN}===================================${NC}"
echo -e "${GREEN}Deployment successful!${NC}"
echo -e "${GREEN}===================================${NC}"
echo -e "Service URL: ${YELLOW}$SERVICE_URL${NC}"
echo -e "Logs: ${YELLOW}gcloud run logs read $SERVICE_NAME --region $REGION --project $PROJECT_ID${NC}"
