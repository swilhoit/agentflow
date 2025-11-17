# GitHub Actions - Auto Deploy to Cloud Run

## Overview

This setup enables **automatic deployment to Google Cloud Run** whenever you push to the `master` branch.

## Architecture

```
Push to GitHub (master)
    ↓
GitHub Actions triggered
    ↓
Build Docker image
    ↓
Push to Google Container Registry
    ↓
Deploy to Cloud Run
    ↓
Bot restarts with new code ✅
```

## Setup Instructions

### 1. Create Google Cloud Service Account

```bash
# Set your project ID
export PROJECT_ID="agentflow-discord-bot"

# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deployer" \
  --project=$PROJECT_ID

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Create and download key
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@${PROJECT_ID}.iam.gserviceaccount.com

# Copy the contents of github-actions-key.json - you'll need this for GitHub
cat github-actions-key.json
```

### 2. Configure GitHub Secrets

Go to your GitHub repository: **Settings → Secrets and variables → Actions**

Add these secrets:

#### Required Secrets:

| Secret Name | Value | Where to Get It |
|------------|-------|----------------|
| `GCP_SA_KEY` | Contents of `github-actions-key.json` | From step 1 above |
| `GCP_PROJECT_ID` | Your GCP project ID | e.g., `agentflow-discord-bot` |
| `DISCORD_TOKEN` | Your Discord bot token | Discord Developer Portal |
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Anthropic Console |
| `ELEVENLABS_API_KEY` | Your ElevenLabs API key | ElevenLabs Dashboard |
| `ELEVENLABS_AGENT_ID` | Your ElevenLabs agent ID | ElevenLabs Dashboard |
| `ORCHESTRATOR_API_KEY` | Random secure string | Generate with: `openssl rand -hex 32` |
| `ALLOWED_USER_IDS` | Comma-separated Discord user IDs | e.g., `123456789,987654321` |
| `SYSTEM_NOTIFICATION_CHANNEL_ID` | Discord channel ID for notifications | Right-click channel → Copy ID |

#### Optional Secrets (if using these features):

| Secret Name | Value | Where to Get It |
|------------|-------|----------------|
| `GH_TOKEN` | GitHub personal access token | GitHub Settings → Developer settings |
| `TRELLO_API_KEY` | Trello API key | Trello Power-Up Admin Portal |
| `TRELLO_API_TOKEN` | Trello API token | Trello Power-Up Admin Portal |

### 3. Enable Required Google Cloud APIs

```bash
gcloud services enable run.googleapis.com \
  containerregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --project=$PROJECT_ID
```

### 4. Test the Deployment

#### Option A: Push to master
```bash
git add .
git commit -m "test: trigger deployment"
git push origin master
```

#### Option B: Manual trigger
Go to **GitHub → Actions → Deploy to Cloud Run → Run workflow**

### 5. Monitor Deployment

Watch the deployment in real-time:

**GitHub:**
- Go to **Actions** tab in your repository
- Click on the running workflow
- Watch each step execute

**Google Cloud:**
```bash
# Watch Cloud Run deployments
gcloud run services describe agentflow-bot \
  --region us-central1 \
  --format yaml

# View logs
gcloud run services logs read agentflow-bot \
  --region us-central1 \
  --limit 50
```

## Workflow File

Location: `.github/workflows/deploy-cloud-run.yml`

**What it does:**
1. ✅ Checks out your code
2. ✅ Authenticates to Google Cloud
3. ✅ Builds Docker image with your latest code
4. ✅ Pushes image to Google Container Registry
5. ✅ Deploys to Cloud Run with all environment variables
6. ✅ Shows deployment URL

**Triggers:**
- Every push to `master` branch
- Manual trigger via GitHub Actions UI

## Environment Variables

All secrets are automatically injected as environment variables in Cloud Run:

```yaml
DISCORD_TOKEN              # Discord bot authentication
ANTHROPIC_API_KEY          # Claude AI access
ELEVENLABS_API_KEY         # Voice AI access
ELEVENLABS_AGENT_ID        # Voice agent ID
ORCHESTRATOR_API_KEY       # Internal API key
ALLOWED_USER_IDS           # Who can use the bot
SYSTEM_NOTIFICATION_CHANNEL_ID  # Where to send system notifications
GITHUB_TOKEN               # GitHub API access
TRELLO_API_KEY             # Trello integration
TRELLO_API_TOKEN           # Trello integration
GCP_PROJECT_ID             # For Cloud Run deployments
```

## Resource Configuration

Current Cloud Run settings:

```yaml
Memory: 2 GB
CPU: 2 cores
Timeout: 3600 seconds (1 hour)
Max instances: 1  # Discord bot should only run once
Min instances: 0  # Scale to zero when inactive
```

## Troubleshooting

### Build fails with "permission denied"

**Solution:** Check service account permissions
```bash
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:github-actions@*"
```

### Deployment fails with "not found"

**Solution:** Ensure APIs are enabled
```bash
gcloud services list --enabled --project=$PROJECT_ID
```

### Environment variables not working

**Solution:** Check GitHub secrets are set
- Go to **Settings → Secrets and variables → Actions**
- Verify all required secrets are present
- Re-save any that might be incorrect

### Docker build fails

**Solution:** Check Dockerfile exists and is valid
```bash
docker build -t test .
```

### Bot doesn't start after deployment

**Solution:** Check Cloud Run logs
```bash
gcloud run services logs read agentflow-bot \
  --region us-central1 \
  --limit 100
```

## Security Best Practices

### ✅ Do's:
- Use GitHub Secrets for all sensitive data
- Rotate service account keys regularly
- Use least-privilege IAM roles
- Enable Cloud Run authentication when possible
- Review GitHub Actions logs for sensitive data leaks

### ❌ Don'ts:
- Never commit `.json` key files to git
- Don't hard-code secrets in workflow files
- Don't grant `roles/owner` to service accounts
- Don't expose Discord tokens in logs

## Cost Estimation

**Cloud Run pricing (approximate):**
- Free tier: 2 million requests/month
- After free tier: ~$0.00002400 per request
- Memory: ~$0.0000025 per GB-second
- CPU: ~$0.00001 per vCPU-second

**For a bot running 24/7:**
- Estimated cost: $5-15/month (depends on usage)
- Most cost is CPU/memory, not requests
- Scale to zero when inactive to save money

## Monitoring

### View Deployments
```bash
gcloud run revisions list \
  --service agentflow-bot \
  --region us-central1
```

### Check Service Status
```bash
gcloud run services describe agentflow-bot \
  --region us-central1
```

### Real-time Logs
```bash
gcloud run services logs tail agentflow-bot \
  --region us-central1
```

## Manual Rollback

If a deployment breaks something:

```bash
# List revisions
gcloud run revisions list \
  --service agentflow-bot \
  --region us-central1

# Rollback to previous revision
gcloud run services update-traffic agentflow-bot \
  --to-revisions REVISION_NAME=100 \
  --region us-central1
```

## Next Steps

After setup:
1. ✅ Push a test commit to trigger deployment
2. ✅ Monitor GitHub Actions to see it succeed
3. ✅ Check Cloud Run logs to see bot starting
4. ✅ Test bot in Discord to verify it's running
5. ✅ Set up monitoring/alerting (optional)

## Advanced: Multiple Environments

To set up dev/staging/prod:

```yaml
# .github/workflows/deploy-staging.yml
on:
  push:
    branches:
      - develop

# .github/workflows/deploy-production.yml
on:
  push:
    branches:
      - master
    tags:
      - 'v*'
```

Then use different service names and environment variables for each.

---

**Generated with AgentFlow** - Autonomous AI Coding Platform
