# Portfolio Categories

## Overview

The investments dashboard now supports curated portfolio categories, allowing you to organize and filter your watchlist by investment themes.

## Available Portfolios

### 1. **Main Market Indices** (10 symbols)
Broad market indices and macro assets for tracking overall market health.

**Symbols:**
- **SPY** - SPDR S&P 500 ETF Trust
- **QQQ** - Invesco QQQ Trust (Nasdaq 100)
- **DIA** - SPDR Dow Jones Industrial Average ETF
- **IWM** - iShares Russell 2000 ETF
- **GLD** - SPDR Gold Shares
- **BTC-USD** - Bitcoin USD
- **ETH-USD** - Ethereum USD
- **DXY** - U.S. Dollar Index
- **TLT** - iShares 20+ Year Treasury Bond ETF
- **VIX** - CBOE Volatility Index

### 2. **AI Infrastructure** (19 symbols)
AI infrastructure, data centers, and enabling technologies.

**Symbols:**
- **NVDA** - NVIDIA Corporation (AI chips)
- **AMD** - Advanced Micro Devices (AI chips)
- **MSFT** - Microsoft Corporation (Azure AI)
- **GOOGL** - Alphabet Inc. (AI/Cloud)
- **META** - Meta Platforms (AI research)
- **AMZN** - Amazon.com (AWS AI)
- **ORCL** - Oracle Corporation (Cloud/AI)
- **PLTR** - Palantir Technologies (AI software)
- **SNOW** - Snowflake Inc. (Data cloud)
- **DDOG** - Datadog, Inc. (Monitoring)
- **NET** - Cloudflare, Inc. (Edge computing)
- **EQIX** - Equinix, Inc. (Data centers)
- **DLR** - Digital Realty Trust (Data centers)
- **PWR** - Quanta Services (Infrastructure)
- **SMCI** - Super Micro Computer (AI servers)
- **ARM** - ARM Holdings plc (Chip design)
- **AVGO** - Broadcom Inc. (Networking/chips)
- **MU** - Micron Technology (Memory chips)
- **TSM** - Taiwan Semiconductor (Chip manufacturing)

### 3. **Uranium & Nuclear Energy** (26 symbols)
Uranium mining, nuclear power, and SMR (Small Modular Reactor) companies.

**Key Symbols:**
- **URA** - Global X Uranium ETF
- **URNM** - North Shore Uranium ETF
- **CCJ** - Cameco Corporation
- **UUUU** - Energy Fuels Inc.
- **SMR** - NuScale Power (SMR)
- **OKLO** - Oklo Inc. (SMR)
- And 20 more uranium/nuclear symbols

## Using Portfolio Categories

### Dashboard Interface

Navigate to **http://localhost:3010/investments** to see the portfolio tabs:

```
┌─────────────────────────────────────────────────────┐
│ ALL (53)  │  MAIN MARKET INDICES (10)  │  AI INFRASTRUCTURE (19)  │  URANIUM & NUCLEAR ENERGY (26)  │
└─────────────────────────────────────────────────────┘
```

Click any tab to filter the watchlist to that specific portfolio category.

### API Endpoint

The investments API now supports category filtering:

```bash
# Get all symbols
GET /api/investments

# Get specific portfolio
GET /api/investments?category=main-indices
GET /api/investments?category=ai-infrastructure
GET /api/investments?category=uranium-energy
```

**Response includes:**
```json
{
  "watchlist": [...],
  "category": "ai-infrastructure",
  "portfolios": [
    {
      "id": "main-indices",
      "name": "Main Market Indices",
      "description": "Broad market indices and macro assets",
      "symbolCount": 10
    },
    ...
  ]
}
```

## Adding New Symbols

### 1. Update Portfolio Definition

Edit `/dashboard/lib/portfolio-categories.ts`:

```typescript
export const MY_PORTFOLIO: Portfolio = {
  id: 'my-portfolio',
  name: 'My Custom Portfolio',
  description: 'Description here',
  symbols: ['AAPL', 'GOOGL', 'MSFT', ...]
};

// Add to PORTFOLIOS array
export const PORTFOLIOS: Portfolio[] = [
  MAIN_INDICES,
  AI_INFRASTRUCTURE,
  URANIUM_ENERGY,
  MY_PORTFOLIO, // <-- Add here
];
```

### 2. Add Symbol Name Mappings

Edit `/scripts/add-portfolio-symbols.ts`:

```typescript
const SYMBOL_NAMES: Record<string, string> = {
  'AAPL': 'Apple Inc.',
  'GOOGL': 'Alphabet Inc.',
  // ... add your symbols
};
```

### 3. Run the Addition Script

```bash
npm run build
npx ts-node scripts/add-portfolio-symbols.ts
```

This will add placeholder data to the database. The Market Update Scheduler will fetch real prices during its next run.

### 4. Fetch Real Market Data

Update market data for the new symbols:

```bash
# Manual run
npx ts-node src/schedulers/marketUpdateScheduler.ts

# Or wait for scheduled run (weekdays 9 AM ET)
```

## File Structure

```
dashboard/
├── lib/
│   └── portfolio-categories.ts      # Portfolio definitions
├── app/
│   ├── investments/
│   │   └── page.tsx                 # UI with portfolio tabs
│   └── api/
│       └── investments/
│           └── route.ts             # API with category filtering
scripts/
└── add-portfolio-symbols.ts         # Script to populate database
```

## Portfolio Statistics

Each portfolio shows:
- **Total symbols** tracked
- **30-day performance** (average across all symbols)
- **Winners/Losers** count
- **Top gainer** and **Top loser** in the portfolio

Stats are calculated dynamically based on the filtered watchlist.

## Market Data Updates

The Market Update Scheduler automatically fetches fresh market data for all symbols:

- **Daily Market Update**: Weekdays 9:00 AM ET
- **Market Close Summary**: Weekdays 4:05 PM ET
- **Hourly News Check**: Every hour 9-4 PM ET weekdays

New symbols will be included in these automatic updates once added to the database.

## Troubleshooting

### Symbols showing $0.00 prices

This means placeholder data hasn't been updated yet. Run:

```bash
npx ts-node src/schedulers/marketUpdateScheduler.ts
```

### Portfolio not showing in tabs

1. Verify it's added to `PORTFOLIOS` array in `portfolio-categories.ts`
2. Restart the Next.js dev server
3. Check browser console for errors

### Category filter not working

1. Check API response includes `portfolios` array
2. Verify `selectedCategory` state is updating
3. Check network tab for correct API calls

## Future Enhancements

- [ ] User-defined custom portfolios
- [ ] Portfolio performance tracking over time
- [ ] Portfolio rebalancing recommendations
- [ ] Import/export portfolio configurations
- [ ] Portfolio comparison charts
- [ ] Correlation analysis between portfolios

## Related Documentation

- [Agent Manager Guide](./AGENT_MANAGER.md)
- [Market Updates](./MARKET_UPDATES_README.md)
- [Multi-Agent Architecture](./MULTI_AGENT_ARCHITECTURE.md)
