# Global Markets Agent (Atlas) 🌏

A specialized AI agent for global markets, cryptocurrency, and geopolitical analysis.

## Overview

**Atlas** is a distinct agent personality separate from your main finance tracker. He monitors specific Discord channels and provides sharp, globally-focused market insights.

### Key Differences from Main Finance Agent

| Feature | Main Finance Agent | Atlas (Global Markets) |
|---------|-------------------|------------------------|
| **Focus** | US AI Manhattan Project thesis | Global markets, crypto, geopolitics |
| **Personality** | Professional, thesis-driven | Sharp, contrarian, trader-style |
| **Channels** | #finance (automated updates) | #global-ai, #crypto-alerts (interactive) |
| **Mode** | Scheduled posts (9 AM, 4 PM ET) | Real-time responses to keywords/mentions |
| **Data Sources** | Yahoo Finance, Finnhub | Claude AI analysis + real-time data |
| **Avatar** | Default bot | Custom Atlas avatar (configurable) |

## Personality Profile

### Expertise
- **Global Markets**: Asian, European, emerging markets
- **Cryptocurrency**: BTC, ETH, DeFi, stablecoins, regulations
- **Geopolitics**: Policy impacts, international dynamics
- **Macro Analysis**: Central banks, inflation, currencies, commodities
- **Cross-Market Correlations**: Equities, crypto, bonds, FX relationships

### Communication Style
- ✅ **Sharp and Direct**: Cuts through noise with actionable insights
- ✅ **Global Perspective**: Thinks beyond US-centric views
- ✅ **Slightly Contrarian**: Challenges consensus when warranted
- ✅ **Data-Driven**: Backs claims with evidence
- ✅ **Trader Terminology**: Uses market slang appropriately
- ✅ **Historical Context**: References precedents and patterns

### Example Responses

**Bad:**
> "The market went up today"

**Good:**
> "BTC breaking 70k while DXY dumps - classic risk-on rotation. Watch Asia open for confirmation."

**Bad:**
> "Crypto is volatile"

**Good:**
> "ETH/BTC ratio at key resistance. Either alts rip here or we're range-bound for another month. My bet: breakout within 72h."

## Configuration

### Environment Variables

Add to your `.env`:

```bash
# Global Markets Agent (Atlas) - Channels to monitor
# Comma-separated list of channel IDs
GLOBAL_MARKETS_CHANNELS=1339709679537750036,<global-ai-channel-id>
```

### Finding Channel IDs

1. Enable Developer Mode in Discord: `Settings → Advanced → Developer Mode`
2. Right-click the channel (e.g., #global-ai, #crypto-alerts)
3. Click "Copy Channel ID"
4. Add to `GLOBAL_MARKETS_CHANNELS` in `.env`

### Current Configuration

- **#crypto-alerts**: `1339709679537750036` ✅ Configured
- **#global-ai**: Find and add the channel ID

## Usage

### How Atlas Responds

Atlas will automatically respond when:

1. **Mentioned**: `@Atlas what's the BTC outlook?`
2. **Keywords Detected**: Messages containing market-related terms:
   - Crypto: `btc`, `bitcoin`, `eth`, `ethereum`, `crypto`
   - Markets: `market`, `trade`, `price`, `chart`
   - Geo: `china`, `asia`, `europe`, `emerging`
   - Macro: `fed`, `ecb`, `pboc`, `rate`, `inflation`
   - FX/Commodities: `dollar`, `dxy`, `yuan`, `euro`, `oil`, `gold`
3. **Command Prefix**: `atlas <question>` or `!atlas <question>`

### Example Interactions

```
User: "What's happening with BTC?"
Atlas: "BTC consolidating at $68k. Key support at $65k, resistance at $72k.
        Volume declining - either we break out soon or we see a flush to $63k.
        Watch Asia session tonight. 📊"

User: "China news impact?"
Atlas: "PBOC stimulus talk boosting risk assets. If confirmed, expect:
        • Asia equities +2-3%
        • BTC recovery toward $70k
        • DXY weakness

        Caveat: We've seen these rumors before. Wait for official announcement. 🌏"

User: "@Atlas EUR/USD outlook?"
Atlas: "EUR/USD at 1.08 - pivotal level. ECB dovish but Fed also signaling cuts.
        Range-bound 1.06-1.10 likely until clear policy divergence.
        Short-term bias: slight USD weakness as rate cut expectations rise. 💶"
```

### Scheduled Updates (Coming Soon)

Atlas will also post scheduled updates:

- **Asia Open** (9 PM ET): Asian markets preview
- **Europe Open** (3 AM ET): European session overview
- **Crypto Daily** (8 AM ET): 24h crypto summary

## Customization

### Avatar Setup

To give Atlas a distinct appearance:

1. Create/find an avatar image (globe, world map, or Atlas the Titan)
2. Upload to Discord as a webhook or use an external URL
3. Update `AGENT_AVATAR_URL` in `src/agents/globalMarketsAgent.ts:17`

### Personality Tuning

Edit the `PERSONALITY` constant in `src/agents/globalMarketsAgent.ts:23-71` to adjust:
- Tone (more/less contrarian)
- Expertise focus areas
- Communication style
- Example responses

### Adding Tools

Extend Atlas with real-time data:

```typescript
// src/agents/globalMarketsAgent.ts

// Add to class
private cryptoApi: CryptoDataService;
private forexApi: ForexDataService;

// Use in responses
const btcPrice = await this.cryptoApi.getPrice('BTC');
const response = `BTC at $${btcPrice.toLocaleString()}...`;
```

## Architecture

```
┌─────────────────────────────────────────────┐
│   Discord Bot (discordBotRealtime.ts)      │
│                                             │
│   ┌───────────────────────────────────┐   │
│   │  Message Router                    │   │
│   │  - Checks shouldHandle()           │   │
│   │  - Routes to GlobalMarketsAgent    │   │
│   └───────────────────────────────────┘   │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│     GlobalMarketsAgent (Atlas)              │
│                                             │
│   • Monitors registered channels            │
│   • Detects keywords/mentions               │
│   • Generates Claude-powered responses      │
│   • Posts scheduled updates                 │
│   • Maintains separate personality          │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│   Anthropic Claude API                      │
│   - Uses specialized global markets prompt  │
│   - Maintains conversation context          │
│   - Generates sharp, concise insights       │
└─────────────────────────────────────────────┘
```

## Testing

1. **Start the bot**:
   ```bash
   npm start
   ```

2. **Check logs**:
   ```
   🌏 Global Markets Agent (Atlas) initialized for 1 channels
   GlobalMarketsAgent: Registered for channel 1339709679537750036
   ```

3. **Test in Discord**:
   - Go to #crypto-alerts
   - Type: `atlas what's the BTC trend?`
   - Or: `btc breaking 70k thoughts?`

4. **Verify response**:
   - Should see typing indicator
   - Should receive a sharp, concise response
   - Response should match Atlas personality

## Troubleshooting

### Atlas Not Responding

1. **Check channel registration**:
   ```bash
   # Look for this in logs
   GlobalMarketsAgent: Registered for channel <ID>
   ```

2. **Verify keyword detection**:
   - Use explicit mention: `@bot atlas test`
   - Or use command: `!atlas hello`

3. **Check Anthropic API key**:
   ```bash
   # In .env
   ANTHROPIC_API_KEY=sk-ant-...
   ```

### Multiple Responses

If both the main agent and Atlas respond:

- Check `shouldHandle()` logic in `globalMarketsAgent.ts:87`
- Ensure early return in `discordBotRealtime.ts:164-167`

### Wrong Personality

If Atlas sounds like the main agent:

- Verify `PERSONALITY` prompt is loading correctly
- Check Claude API model: should be `claude-sonnet-4-20250514`
- Review recent conversation context for contamination

## Roadmap

### Phase 1 (Current)
- [x] Basic agent framework
- [x] Channel routing
- [x] Keyword detection
- [x] Claude-powered responses
- [x] Distinct personality

### Phase 2 (Next)
- [ ] Custom Discord avatar/webhook
- [ ] Real-time crypto price integration
- [ ] FX/commodities data feeds
- [ ] Scheduled update posts
- [ ] Chart generation

### Phase 3 (Future)
- [ ] News monitoring integration
- [ ] Sentiment analysis
- [ ] Trade signal generation
- [ ] Multi-language support (Chinese, Spanish)
- [ ] Voice mode integration

## Resources

- **Main Codebase**: `src/agents/globalMarketsAgent.ts`
- **Integration**: `src/bot/discordBotRealtime.ts:85-97, 163-167`
- **Configuration**: `.env`, `src/utils/config.ts:61`, `src/types/index.ts:85`

---

**Questions?** Check the code or ask in #agent-chat! 🤖
