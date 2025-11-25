# 🚀 Vercel Monitoring - Quick Start Guide

Get Vercel deployment monitoring up and running in 5 minutes!

## Prerequisites

- AgentFlow bot running
- Vercel account with at least one project
- Discord bot with access to a channel

---

## Step 1: Get Vercel API Token

1. Go to: https://vercel.com/account/tokens
2. Click **Create Token**
3. Name: `AgentFlow Monitor`
4. Copy the token

---

## Step 2: Get Discord Channel ID

1. Enable Developer Mode (Discord Settings → Advanced → Developer Mode)
2. Right-click your alerts channel → **Copy Channel ID**

---

## Step 3: Configure Environment

Add to your `.env` file:

```bash
# Required
VERCEL_API_TOKEN=vercel_api_token_here
VERCEL_ALERT_CHANNEL_ID=your_channel_id_here

# Optional (recommended defaults)
VERCEL_MONITORING_ENABLED=true
VERCEL_CHECK_INTERVAL=*/10 * * * *
```

---

## Step 4: Test the Integration

```bash
npm run vercel:test
```

You should see:
```
✅ Found X projects
✅ All tests passed!
```

---

## Step 5: Start the Bot

```bash
npm run build
npm start
```

Look for this in the logs:
```
✅ Vercel monitoring integration initialized and started
```

---

## ✅ Done!

You'll now receive Discord alerts when deployments fail!

### Manual Commands

```bash
# Check for failures
npm run vercel:check

# Get health summary
npm run vercel:health
```

---

## 🔧 Troubleshooting

**No alerts?** Check:
1. `VERCEL_MONITORING_ENABLED=true` in `.env`
2. Bot has permission to send messages in the channel
3. Run `npm run vercel:test` to verify API connection

**Need help?** See the full documentation: [VERCEL_MONITORING.md](./VERCEL_MONITORING.md)

