# AI Manhattan Project Market Updates

Automated daily market tracking for the AI Manhattan Project + China/ROW thesis portfolio.

## Overview

This feature automatically posts daily market updates to your Discord server, tracking key tickers across:

- **US Nuclear & Micro Reactors**: OKLO, NNE, SMR
- **Uranium Mining**: UUUU, UEC, CCJ, LEU, LTBR
- **Grid Infrastructure**: PWR, MYRG, ET, WMB, TLN
- **Data Center REITs**: DLR, EQIX
- **Critical Minerals**: FCX, ASPI
- **China & ROW**: 1816.HK, PDN.AX, KAP.L, CGG.TO
- **Thematic ETFs**: SRUUF, U-UN.TO, URA, NLR, URNM

## Configuration

### 1. Environment Variables

Add these to your `.env` file:

```bash
# Market Ticker Updates Configuration
MARKET_UPDATES_ENABLED=true
MARKET_UPDATES_GUILD_ID=your_discord_server_id_here
MARKET_UPDATES_DAILY_CRON=0 9 * * 1-5
MARKET_UPDATES_CLOSE_CRON=5 16 * * 1-5
MARKET_UPDATES_TIMEZONE=America/New_York
```

### 2. Get Your Discord Server ID

1. Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)
2. Right-click your server name → Copy Server ID
3. Paste into `MARKET_UPDATES_GUILD_ID`

### 3. Schedule Configuration

The default schedule is:
- **Daily Update**: 9:00 AM ET, Monday-Friday (market open)
- **Market Close**: 4:05 PM ET, Monday-Friday (5 mins after market close)

To customize, modify the cron expressions:
- Format: `minute hour * * day-of-week`
- Example: `0 9 * * 1-5` = 9:00 AM, Mon-Fri
- Timezone defaults to `America/New_York` (Eastern Time)

## Channel Routing

The bot uses **intelligent channel routing** to find the best channel for market updates:

1. First looks for channels with keywords: `finance`, `financial`, `budget`, `money`
2. Falls back to `agent-chat` or `general` if no finance channel exists
3. You can create a channel called `#finance` or `#financial` for dedicated market updates

## Features

### Daily Morning Update (9:00 AM ET)

Comprehensive market overview with:
- Portfolio summary (gainers/losers breakdown)
- Top 5 gainers and losers
- Category-by-category breakdown with:
  - Individual ticker prices and % changes
  - Category average performance
  - Target allocation percentages
- Thesis recap (educational reminder)

### Market Close Summary (4:05 PM ET)

Quick summary showing:
- Category average % changes
- Compact format for end-of-day review

## Manual Testing

### Test Data Fetching (without posting to Discord)

```bash
ts-node src/scripts/trigger-market-update.ts test
```

This will:
- Fetch sample tickers (OKLO, CCJ, DLR, UEC, FCX)
- Display prices and % changes in terminal
- Verify API connectivity

### Trigger Full Daily Update

```bash
ts-node src/scripts/trigger-market-update.ts daily
```

This will:
- Post the full morning update to your Discord finance channel
- Include all categories and thesis recap

### Trigger Market Close Summary

```bash
ts-node src/scripts/trigger-market-update.ts close
```

This will:
- Post the compact market close summary

## Customizing Tickers

Edit `src/services/tickerMonitor.ts` to customize the portfolio:

```typescript
export const THESIS_PORTFOLIO: TickerCategory[] = [
  {
    name: "🇺🇸 US Nuclear & Micro Reactors",
    description: "Next-gen nuclear & small modular reactors",
    tickers: ["OKLO", "NNE", "SMR"],
    allocation: "15-20%"
  },
  // Add or modify categories here...
];
```

## Architecture

### Services

1. **TickerMonitor** (`src/services/tickerMonitor.ts`)
   - Fetches market data using `yahoo-finance2`
   - Caches ticker data
   - Generates Discord embeds

2. **MarketUpdateScheduler** (`src/services/marketUpdateScheduler.ts`)
   - Manages cron schedules
   - Posts updates to Discord
   - Handles weekday-only execution

3. **IntelligentChannelNotifier** (`src/services/intelligentChannelNotifier.ts`)
   - Routes messages to appropriate channels
   - Semantic matching for finance-related channels

### Integration

The scheduler integrates with the main bot in `src/index.ts`:
- Starts automatically when `MARKET_UPDATES_ENABLED=true`
- Uses the bot's Discord client
- Gracefully shuts down with the bot

## Troubleshooting

### "No data available for [ticker]"

Some tickers may not be available on Yahoo Finance or may have different symbols:
- Chinese stocks: Use `.HK` suffix (e.g., `1816.HK`)
- Australian stocks: Use `.AX` suffix (e.g., `PDN.AX`)
- Canadian stocks: Use `.TO` suffix (e.g., `CGG.TO`)
- London stocks: Use `.L` suffix (e.g., `KAP.L`)

### Updates not posting

1. Check `MARKET_UPDATES_ENABLED=true` in `.env`
2. Verify `MARKET_UPDATES_GUILD_ID` is correct
3. Ensure bot has permissions in the target channel
4. Check logs for errors

### Weekend updates

The scheduler automatically skips weekends (markets closed). No updates will post on Saturday/Sunday.

## Thesis Background

This portfolio tracks the **AI Manhattan Project** thesis:

**Core Bet**: AI energy demand drives a nuclear renaissance, creating asymmetric upside in:
1. Next-gen nuclear (US policy leverage)
2. Uranium supply chain (global shortage)
3. Grid/power infrastructure (bottleneck)
4. Data center REITs (AI infrastructure)
5. Critical minerals (supply chain security)
6. China/ROW exposure (global competition & buildout)

**Risk Management**: Diversified across US, China, ROW, with ETF/trust exposure to smooth volatility.

**Time Horizon**: 3-5 years (policy catalysts, nuclear buildout cycles)

**Allocation Strategy**: Weighted toward US policy plays with meaningful ROW exposure to hedge single-country risk.

---

For questions or issues, check the main AgentFlow README or create a GitHub issue.
