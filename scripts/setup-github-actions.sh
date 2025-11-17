#!/bin/bash

set -e

echo "🚀 AgentFlow - GitHub Actions Setup Script"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed${NC}"
    echo "Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}⚠️  gh CLI is not installed (optional but recommended)${NC}"
    echo "Install it from: https://cli.github.com/"
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Get project ID
read -p "Enter your GCP Project ID (e.g., agentflow-discord-bot): " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Project ID is required${NC}"
    exit 1
fi

# Set project
echo -e "\n${YELLOW}Setting GCP project...${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "\n${YELLOW}Enabling required Google Cloud APIs...${NC}"
gcloud services enable run.googleapis.com \
  containerregistry.googleapis.com \
  cloudbuild.googleapis.com \
  iam.googleapis.com

echo -e "${GREEN}✅ APIs enabled${NC}"

# Create service account
echo -e "\n${YELLOW}Creating GitHub Actions service account...${NC}"

SA_NAME="github-actions"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Check if service account already exists
if gcloud iam service-accounts describe $SA_EMAIL &> /dev/null; then
    echo -e "${YELLOW}⚠️  Service account already exists${NC}"
    read -p "Do you want to use the existing service account? (y/n): " USE_EXISTING
    if [ "$USE_EXISTING" != "y" ]; then
        exit 1
    fi
else
    gcloud iam service-accounts create $SA_NAME \
      --display-name="GitHub Actions Deployer" \
      --project=$PROJECT_ID
    echo -e "${GREEN}✅ Service account created${NC}"
fi

# Grant permissions
echo -e "\n${YELLOW}Granting IAM permissions...${NC}"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin" \
  --quiet

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.admin" \
  --quiet

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser" \
  --quiet

echo -e "${GREEN}✅ IAM permissions granted${NC}"

# Create service account key
echo -e "\n${YELLOW}Creating service account key...${NC}"

KEY_FILE="github-actions-key.json"

if [ -f "$KEY_FILE" ]; then
    echo -e "${YELLOW}⚠️  Key file already exists${NC}"
    read -p "Do you want to overwrite it? (y/n): " OVERWRITE
    if [ "$OVERWRITE" == "y" ]; then
        rm $KEY_FILE
    else
        echo -e "${RED}❌ Aborted${NC}"
        exit 1
    fi
fi

gcloud iam service-accounts keys create $KEY_FILE \
  --iam-account=$SA_EMAIL

echo -e "${GREEN}✅ Service account key created: $KEY_FILE${NC}"

# Summary
echo ""
echo "=========================================="
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Go to GitHub repository Settings → Secrets and variables → Actions"
echo "2. Add the following secrets:"
echo ""
echo "   Required Secrets:"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   GCP_SA_KEY                     ← Copy contents of $KEY_FILE"
echo "   GCP_PROJECT_ID                 ← $PROJECT_ID"
echo "   DISCORD_TOKEN                  ← Your Discord bot token"
echo "   ANTHROPIC_API_KEY              ← Your Anthropic API key"
echo "   ELEVENLABS_API_KEY             ← Your ElevenLabs API key"
echo "   ELEVENLABS_AGENT_ID            ← Your ElevenLabs agent ID"
echo "   ORCHESTRATOR_API_KEY           ← Generate with: openssl rand -hex 32"
echo "   ALLOWED_USER_IDS               ← Comma-separated Discord user IDs"
echo "   SYSTEM_NOTIFICATION_CHANNEL_ID ← Discord channel ID"
echo ""
echo "   Optional Secrets (if using these features):"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   GH_TOKEN                       ← GitHub personal access token"
echo "   TRELLO_API_KEY                 ← Trello API key"
echo "   TRELLO_API_TOKEN               ← Trello API token"
echo ""
echo "3. Copy GCP_SA_KEY value:"
echo ""
echo -e "${YELLOW}   cat $KEY_FILE | pbcopy${NC}  # Copies to clipboard on macOS"
echo "   cat $KEY_FILE                # Display to copy manually"
echo ""
echo "4. Test deployment:"
echo ""
echo "   git add ."
echo "   git commit -m \"test: trigger deployment\""
echo "   git push origin master"
echo ""
echo "5. Monitor deployment at:"
echo "   https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\).git/\1/')/actions"
echo ""
echo "⚠️  IMPORTANT: Keep $KEY_FILE secure and do NOT commit it to git!"
echo ""

# Offer to open GitHub secrets page
if command -v gh &> /dev/null; then
    echo ""
    read -p "Open GitHub secrets page now? (y/n): " OPEN_GITHUB
    if [ "$OPEN_GITHUB" == "y" ]; then
        gh repo view --web
        echo "Navigate to: Settings → Secrets and variables → Actions"
    fi
fi

echo ""
echo "📚 Full documentation: GITHUB_ACTIONS_SETUP.md"
echo ""
