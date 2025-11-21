# Quick Start - CI/CD Auto-Deployment

## 🚀 One-Time Setup (5 minutes)

### 1. Run the setup script
```bash
./scripts/setup-github-actions.sh
```

This will:
- ✅ Create Google Cloud service account
- ✅ Grant necessary permissions
- ✅ Generate service account key
- ✅ Enable required APIs

### 2. Add GitHub Secrets

Go to: **GitHub Repository → Settings → Secrets and variables → Actions → New repository secret**

Copy the service account key:
```bash
cat github-actions-key.json | pbcopy  # macOS
cat github-actions-key.json            # Copy manually
```

Add these secrets:

**Required:**
- `GCP_SA_KEY` - Paste the service account key JSON
- `GCP_PROJECT_ID` - Your GCP project ID (e.g., `agentflow-discord-bot`)
- `DISCORD_TOKEN` - From Discord Developer Portal
- `ANTHROPIC_API_KEY` - From Anthropic Console
- `ELEVENLABS_API_KEY` - From ElevenLabs Dashboard
- `ELEVENLABS_AGENT_ID` - From ElevenLabs Dashboard
- `ORCHESTRATOR_API_KEY` - Generate: `openssl rand -hex 32`
- `ALLOWED_USER_IDS` - Your Discord user ID(s)
- `SYSTEM_NOTIFICATION_CHANNEL_ID` - Discord channel ID for system notifications

**Optional:**
- `GH_TOKEN` - GitHub personal access token (for GitHub integrations)
- `TRELLO_API_KEY` - Trello API key (for Trello integrations)
- `TRELLO_API_TOKEN` - Trello API token (for Trello integrations)

### 3. Test it!

```bash
git add .
git commit -m "test: trigger auto-deployment"
git push origin master
```

Watch it deploy:
- **GitHub:** Go to Actions tab
- **Cloud Run:** `gcloud run services describe agentflow-bot --region us-central1`

## ✨ How It Works

Every time you push to `master`:

1. GitHub Actions triggers
2. Builds Docker image with your code
3. Pushes to Google Container Registry
4. Deploys to Cloud Run
5. Bot restarts with new code

**Total deployment time: ~3-5 minutes**

## 🎯 Common Commands

**View deployment logs:**
```bash
gcloud run services logs read agentflow-bot --region us-central1 --limit 50
```

**Check service status:**
```bash
gcloud run services describe agentflow-bot --region us-central1
```

**Manual deployment trigger:**
Go to **GitHub → Actions → Deploy to Cloud Run → Run workflow**

**Rollback to previous version:**
```bash
gcloud run revisions list --service agentflow-bot --region us-central1
gcloud run services update-traffic agentflow-bot --to-revisions REVISION_NAME=100 --region us-central1
```

## 🔒 Security

- ✅ Service account key is in GitHub Secrets (encrypted)
- ✅ Key is NOT committed to git (.gitignore)
- ✅ Least-privilege IAM permissions
- ✅ All environment variables encrypted

## 💰 Cost

- **Free tier:** 2 million requests/month
- **Typical cost:** $5-15/month for 24/7 bot
- **Scale to zero:** Saves money when inactive

## 📚 Full Documentation

See `GITHUB_ACTIONS_SETUP.md` for detailed information.

---

**That's it!** Now every push automatically deploys to production. 🎉
