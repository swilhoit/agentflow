# Atlas Bot - Final Setup Steps 🌏

## ✅ What's Done

1. ✅ Atlas bot code written and tested
2. ✅ Docker image built and pushed to GCR
3. ✅ Deployed to Google Cloud Run
4. ✅ Environment variables configured
5. ✅ Main bot updated to ignore market channels

## 🔧 Remaining Steps (Do These Now)

### Step 1: Enable MESSAGE_CONTENT Intent

Atlas needs the MESSAGE_CONTENT privileged intent to read messages.

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your Atlas application (Client ID: `1440057375527665674`)
3. Go to **Bot** section (left sidebar)
4. Scroll down to **Privileged Gateway Intents**
5. **Enable these intents**:
   - ✅ **MESSAGE CONTENT INTENT** (REQUIRED)
   - ✅ SERVER MEMBERS INTENT (optional, for better member tracking)
6. Click **Save Changes**

### Step 2: Restart Atlas on Cloud Run

After enabling the intent, restart the Cloud Run service:

```bash
gcloud run services update agentflow-atlas \
  --region us-central1 \
  --project agentflow-discord-bot
```

Or just trigger a new revision (no changes needed):

```bash
gcloud run services update agentflow-atlas \
  --region us-central1 \
  --update-env-vars LAST_RESTART="$(date +%s)"
```

### Step 3: Verify Atlas is Online

Check the logs:

```bash
gcloud run services logs read agentflow-atlas \
  --region us-central1 \
  --project agentflow-discord-bot \
  --limit 30
```

You should see:
```
✅ Atlas bot logged in as global markets intelligence#5310
📡 Monitoring 3 channels
```

### Step 4: Restart Your Main Bot

The main bot needs to reload its configuration to ignore market channels.

**If running locally**:
```bash
# Stop current bot (Ctrl+C)

# Restart
npm run dev
```

**If deployed on Cloud Run**:
```bash
gcloud run services update agentflow-discord-bot \
  --region us-central1 \
  --project agentflow-discord-bot
```

### Step 5: Test Both Bots

#### Test Atlas (in #crypto, #finance, or #global-ai):

```
btc price?
```

**Expected**: Atlas responds with BTC price

```
show me the portfolio
```

**Expected**: Atlas shows AI Manhattan portfolio

```
china economic outlook
```

**Expected**: Atlas uses Perplexity to provide analysis

#### Test Main Bot (in #general or #agent-chat):

```
!help
```

**Expected**: Main bot responds with help menu

#### Test Separation (in #crypto):

```
!help
```

**Expected**: Neither bot responds (main bot ignores market channels, Atlas only responds to market keywords)

## 📊 Monitoring

### Check Atlas Status

```bash
# View logs
gcloud run services logs read agentflow-atlas --region us-central1 --limit 50

# Check service status
gcloud run services describe agentflow-atlas --region us-central1

# View metrics
gcloud run services list --region us-central1
```

### Check if Atlas is Online in Discord

Go to your Discord server → Members list → Look for **"global markets intelligence"** bot

- 🟢 Green = Online and ready
- ⚪ Offline = Check logs for errors

## 🐛 Troubleshooting

### Atlas shows offline in Discord

**Cause**: MESSAGE_CONTENT intent not enabled

**Fix**: Follow Step 1 above, then restart Atlas (Step 2)

### Both bots responding in same channel

**Cause**: Main bot not restarted with new configuration

**Fix**: Restart main bot (Step 4)

### Atlas not responding to messages

**Possible causes**:
1. Message doesn't contain trigger keywords
2. Rate limited (wait 5 seconds between messages)
3. Bot permissions missing in channel

**Fix**: Try mentioning Atlas directly: `@global markets intelligence btc thoughts?`

### Environment variable errors

**Fix**: Update environment variables in Cloud Run:

```bash
gcloud run services update agentflow-atlas \
  --region us-central1 \
  --update-env-vars KEY=VALUE
```

## 🚀 You're Done!

Once you complete these 5 steps:

- ✅ Atlas will respond to market questions in #crypto, #finance, #global-ai
- ✅ Main bot will handle general tasks in all other channels
- ✅ Clean separation - no conflicts!
- ✅ Atlas runs 24/7 on Cloud Run
- ✅ Cost: ~$1.50-9/month for market intelligence

## 📝 Quick Reference

**Atlas Bot**:
- **Client ID**: 1440057375527665674
- **Service**: agentflow-atlas
- **Region**: us-central1
- **Channels**: #crypto, #finance, #global-ai
- **Status**: https://console.cloud.google.com/run?project=agentflow-discord-bot

**Main Bot**:
- **Client ID**: 1439433391710670959
- **Service**: agentflow-discord-bot
- **Channels**: All EXCEPT market channels

**Deployment Commands**:
```bash
# Redeploy Atlas
./deploy/gcp-cloud-run-atlas.sh

# View Atlas logs
gcloud run services logs read agentflow-atlas --region us-central1 --limit 50

# Restart Atlas
gcloud run services update agentflow-atlas --region us-central1
```

---

**Need help?** Check logs first, then review the troubleshooting section above.
