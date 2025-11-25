# Vercel Environment Variables

Add these to your `.env` file to enable Vercel deployment monitoring:

## Recommended: Unified Deployments Channel

Track **both Vercel and GitHub** deployments in one channel:

```bash
# ========================================
# UNIFIED DEPLOYMENT TRACKING (Recommended)
# ========================================

# Discord channel for ALL deployment notifications
DEPLOYMENTS_CHANNEL_ID=your_channel_id_here

# Vercel API Token
# Get from: https://vercel.com/account/tokens
VERCEL_API_TOKEN=your_vercel_api_token_here

# GitHub Token (for GitHub Actions tracking)
# Needs: repo, workflow permissions
GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Check interval (default: every 5 minutes)
DEPLOYMENT_CHECK_INTERVAL=*/5 * * * *
```

See [docs/DEPLOYMENTS_CHANNEL.md](./docs/DEPLOYMENTS_CHANNEL.md) for full configuration.

---

## Legacy: Vercel-Only Alerts

For Vercel-only monitoring (without GitHub):

```bash
# ========================================
# VERCEL DEPLOYMENT MONITORING (Legacy)
# ========================================

# Vercel API Token (Required for monitoring)
# Get from: https://vercel.com/account/tokens
VERCEL_API_TOKEN=your_vercel_api_token_here

# Discord Channel for Deployment Alerts (Required)
# Right-click channel → Copy Channel ID (Developer Mode must be enabled)
VERCEL_ALERT_CHANNEL_ID=your_alert_channel_id_here

# Team ID (Optional - for team accounts)
# Get from: Vercel Team Settings → General → Team ID
VERCEL_TEAM_ID=

# Monitoring Configuration (Optional - these are the defaults)
VERCEL_MONITORING_ENABLED=true
VERCEL_CHECK_INTERVAL=*/10 * * * *
VERCEL_ALERT_ON_CANCEL=false

# Project Filter (Optional - comma-separated list)
# Leave empty to monitor all projects
# Example: VERCEL_PROJECT_FILTER=my-app,my-dashboard,api-service
VERCEL_PROJECT_FILTER=
```

## Quick Setup

1. **Get your Vercel API token**: https://vercel.com/account/tokens
2. **Get your Discord channel ID**: Right-click channel → Copy Channel ID
3. **Add both to your `.env` file**
4. **Restart the bot**: `npm run build && npm start`

## Test the Integration

```bash
# Test API connection
npm run vercel:test

# Check for recent failures
npm run vercel:check

# Get health summary
npm run vercel:health
```

## Full Documentation

- **Unified Tracking (Vercel + GitHub)**: [docs/DEPLOYMENTS_CHANNEL.md](./docs/DEPLOYMENTS_CHANNEL.md)
- **Vercel-Only Monitoring**: [docs/VERCEL_MONITORING.md](./docs/VERCEL_MONITORING.md)

