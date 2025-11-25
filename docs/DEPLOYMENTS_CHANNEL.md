# Deployments Channel Setup

Track **Vercel** and **GitHub Actions** deployments in a unified Discord channel.

## Quick Setup

### 1. Create a Discord Channel

Create a channel named `#deployments` (or any name you prefer) in your Discord server.

### 2. Get the Channel ID

1. Enable Developer Mode in Discord: **User Settings → Advanced → Developer Mode**
2. Right-click the channel → **Copy Channel ID**

### 3. Add to `.env`

```bash
# ========================================
# DEPLOYMENTS CHANNEL CONFIGURATION
# ========================================

# Discord channel for all deployment notifications
DEPLOYMENTS_CHANNEL_ID=your_channel_id_here

# Master toggle (default: true)
DEPLOYMENT_TRACKING_ENABLED=true

# Check interval (cron format, default: every 5 minutes)
DEPLOYMENT_CHECK_INTERVAL=*/5 * * * *
```

## Vercel Integration

Track deployments from your Vercel projects:

```bash
# Enable Vercel tracking (default: true if VERCEL_API_TOKEN is set)
VERCEL_TRACKING_ENABLED=true

# Vercel API Token (required)
# Get from: https://vercel.com/account/tokens
VERCEL_API_TOKEN=your_vercel_token

# Team ID (optional - for team accounts)
VERCEL_TEAM_ID=

# Only track specific projects (optional, comma-separated)
VERCEL_PROJECT_FILTER=my-app,my-dashboard

# Alert on cancelled deployments (default: false)
VERCEL_ALERT_ON_CANCEL=false
```

### What Vercel Events Are Tracked

| Event | Notification |
|-------|--------------|
| ✅ Production Deploy Success | Green embed with URL, commit info |
| ❌ Deployment Failed | Red embed with error details |
| ⏸️ Deployment Cancelled | Yellow embed (if `VERCEL_ALERT_ON_CANCEL=true`) |

## GitHub Integration

Track GitHub Actions workflow runs:

```bash
# Enable GitHub tracking (default: true if GITHUB_TOKEN is set)
GITHUB_TRACKING_ENABLED=true

# GitHub Personal Access Token (required)
# Needs: repo, workflow permissions
# Create at: https://github.com/settings/tokens
GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Or use GH_TOKEN from gh CLI
GH_TOKEN=

# Specific repos to monitor (optional, comma-separated)
# Format: owner/repo
# If not set, monitors your 10 most recently pushed repos
GITHUB_REPOS=swilhoit/agentflow,swilhoit/my-other-app

# Only track specific workflows (optional, comma-separated)
GITHUB_WORKFLOW_FILTER=Deploy,Build,CI
```

### What GitHub Events Are Tracked

| Event | Notification |
|-------|--------------|
| ✅ Workflow Success | Green embed with run details |
| ❌ Workflow Failed | Red embed with failure info |
| ⏹️ Workflow Cancelled | Yellow embed |
| ⏱️ Workflow Timed Out | Red embed |

## Example Notifications

### Vercel Success
```
✅ Vercel Deploy: my-app
──────────────────────
🌐 URL: https://my-app-abc123.vercel.app
🎯 Environment: PRODUCTION
📝 Commit: abc1234 Fix authentication bug
🌿 Branch: main
👤 Author: swilhoit
```

### GitHub Success
```
✅ GitHub: agentflow/Deploy
──────────────────────
🔢 Run: #42
🌿 Branch: main
📋 Event: push
📝 Commit: def5678 Add new feature
👤 Author: swilhoit
🔍 View: [Open GitHub Actions](url)
```

### Deployment Failure
```
❌ Vercel Deploy Failed: my-app
──────────────────────
⚠️ Status: ERROR
🎯 Environment: PRODUCTION
📝 Commit: bad1234 Breaking change
❌ Error: Build failed - TypeScript errors
🔍 View Details: [Open Vercel Dashboard](url)
```

## Full Configuration Example

```bash
# ========================================
# DEPLOYMENTS CHANNEL - COMPLETE SETUP
# ========================================

# Discord channel
DEPLOYMENTS_CHANNEL_ID=1234567890123456789
DEPLOYMENT_TRACKING_ENABLED=true
DEPLOYMENT_CHECK_INTERVAL=*/5 * * * *

# Vercel
VERCEL_TRACKING_ENABLED=true
VERCEL_API_TOKEN=vrc_xxxxxxxxxxxx
VERCEL_TEAM_ID=team_xxxxxxxxxxxx
VERCEL_PROJECT_FILTER=my-app,api-service
VERCEL_ALERT_ON_CANCEL=false

# GitHub
GITHUB_TRACKING_ENABLED=true
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
GITHUB_REPOS=swilhoit/agentflow,swilhoit/waterwise
GITHUB_WORKFLOW_FILTER=Deploy,Build
```

## Discord Commands

The following commands are available (if using the bot):

```bash
# Manually trigger a deployment check
!deployment-check

# Get deployment health summary
!deployment-health
```

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    DeploymentTracker                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │   Vercel API    │         │   GitHub API    │           │
│  │  /v6/deployments│         │ /actions/runs   │           │
│  └────────┬────────┘         └────────┬────────┘           │
│           │                           │                     │
│           └───────────┬───────────────┘                     │
│                       │                                     │
│                       ▼                                     │
│            ┌──────────────────┐                            │
│            │ Check every 5min │                            │
│            │  (configurable)  │                            │
│            └────────┬─────────┘                            │
│                     │                                       │
│                     ▼                                       │
│            ┌──────────────────┐                            │
│            │ Filter & Dedupe  │                            │
│            │ (avoid spam)     │                            │
│            └────────┬─────────┘                            │
│                     │                                       │
│                     ▼                                       │
│            ┌──────────────────┐                            │
│            │ #deployments     │                            │
│            │  Discord Channel │                            │
│            └──────────────────┘                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Migration from Legacy Setup

If you were using the old `VERCEL_ALERT_CHANNEL_ID`:

1. **Old way** (still works):
   ```bash
   VERCEL_ALERT_CHANNEL_ID=123456789
   ```

2. **New way** (recommended - includes GitHub):
   ```bash
   DEPLOYMENTS_CHANNEL_ID=123456789
   ```

Both can coexist. The legacy Vercel alerts will post to `VERCEL_ALERT_CHANNEL_ID`, while the new unified tracker posts to `DEPLOYMENTS_CHANNEL_ID`.

## Troubleshooting

### Vercel deployments not showing

1. Check your API token is valid:
   ```bash
   npm run vercel:test
   ```

2. Ensure the token has access to your projects

3. Check if project filter is excluding your projects

### GitHub workflows not showing

1. Verify token permissions (needs `repo` and `workflow`)

2. Check if repos are specified correctly (format: `owner/repo`)

3. Ensure workflows have completed (in-progress runs are not shown)

### No notifications at all

1. Verify `DEPLOYMENTS_CHANNEL_ID` is correct

2. Check bot has permission to send messages to the channel

3. Look at bot logs for errors:
   ```bash
   tail -f bot.log | grep -i deployment
   ```

## API Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DEPLOYMENTS_CHANNEL_ID` | Yes | - | Discord channel ID for notifications |
| `DEPLOYMENT_TRACKING_ENABLED` | No | `true` | Master toggle |
| `DEPLOYMENT_CHECK_INTERVAL` | No | `*/5 * * * *` | Cron schedule |
| `VERCEL_TRACKING_ENABLED` | No | `true` | Enable Vercel tracking |
| `VERCEL_API_TOKEN` | For Vercel | - | Vercel API token |
| `VERCEL_TEAM_ID` | No | - | Vercel team ID |
| `VERCEL_PROJECT_FILTER` | No | - | Comma-separated project names |
| `VERCEL_ALERT_ON_CANCEL` | No | `false` | Alert on cancelled deployments |
| `GITHUB_TRACKING_ENABLED` | No | `true` | Enable GitHub tracking |
| `GITHUB_TOKEN` | For GitHub | - | GitHub personal access token |
| `GITHUB_REPOS` | No | Auto | Comma-separated `owner/repo` |
| `GITHUB_WORKFLOW_FILTER` | No | - | Comma-separated workflow names |

