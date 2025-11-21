# AgentFlow Cloud Deployment Guide

This guide explains how to deploy Docker containers to Google Cloud Run with Claude Code enabled, directly from your voice bot.

## Quick Start

### 1. Install Google Cloud SDK

```bash
# macOS
brew install --cask google-cloud-sdk

# Or download from:
# https://cloud.google.com/sdk/docs/install
```

### 2. Authenticate with Google Cloud

```bash
gcloud auth login
gcloud auth application-default login
```

### 3. Create a Google Cloud Project

```bash
# Set your project ID
export GCP_PROJECT_ID="agentflow-discord-bot"

# Create project
gcloud projects create $GCP_PROJECT_ID

# Set as active project
gcloud config set project $GCP_PROJECT_ID

# Enable billing (required for Cloud Run)
# Visit: https://console.cloud.google.com/billing
```

### 4. Enable Required APIs

```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com
```

## Deploy via Voice Bot

Once everything is set up, you can deploy containers using voice commands:

**Say:** "Deploy this application to Google Cloud"

The bot will:
1. Build a Docker image
2. Push to Google Container Registry  
3. Deploy to Cloud Run
4. Return the public URL

## Deploy via Script

You can also deploy manually:

```bash
# Set environment variables
export GCP_PROJECT_ID="your-project-id"
export SERVICE_NAME="my-service"

# Run deployment
./deploy/gcp-cloud-run.sh
```

## Example Dockerfile with Claude Code

Here's an example Dockerfile that includes Claude Code CLI:

```dockerfile
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN curl -fsSL https://storage.googleapis.com/anthropic-cli/install.sh | sh

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 8080

# Set environment variables
ENV PORT=8080
ENV ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}

# Start command
CMD ["npm", "start"]
```

## Using the Cloud Deployment Service Programmatically

```typescript
import { CloudDeploymentService } from './services/cloudDeployment';

const deployer = new CloudDeploymentService('my-project-id', 'us-central1');

// Deploy a service
const result = await deployer.deployToCloudRun({
  projectId: 'my-project-id',
  region: 'us-central1',
  serviceName: 'my-awesome-service',
  imageName: 'my-app',
  buildContext: './my-app',
  dockerfile: './my-app/Dockerfile',
  envVars: {
    NODE_ENV: 'production',
    API_KEY: 'secret'
  },
  claudeApiKey: process.env.ANTHROPIC_API_KEY
});

console.log('Service URL:', result.serviceUrl);
console.log('Logs:', result.logs);
```

## Voice Command Examples

Here are some voice commands you can use:

- **"Deploy my web app to the cloud"**
- **"Launch a new container on Google Cloud"**
- **"Deploy the API server with Claude Code"**
- **"Show me my running cloud services"**
- **"Get logs for my deployment"**
- **"Delete the test service"**

## Environment Variables

The following environment variables can be set in your `.env` file:

```bash
# Google Cloud Configuration
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1

# Anthropic API Key (for Claude Code in containers)
ANTHROPIC_API_KEY=sk-ant-...
```

## Common Commands

### View Running Services

```bash
gcloud run services list --project $GCP_PROJECT_ID
```

### View Service Logs

```bash
gcloud run services logs read SERVICE_NAME \
  --project $GCP_PROJECT_ID \
  --region us-central1
```

### Delete a Service

```bash
gcloud run services delete SERVICE_NAME \
  --project $GCP_PROJECT_ID \
  --region us-central1
```

### Update Environment Variables

```bash
gcloud run services update SERVICE_NAME \
  --update-env-vars KEY1=VALUE1,KEY2=VALUE2 \
  --project $GCP_PROJECT_ID \
  --region us-central1
```

## Pricing

Google Cloud Run pricing (as of 2024):
- **Free tier**: 2 million requests/month, 360,000 GB-seconds memory, 180,000 vCPU-seconds
- **Beyond free tier**: ~$0.00002400 per request, $0.00000250 per GB-second

Most small applications stay within the free tier!

## Troubleshooting

### "Permission denied" errors

```bash
# Re-authenticate
gcloud auth login
gcloud auth application-default login
```

### "Billing not enabled"

1. Go to https://console.cloud.google.com/billing
2. Link a billing account to your project

### "API not enabled"

```bash
gcloud services enable cloudbuild.googleapis.com run.googleapis.com
```

### Container fails to start

```bash
# View logs
gcloud run services logs read SERVICE_NAME --project $GCP_PROJECT_ID

# Check if port 8080 is exposed
# Cloud Run requires containers to listen on port 8080
```

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use Secret Manager** for sensitive data:
   ```bash
   echo -n "my-secret" | gcloud secrets create my-secret --data-file=-
   ```
3. **Enable authentication** for production services:
   ```bash
   # Remove --allow-unauthenticated flag
   gcloud run deploy SERVICE_NAME --no-allow-unauthenticated
   ```
4. **Use least-privilege IAM roles**

## Next Steps

- [ ] Set up CI/CD with GitHub Actions
- [ ] Configure custom domains
- [ ] Set up monitoring and alerts
- [ ] Implement auto-scaling policies
- [ ] Add Cloud SQL database integration

## Support

For questions or issues:
- Google Cloud Run Docs: https://cloud.google.com/run/docs
- Claude Code Docs: https://docs.claude.com/claude-code
