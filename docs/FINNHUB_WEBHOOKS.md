# Finnhub Webhooks for Real-Time News Monitoring

This guide explains how to set up Finnhub webhooks for real-time news notifications in your AI Manhattan Project.

## Overview

**What are webhooks?**
- Instead of polling for news every hour, Finnhub pushes news to your server instantly
- Lower latency (seconds vs up to 1 hour)
- More efficient (only pays for actual news, not empty polls)
- Real-time Discord notifications to #global-ai

**What you've completed:**
- ✅ Historical news fetching (671 articles from last 30 days)
- ✅ Webhook endpoint created at `/webhooks/finnhub/news`
- ✅ Signature validation for security
- ✅ Automatic Discord posting for significant news
- ✅ Database storage for all incoming news

## Prerequisites

1. **Finnhub API Key**: `d4dee6pr01qovljpe0qgd4dee6pr01qovljpe0r0` (already configured)
2. **Webhook Secret**: `d4dee6pr01qovljpe0s0` (already configured)
3. **Publicly accessible URL** for Finnhub to send webhooks to

## Getting Your Webhook URL

### Option 1: Production (Google Cloud Run) - RECOMMENDED

Your bot is deployed on Google Cloud Run. To get the URL:

```bash
# Get your Cloud Run service URL
gcloud run services describe agentflow-discord-bot --region us-central1 --format='value(status.url)'
```

Your webhook URL will be:
```
https://agentflow-discord-bot-[hash].a.run.app/webhooks/finnhub/news
```

### Option 2: Development (ngrok)

For local testing before deploying:

```bash
# Install ngrok
brew install ngrok

# Expose your local server
ngrok http 3001

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Your webhook URL: https://abc123.ngrok.io/webhooks/finnhub/news
```

**Note**: ngrok URLs change on each restart. For production, use Cloud Run.

## Registering Webhooks

Once you have your webhook URL, run:

```bash
npx ts-node src/scripts/register-finnhub-webhooks.ts
```

This will:
1. Show currently registered webhooks
2. Prompt you for your webhook URL
3. Register all 26 tickers (OKLO, SMR, CCJ, etc.)
4. Show registration summary

**Example output:**
```
📊 Registering webhooks for 26 tickers...

✅ Registered webhook for OKLO
✅ Registered webhook for NNE
✅ Registered webhook for SMR
...

📊 WEBHOOK REGISTRATION SUMMARY
================================================================================
Total Tickers: 26
Successfully Registered: 26
Failed: 0
Webhook URL: https://agentflow-discord-bot-xyz.a.run.app/webhooks/finnhub/news
Webhook Secret: d4dee6pr01qovljpe0s0
================================================================================
```

## Testing the Webhook

### Manual Test with curl

```bash
# Send a test webhook event
curl -X POST https://your-cloud-run-url.run.app/webhooks/finnhub/news \
  -H "Content-Type: application/json" \
  -H "X-Finnhub-Signature: test" \
  -d '{
    "data": [{
      "category": "company news",
      "datetime": 1699900000,
      "headline": "Test: OKLO announces nuclear breakthrough",
      "id": 123456789,
      "related": "OKLO",
      "source": "PR Newswire",
      "summary": "This is a test webhook event",
      "url": "https://example.com/test"
    }],
    "event": "news"
  }'
```

**Note**: This won't pass signature validation, but you'll see it in logs.

### Watch Logs

```bash
# Local logs
npm start

# Cloud Run logs
gcloud run logs read agentflow-discord-bot --region us-central1 --limit 50
```

Look for:
```
🔔 Received 1 news items from Finnhub webhook
💾 Saved news for OKLO: Test: OKLO announces nuclear breakthrough
📤 Posted significant news to #global-ai: OKLO
✅ Webhook event processed successfully
```

## How It Works

### 1. Finnhub sends news event

When news breaks for any tracked ticker, Finnhub sends:

```json
{
  "data": [
    {
      "category": "company news",
      "datetime": 1699900000,
      "headline": "OKLO announces partnership with Google",
      "id": 123456789,
      "related": "OKLO",
      "source": "Reuters",
      "summary": "Oklo Inc. signed a deal with Google...",
      "url": "https://reuters.com/article/..."
    }
  ],
  "event": "news"
}
```

### 2. Webhook endpoint validates signature

```typescript
const signature = req.headers['x-finnhub-signature'];
const isValid = webhookService.validateSignature(payload, signature);
```

Using HMAC SHA256 with your webhook secret.

### 3. News is saved to database

```typescript
await db.saveMarketNews({
  articleId: article.id,
  symbol: article.related,
  headline: article.headline,
  summary: article.summary,
  source: article.source,
  url: article.url,
  publishedAt: new Date(article.datetime * 1000),
  category: article.category,
  isSignificant: true/false
});
```

### 4. Significant news posted to Discord

If the news is "significant" (based on keywords, source, headline analysis), it's automatically posted to #global-ai:

```
📰 OKLO | OKLO announces partnership with Google
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Oklo Inc. signed a deal with Google to provide clean energy...

Source: Reuters
Time: Nov 17, 2025, 3:45 PM
URL: https://reuters.com/article/...
```

## Significance Detection

News is marked as "significant" if it contains:
- **Deal keywords**: "partnership", "deal", "contract", "agreement"
- **Financial keywords**: "earnings", "revenue", "profit", "loss", "beats", "misses"
- **Action keywords**: "announces", "launches", "signs", "acquires"
- **Nuclear keywords**: "reactor", "uranium", "nuclear", "enrichment"
- **Trusted sources**: Reuters, Bloomberg, WSJ, CNBC, PR Newswire

## Managing Webhooks

### List all registered webhooks

```bash
# The register script shows current webhooks automatically
npx ts-node src/scripts/register-finnhub-webhooks.ts
```

### Delete all webhooks

Edit `register-finnhub-webhooks.ts` and uncomment:
```typescript
// await deleteAllWebhooks(apiKey);
```

Or use Finnhub API directly:
```bash
curl -X POST "https://finnhub.io/api/v1/webhook/delete?token=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id": "webhook_id_here"}'
```

## Troubleshooting

### Webhook not receiving events

1. **Check webhook URL is accessible**:
   ```bash
   curl https://your-url.run.app/health
   ```

2. **Verify webhook is registered**:
   ```bash
   curl "https://finnhub.io/api/v1/webhook/list?token=YOUR_API_KEY"
   ```

3. **Check Cloud Run logs**:
   ```bash
   gcloud run logs read agentflow-discord-bot --region us-central1 --limit 100
   ```

### Signature validation failing

- Ensure `FINNHUB_WEBHOOK_SECRET` matches what you registered with
- Check for whitespace in secret (should be: `d4dee6pr01qovljpe0s0`)

### No news appearing in Discord

- Check if news is "significant" (logs will show: `isSignificant: true`)
- Verify #global-ai channel exists
- Check bot has permissions to post in channel

## Environment Variables

Required in `.env`:

```bash
# Finnhub API (for market news and data)
FINNHUB_API_KEY=d4dee6pr01qovljpe0qgd4dee6pr01qovljpe0r0
FINNHUB_WEBHOOK_SECRET=d4dee6pr01qovljpe0s0
```

## Deployment

When deploying to Cloud Run, webhooks will automatically work if:

1. ✅ Environment variables are set in Cloud Run
2. ✅ Service is publicly accessible (not requiring authentication)
3. ✅ Webhook URL points to your Cloud Run service

Update deployment:
```bash
gcloud run deploy agentflow-discord-bot \
  --region us-central1 \
  --update-env-vars FINNHUB_API_KEY=d4dee6pr01qovljpe0qgd4dee6pr01qovljpe0r0 \
  --update-env-vars FINNHUB_WEBHOOK_SECRET=d4dee6pr01qovljpe0s0
```

## Free Tier Limits

Finnhub free tier includes:
- ✅ 60 API calls per minute
- ✅ Unlimited webhook events
- ✅ Company news for US stocks
- ⚠️  Limited news for international stocks

For 26 tickers with webhooks, you're well within free tier limits!

## Summary

**What you have now:**
- 671 historical news articles (30 days)
- Real-time webhook endpoint with signature validation
- Automatic Discord notifications for significant news
- Database storage for all incoming news
- Ready to register webhooks for all 26 tickers

**Next steps:**
1. Get your Cloud Run webhook URL
2. Run `register-finnhub-webhooks.ts`
3. Monitor #global-ai for real-time news! 🎉
