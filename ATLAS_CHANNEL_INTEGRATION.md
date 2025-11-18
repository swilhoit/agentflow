# Atlas Bot - Channel Integration Plan 🌏

## Discovered Channels

Your server has **5 market-related channels**:

| Channel | ID | Purpose |
|---------|-------|---------|
| **#crypto** | `1339709679537750036` | Cryptocurrency discussion & alerts |
| **#finance** | `1439869363502055474` | Finance tracker, portfolio updates |
| **#global-ai** | `1439887464524283924` | Global markets, macro, geopolitics |
| #daily-markets | `1440060956943188059` | Daily market summaries (optional) |
| #trading | `1146156495101231125` | Trading discussion (optional) |

## Recommended Configuration

### Primary 3 Channels (Currently Configured)

✅ **Configuration in `.env`:**
```bash
GLOBAL_MARKETS_CHANNELS=1339709679537750036,1439869363502055474,1439887464524283924
```

This covers:
- **#crypto**: Crypto-focused conversations (BTC, ETH, DeFi, etc.)
- **#finance**: Portfolio tracking, thesis analysis, ticker deep dives
- **#global-ai**: Global markets, geopolitics, macro analysis

### Channel-Specific Behavior

#### #crypto (1339709679537750036)
**Focus**: Cryptocurrency markets
- Responds to: BTC, ETH, SOL, DeFi, stablecoins, on-chain metrics
- Tools emphasized: `crypto_price`, `market_sentiment`, `ticker_deep_dive` (crypto assets)
- Personality: Sharp, fast-paced, crypto-native terminology

#### #finance (1439869363502055474)
**Focus**: AI Manhattan Project portfolio & equities
- Responds to: portfolio questions, ticker analysis, sector trends
- Tools emphasized: `portfolio_snapshot`, `ticker_deep_dive`, `sector_analysis`
- Personality: Analytical, thesis-focused, long-term oriented

#### #global-ai (1439887464524283924)
**Focus**: Global markets & geopolitics
- Responds to: Asia/Europe markets, central banks, geopolitics, macro
- Tools emphasized: `geopolitical_analysis`, `market_intelligence`, `forex_rate`
- Personality: Global perspective, macro-focused, contrarian

## Adding Atlas to Your Server

### Step 1: Generate Invite Link

Use this URL (replace permissions if needed):
```
https://discord.com/api/oauth2/authorize?client_id=1440057375527665674&permissions=412317240384&scope=bot
```

**Permissions included:**
- Read Messages/View Channels
- Send Messages
- Send Messages in Threads
- Embed Links
- Attach Files
- Read Message History
- Use External Emojis
- Add Reactions

### Step 2: Invite to Server

1. Open the invite link above
2. Select "INTELLIGENCE UNLEASHED" server
3. Authorize the bot
4. Place Atlas role above @everyone for visibility

### Step 3: Test Connection

Once invited, test Atlas with:
```
# In #crypto channel:
btc price?
show me the AI Manhattan portfolio

# In #finance channel:
deep dive on CCJ
portfolio snapshot

# In #global-ai channel:
china economic outlook
fed decision impact on markets
```

## Optional: Add Additional Channels

To add **#daily-markets** or **#trading**:

1. Update `.env`:
```bash
GLOBAL_MARKETS_CHANNELS=1339709679537750036,1439869363502055474,1439887464524283924,1440060956943188059,1146156495101231125
```

2. Restart Atlas:
```bash
npm run atlas:dev
```

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Discord Server                           │
│          "INTELLIGENCE UNLEASHED" (1091835283210780735)     │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
    ┌───────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
    │   #crypto    │ │  #finance  │ │ #global-ai │
    │  (1339...)   │ │ (1439...)  │ │ (1439...)  │
    └───────┬──────┘ └─────┬──────┘ └─────┬──────┘
            │               │               │
            └───────────────┼───────────────┘
                            │
                    ┌───────▼────────┐
                    │   Atlas Bot    │
                    │ (Anthropic AI) │
                    └───────┬────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼──────┐   ┌────────▼────────┐   ┌─────▼──────┐
│ Perplexity   │   │ Yahoo Finance   │   │  Finnhub   │
│ (Real-time   │   │ (Ticker Data)   │   │   (News)   │
│  Web Search) │   │                 │   │            │
└──────────────┘   └─────────────────┘   └────────────┘
```

## Bot Responsibilities

### Atlas (Market Intelligence Bot) - Handles:
- ✅ Real-time crypto/FX prices
- ✅ Portfolio snapshot & ticker analysis
- ✅ Sector analysis (uranium, AI chips, DeFi)
- ✅ Geopolitical event analysis
- ✅ Breaking market news (via Perplexity)
- ✅ Earnings analysis
- ✅ Market sentiment tracking
- ✅ On-demand market intelligence

### Main Bot (General Assistant) - Handles:
- ✅ General coding/engineering tasks
- ✅ Autonomous agent orchestration
- ✅ Voice conversations (Realtime API)
- ✅ Non-market discussions
- ❌ NO market-related posts (all moved to Atlas)

## Starting Atlas

### Development Mode
```bash
npm run atlas:dev
```

### Production Mode
```bash
npm run atlas:build
npm run atlas
```

### With Main Bot
```bash
# Terminal 1: Main bot
npm start

# Terminal 2: Atlas
npm run atlas:dev
```

## Monitoring & Logs

Atlas logs all activity:
```typescript
✅ Atlas bot logged in as global markets intelligence#5310
📡 Monitoring 3 channels
🌏 Atlas responded in channel 1339709679537750036
```

Check logs for:
- Tool usage (which tools are being called)
- Response times
- Perplexity API calls (manage costs)
- Rate limiting (5s between responses per user)

## Cost Estimate

**Daily Usage (moderate activity)**:
- Perplexity calls: ~20-40 queries = $0.04-0.20/day
- All other APIs: Free (Yahoo Finance, Finnhub free tier)

**Monthly**: ~$1.50-9/month for comprehensive market intelligence

## Testing Checklist

Once Atlas is invited, test these scenarios:

### Basic Tools
- [ ] `btc price?` → crypto_price
- [ ] `eur/usd rate?` → forex_rate
- [ ] `market sentiment?` → market_sentiment

### Perplexity Intelligence
- [ ] `latest bitcoin news` → news_search
- [ ] `china economic outlook` → market_intelligence
- [ ] `fed decision impact` → geopolitical_analysis
- [ ] `uranium sector analysis` → sector_analysis
- [ ] `nvidia earnings` → earnings_analysis
- [ ] `breaking market news` → breaking_market_news

### AI Manhattan Portfolio
- [ ] `show me the portfolio` → portfolio_snapshot
- [ ] `deep dive on CCJ` → ticker_deep_dive
- [ ] `analyze OKLO` → ticker_deep_dive

### Complex Queries
- [ ] `should I buy uranium stocks?` → Multiple tools
- [ ] `compare BTC and ETH` → Multiple tools
- [ ] `how is geopolitics affecting markets?` → Multiple tools

## Troubleshooting

### Atlas not responding?
1. Check bot is online in Discord server
2. Verify channel IDs in `.env` are correct
3. Ensure message contains trigger keywords or @Atlas mention
4. Check rate limiting (5s between responses)

### Missing permissions?
1. Ensure bot has "Read Messages" and "Send Messages" in channels
2. Check role hierarchy (Atlas role should be above @everyone)
3. Verify MESSAGE_CONTENT_INTENT is enabled in Discord Developer Portal

### Perplexity errors?
1. Verify `PERPLEXITY_API_KEY` in `.env`
2. Check API quota/limits
3. Results are cached for 5 minutes - clear cache if stale

## Next Steps

1. **Immediate**: Invite Atlas to server using link above
2. **Test**: Run through testing checklist
3. **Optional**: Add scheduled market updates (9 AM, 4 PM posts)
4. **Optional**: Integrate weekly thesis analyzer for Sunday posts

---

**Atlas is ready to be your complete market intelligence solution!** 🌏🪙📊
