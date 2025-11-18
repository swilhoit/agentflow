# Atlas Market Intelligence Integration Plan

## Current State Analysis

### Existing Market Intelligence Stack (Main Bot)

**Location**: Main AgentFlow bot (`src/index.ts`, runs with main bot)

1. **TickerMonitor** (`src/services/tickerMonitor.ts`)
   - Yahoo Finance integration
   - AI Manhattan Project thesis portfolio tracking
   - Daily/close summaries
   - Mobile-friendly embeds

2. **NewsMonitor** (`src/services/newsMonitor.ts`)
   - Finnhub API integration
   - Real-time news webhooks
   - Significance filtering
   - Discord notifications

3. **WeeklyThesisAnalyzer** (`src/services/weeklyThesisAnalyzer.ts`)
   - Claude-powered weekly analysis
   - Comprehensive market reports
   - Historical data integration

4. **PriceImpactTracker** (`src/services/priceImpactTracker.ts`)
   - Price movement tracking
   - Impact analysis

5. **MarketUpdateScheduler** (`src/services/marketUpdateScheduler.ts`)
   - Cron-based scheduling
   - 9 AM daily update
   - 4 PM market close
   - Hourly news checks
   - Weekly Sunday analysis

### Atlas Bot (Standalone)

**Location**: Separate process (`src/atlas/`, runs independently)

**Current Tools**:
- `crypto_price` - CoinGecko live prices
- `forex_rate` - FX rates
- `market_sentiment` - Fear & Greed
- `news_search` - Perplexity news ✅ NEW
- `market_intelligence` - Perplexity analysis ✅ NEW

## Integration Strategy

### Option A: Share Services (Recommended)

**Architecture**:
```
┌─────────────────────────────────────┐
│   Main Bot (Port 3001)              │
│   - MarketUpdateScheduler           │
│   - Scheduled posts to #finance     │
│   - Voice AI, task automation       │
└─────────────────────────────────────┘
                  │
                  │ Shares services
                  ▼
┌─────────────────────────────────────┐
│   Shared Market Intelligence        │
│   - TickerMonitor (Yahoo Finance)   │
│   - NewsMonitor (Finnhub)           │
│   - WeeklyThesisAnalyzer (Claude)   │
│   - PriceImpactTracker              │
│   + PerplexityNewsService ✨ NEW    │
└─────────────────────────────────────┘
                  │
                  │ Uses as tools
                  ▼
┌─────────────────────────────────────┐
│   Atlas Bot (Standalone)            │
│   - On-demand market queries        │
│   - Interactive chat in #global-ai  │
│   - Perplexity-enhanced responses   │
└─────────────────────────────────────┘
```

**Benefits**:
- ✅ Single source of truth for market data
- ✅ Consistent data across both bots
- ✅ Reduced API calls (shared caching)
- ✅ Main bot keeps scheduled posts
- ✅ Atlas gets on-demand access

### Implementation Plan

#### Phase 1: Enhance Existing Services with Perplexity ✨

**1.1 Add Perplexity to NewsMonitor**

Update `src/services/newsMonitor.ts`:
```typescript
// Add Perplexity fallback for when Finnhub is limited
async getNewsWithPerplexity(symbol: string): Promise<NewsArticle[]> {
  // Use Perplexity when Finnhub quota exhausted
  // Or for deeper analysis of breaking news
}
```

**1.2 Enhance WeeklyThesisAnalyzer**

Update `src/services/weeklyThesisAnalyzer.ts`:
```typescript
// Use Perplexity to gather latest market context
async gatherMarketContext(): Promise<string> {
  // Get real-time market developments
  // Supplement Claude's analysis with current data
}
```

**1.3 Create PerplexityMarketService**

New file: `src/services/perplexityMarketService.ts`:
```typescript
export class PerplexityMarketService {
  // Centralized Perplexity integration
  async searchNews(query: string): Promise<NewsResult>
  async getMarketIntelligence(topic: string): Promise<IntelligenceReport>
  async getAssetAnalysis(symbol: string): Promise<Analysis>
  async getGeopoliticalContext(event: string): Promise<Context>
}
```

#### Phase 2: Make Services Available to Atlas

**2.1 Atlas Tool Integration**

Update `src/atlas/atlasTools.ts`:
```typescript
import { TickerMonitor } from '../services/tickerMonitor';
import { NewsMonitor } from '../services/newsMonitor';
import { PerplexityMarketService } from '../services/perplexityMarketService';

export class AtlasTools {
  private tickerMonitor: TickerMonitor;
  private newsMonitor: NewsMonitor;
  private perplexity: PerplexityMarketService;

  // New tools:
  async getPortfolioSnapshot(): Promise<any> {
    // Use TickerMonitor
  }

  async getTickerAnalysis(symbol: string): Promise<any> {
    // Combine Yahoo Finance + Perplexity
  }

  async getBreakingNews(): Promise<any> {
    // Use NewsMonitor + Perplexity
  }
}
```

**2.2 New Atlas Tools**

Add to tool definitions:
```typescript
{
  name: 'portfolio_snapshot',
  description: 'Get current snapshot of AI Manhattan Project thesis portfolio (30+ tickers across nuclear, uranium, grid, data centers, China/ROW)'
}

{
  name: 'ticker_analysis',
  description: 'Deep dive on a specific ticker - combines price data, news, analyst opinions via Perplexity'
}

{
  name: 'breaking_news',
  description: 'Get breaking market news from Finnhub webhooks + Perplexity real-time search'
}

{
  name: 'weekly_thesis_summary',
  description: 'Get latest weekly AI Manhattan Project thesis analysis'
}
```

#### Phase 3: Perplexity Integration Points

**Where to add Perplexity**:

1. **NewsMonitor** - When Finnhub news is stale or limited
2. **WeeklyThesisAnalyzer** - Gather current market context before Claude analysis
3. **TickerMonitor** - Add analyst opinions and recent developments per ticker
4. **New: EventAnalyzer** - Analyze breaking events (Fed decisions, earnings, geopolitics)

**Example Enhanced Workflow**:

```
User asks Atlas: "what's happening with uranium stocks?"

Atlas workflow:
1. Use ticker_analysis('CCJ', 'UEC', 'UUUU')
   → TickerMonitor for prices
   → Perplexity for "latest uranium sector news"
   → Combine into response

2. Response: "Cameco (CCJ) at $52.30 (+3.2%). Spot uranium price
   hit $91/lb (highest since 2007) on Kazakh supply concerns.
   Energy Fuels (UUUU) rallying on DoE contract announcement.
   Sector seeing institutional accumulation. [Sources via Perplexity]"
```

## Implementation Steps

### Step 1: Create PerplexityMarketService ✅ PRIORITY

**File**: `src/services/perplexityMarketService.ts`

Core service that both bots can use:
- News search (what Atlas already has)
- Market intelligence (what Atlas already has)
- Asset-specific analysis
- Geopolitical context
- Sector analysis
- Earnings insights

### Step 2: Update Atlas Tools

**File**: `src/atlas/atlasTools.ts`

Add:
- `portfolio_snapshot` - AI Manhattan thesis positions
- `ticker_analysis` - Deep dive any ticker
- `sector_analysis` - Analyze sectors (uranium, AI chips, etc.)
- `breaking_news` - Latest from Finnhub + Perplexity

### Step 3: Enhance Existing Services

**NewsMonitor**:
- Add Perplexity fallback
- Enhance significance detection

**WeeklyThesisAnalyzer**:
- Use Perplexity for market context gathering
- More current data in weekly reports

**TickerMonitor**:
- Add Perplexity ticker analysis
- Include analyst opinions in embeds

### Step 4: Update Main Bot Scheduled Posts

Enhance scheduled posts with Perplexity insights:
- 9 AM daily: Include overnight news via Perplexity
- 4 PM close: Add market-moving events from Perplexity
- Weekly analysis: Rich context from Perplexity + Claude synthesis

## Division of Responsibilities

### Main Bot
- **Scheduled automated posts** to #finance
- Daily 9 AM AI Manhattan thesis update
- 4 PM market close summary
- Hourly news checks
- Weekly Sunday analysis
- **Focus**: US-centric AI Manhattan Project thesis

### Atlas Bot
- **On-demand interactive queries** in #global-ai, #crypto-alerts
- Real-time responses to user questions
- Global markets perspective
- Crypto-first analysis
- Perplexity-powered current events
- **Focus**: Global markets, crypto, geopolitics

## Perplexity Usage Strategy

**When to use Perplexity**:
- ✅ Breaking news queries ("what happened today")
- ✅ Current events ("latest Fed decision")
- ✅ Geopolitical developments ("China stimulus")
- ✅ Earnings/data releases ("Nvidia earnings")
- ✅ Analyst opinions ("what are analysts saying about...")
- ✅ Sector trends ("semiconductor supply chain")

**When NOT to use Perplexity**:
- ❌ Historical data (use database)
- ❌ Price checks (use CoinGecko/Yahoo Finance - faster)
- ❌ Technical analysis (use internal tools)
- ❌ General knowledge (Claude is fine)

**Cost Management**:
- Cache Perplexity results (5-15 min TTL)
- Use `sonar-small` for quick queries
- Use `sonar-large` only for comprehensive analysis
- Estimate: $0.50-2.00/day for typical usage

## Next Steps

### Immediate (Today)
1. ✅ Create `PerplexityMarketService`
2. ✅ Add portfolio/ticker tools to Atlas
3. ✅ Test integration

### Short-term (This Week)
1. Enhance NewsMonitor with Perplexity
2. Update WeeklyThesisAnalyzer
3. Add Perplexity context to scheduled posts

### Medium-term (Next Week)
1. Build EventAnalyzer for breaking events
2. Add sector analysis tools
3. Implement smart caching for Perplexity
4. Create unified market intelligence dashboard

## Testing Plan

### Phase 1: Atlas Tools
```bash
npm run atlas:dev
```

Test in Discord:
```
atlas show me the AI Manhattan portfolio

atlas deep dive on CCJ

atlas what's the latest uranium sector news

atlas breaking market news
```

### Phase 2: Main Bot Enhancement
```bash
npm run dev
```

Check scheduled posts have Perplexity insights:
- 9 AM update includes overnight developments
- Weekly analysis has current market context

### Phase 3: Integration
- Both bots running simultaneously
- Verify shared data consistency
- Check no duplicate API calls
- Validate caching working

## Success Criteria

✅ Atlas can access all main bot market data
✅ Perplexity enhances both bots' intelligence
✅ No duplicate work between bots
✅ Scheduled posts remain in main bot
✅ Atlas provides on-demand global insights
✅ Cost-effective Perplexity usage
✅ Sub-3s response times for Atlas

---

Ready to implement? We'll start with creating the `PerplexityMarketService` and adding portfolio/ticker tools to Atlas.
