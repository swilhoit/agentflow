# 🚀 Vercel Deployment Monitoring

## Overview

The Vercel Deployment Monitor automatically tracks all your Vercel deployments and sends **real-time alerts** to Discord when deployments fail. This helps you catch and respond to deployment issues immediately.

## Features

✅ **Automated Monitoring** - Checks deployments every 10 minutes (configurable)
✅ **Discord Alerts** - Rich embeds with deployment details sent to a dedicated channel
✅ **Multi-Project Support** - Monitors all projects or filter by specific projects
✅ **Detailed Error Info** - Includes commit details, error messages, and dashboard links
✅ **Health Summaries** - Weekly deployment health reports
✅ **Smart Deduplication** - Won't spam the same deployment failure multiple times

---

## 🔧 Setup

### Step 1: Get Your Vercel API Token

1. Go to [Vercel Account Tokens](https://vercel.com/account/tokens)
2. Click **Create Token**
3. Give it a name (e.g., "AgentFlow Monitor")
4. Set expiration (recommended: No Expiration for continuous monitoring)
5. Copy the token

### Step 2: Get Your Team ID (Optional - for Team Accounts)

If you're using a Vercel Team:

1. Go to your [Vercel Team Settings](https://vercel.com/teams)
2. Click on your team
3. Go to **Settings** → **General**
4. Copy your **Team ID**

### Step 3: Configure Discord Channel

1. Create a dedicated channel for Vercel alerts (e.g., `#vercel-alerts`)
2. Enable **Developer Mode** in Discord:
   - User Settings → Advanced → Developer Mode (toggle ON)
3. Right-click the channel → **Copy Channel ID**

### Step 4: Update Environment Variables

Add these to your `.env` file:

```bash
# Required
VERCEL_API_TOKEN=your_vercel_token_here
VERCEL_ALERT_CHANNEL_ID=your_discord_channel_id_here

# Optional - for team accounts
VERCEL_TEAM_ID=team_abc123xyz

# Optional - Configuration
VERCEL_MONITORING_ENABLED=true
VERCEL_CHECK_INTERVAL=*/10 * * * *
VERCEL_ALERT_ON_CANCEL=false
VERCEL_PROJECT_FILTER=
```

### Step 5: Test the Integration

```bash
# Test API connection
npm run vercel:test

# Check for recent failures
npm run vercel:check

# Get health summary
npm run vercel:health
```

### Step 6: Start the Bot

```bash
npm run build
npm start
```

---

## ⚙️ Configuration Options

### Environment Variables

#### `VERCEL_API_TOKEN` (Required)
Your Vercel API token for authentication.

#### `VERCEL_ALERT_CHANNEL_ID` (Required)
Discord channel ID where deployment alerts will be sent.

#### `VERCEL_TEAM_ID` (Optional)
Your Vercel team ID. Required only for team accounts.

#### `VERCEL_MONITORING_ENABLED` (Optional, Default: `true`)
Enable or disable Vercel monitoring.

```bash
# Disable monitoring
VERCEL_MONITORING_ENABLED=false
```

#### `VERCEL_CHECK_INTERVAL` (Optional, Default: `*/10 * * * *`)
Cron expression for how often to check deployments.

```bash
# Check every 5 minutes
VERCEL_CHECK_INTERVAL=*/5 * * * *

# Check every hour
VERCEL_CHECK_INTERVAL=0 * * * *

# Check every 30 minutes
VERCEL_CHECK_INTERVAL=*/30 * * * *
```

**Common Cron Patterns:**
- `*/5 * * * *` - Every 5 minutes
- `*/10 * * * *` - Every 10 minutes (default)
- `*/15 * * * *` - Every 15 minutes
- `*/30 * * * *` - Every 30 minutes
- `0 * * * *` - Every hour

#### `VERCEL_ALERT_ON_CANCEL` (Optional, Default: `false`)
Whether to send alerts for canceled deployments.

```bash
# Alert on both errors and cancellations
VERCEL_ALERT_ON_CANCEL=true
```

#### `VERCEL_PROJECT_FILTER` (Optional)
Comma-separated list of project names to monitor. Leave empty to monitor all projects.

```bash
# Monitor specific projects only
VERCEL_PROJECT_FILTER=my-app,my-dashboard,api-service

# Monitor all projects (default)
VERCEL_PROJECT_FILTER=
```

---

## 📊 Alert Format

When a deployment fails, you'll receive a Discord embed with:

### Basic Information
- **Project Name** - Which project failed
- **Deployment ID** - Unique deployment identifier
- **Status** - ERROR or CANCELED
- **URL** - Deployment preview URL

### Git Information (if available)
- **Commit Hash** - Short SHA
- **Commit Author** - Who made the commit
- **Commit Message** - What changed
- **Branch** - Which branch was deployed

### Deployment Details
- **Environment** - Production, Preview, or Development
- **Duration** - How long the build took before failing
- **Error Details** - Error message from Vercel

### Quick Actions
- **View in Vercel** - Direct link to the deployment in Vercel Dashboard

---

## 🛠️ Manual Commands

### Check for Failed Deployments

```bash
npm run vercel:check
```

Manually trigger a check for failed deployments in the last 24 hours.

### Get Health Summary

```bash
npm run vercel:health
```

Display a health summary of all projects:
- Total projects
- Recent deployments (last 7 days)
- Failed deployments
- Success rate
- Status of each project

### Test API Connection

```bash
npm run vercel:test
```

Test your Vercel API connection and display basic information about your projects.

---

## 📈 Weekly Health Reports

The system automatically sends a weekly deployment health summary every Monday at 9 AM EST. This includes:

- Total number of projects
- Deployment statistics for the past week
- Success rate
- Status of each project
- Failed deployments

---

## 🔍 Troubleshooting

### "VERCEL_API_TOKEN not configured"

**Solution:** Add your Vercel API token to `.env`:

```bash
VERCEL_API_TOKEN=your_token_here
```

### "Could not find Discord channel"

**Problem:** Invalid channel ID or bot doesn't have access.

**Solutions:**
1. Verify channel ID is correct (right-click channel → Copy Channel ID)
2. Make sure the bot has permission to send messages in that channel
3. Ensure Developer Mode is enabled in Discord

### "Failed to fetch Vercel projects"

**Problem:** Token might be invalid or expired.

**Solutions:**
1. Verify token is correct in `.env`
2. Check token hasn't expired (create a new one if needed)
3. Ensure token has read permissions for deployments

### No Alerts Being Sent

**Problem:** Monitoring might be disabled or no failures detected.

**Solutions:**
1. Check `VERCEL_MONITORING_ENABLED=true` in `.env`
2. Verify bot is running (`npm start`)
3. Run `npm run vercel:test` to test connection
4. Check bot logs for any errors

### Getting Duplicate Alerts

**Problem:** Database might have been cleared.

**Solution:** The system tracks alerted deployments in the database. If you reset the database, you might get duplicate alerts for a short period. This will self-correct after 7 days.

---

## 🏗️ Architecture

### Components

1. **VercelMonitor** (`src/services/vercelMonitor.ts`)
   - Core service for interacting with Vercel API
   - Fetches projects, deployments, and logs
   - Tracks last check timestamp to avoid duplicate alerts

2. **VercelAlertService** (`src/services/vercelAlertService.ts`)
   - Manages alert scheduling and Discord notifications
   - Stores alert history in SQLite database
   - Creates rich Discord embeds for failures

3. **VercelIntegration** (`src/services/vercelIntegration.ts`)
   - Connects Vercel monitoring to Agent Manager
   - Registers task executors for manual triggers
   - Handles initialization and shutdown

### Database Schema

```sql
CREATE TABLE vercel_deployment_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deployment_id TEXT UNIQUE NOT NULL,
  project_name TEXT NOT NULL,
  deployment_state TEXT NOT NULL,
  alerted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  error_details TEXT,
  deployment_url TEXT
);
```

### Agent Registration

The Vercel Monitor is registered as a **service agent** in the Agent Manager system:

- **Agent Name:** `vercel-monitor`
- **Type:** `service`
- **Tasks:**
  - `vercel-deployment-check` - Manual deployment check
  - `vercel-health-summary` - Generate health summary
  - `vercel-weekly-health` - Scheduled weekly summary (Mondays at 9 AM)

---

## 🔒 Security Best Practices

1. **Token Permissions**
   - Use a read-only token (no write permissions needed)
   - Set an expiration date if possible
   - Rotate tokens regularly

2. **Environment Variables**
   - Never commit `.env` to version control
   - Use `.env.example` as a template
   - Keep tokens secure and private

3. **Channel Permissions**
   - Restrict alert channel to relevant team members
   - Don't expose sensitive deployment info in public channels

---

## 📝 Example Alert

```
🚨 Deployment Failed: my-awesome-app

📦 Project: my-awesome-app
🔗 Deployment ID: dpl_abc123xyz
⚠️ Status: ERROR
🌐 URL: https://my-awesome-app-abc123.vercel.app

📝 Commit: a1b2c3d by John Doe
Fix critical bug in payment processing

🌿 Branch: main
🎯 Environment: PRODUCTION
⏱️ Duration: 2m 34s

❌ Error Details:
Build failed with exit code 1
Module not found: 'missing-dependency'

🔍 View in Vercel: [Open Dashboard](https://vercel.com/...)
```

---

## 🚨 Common Deployment Failures

### Build Errors
- Missing dependencies
- TypeScript errors
- Linting failures
- Out of memory

### Runtime Errors
- Environment variables not set
- API connection failures
- Database connection issues

### Configuration Errors
- Invalid `vercel.json`
- Framework detection issues
- Build command failures

---

## 📚 Related Documentation

- [Agent Manager](./AGENT_MANAGER.md) - Overview of the agent system
- [Vercel API Documentation](https://vercel.com/docs/rest-api) - Official Vercel API docs
- [Discord Bot Setup](./README.md) - Main bot configuration

---

## 💡 Tips

1. **Set up project filters** if you only care about specific projects
2. **Adjust check intervals** based on your deployment frequency
3. **Create a dedicated channel** for deployment alerts to avoid noise
4. **Use health summaries** to track deployment trends over time
5. **Test the integration** before relying on it for production monitoring

---

## ❓ FAQ

**Q: Does this work with preview deployments?**
A: Yes! It monitors all deployments (production, preview, and development).

**Q: Can I monitor multiple Vercel accounts?**
A: Currently, one token per bot instance. Run multiple bot instances for multiple accounts.

**Q: How much does this cost?**
A: The monitoring itself is free. Vercel API access is free for all plans.

**Q: Will I get alerted for old failures?**
A: No. The system only alerts on new failures detected after the monitoring starts.

**Q: Can I customize the alert format?**
A: Yes! Edit the `sendAlert()` method in `src/services/vercelAlertService.ts`.

**Q: Does this support branch deployments?**
A: Yes! All types of deployments are monitored, including branch previews.

---

## 🎉 Success!

If everything is working, you should see:

```
✅ Vercel monitoring integration initialized and started
🔍 Checking Vercel deployments...
✅ No new deployment failures detected
```

Your deployment monitoring is now active! You'll receive Discord alerts whenever a deployment fails.

