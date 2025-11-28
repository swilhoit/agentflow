# Migration Guide: AgentFlow → Personal Finance App

This guide documents how to port AgentFlow's market analysis and Discord features to the personal-finance app at https://github.com/swilhoit/personal-finance.

## Overview

### What to Port

| Component | Files | Purpose |
|-----------|-------|---------|
| **Market Analysis** | `tickerMonitor.ts`, `newsMonitor.ts` | Stock prices, news tracking |
| **AI Analysis** | `weeklyThesisAnalyzer.ts` | Claude-powered investment reports |
| **Scheduler** | `marketUpdateScheduler.ts` | Cron-based updates |
| **Discord** | `multiTenantBot.ts` (simplified) | Optional notifications |

### What Personal Finance Already Has

- ✅ Supabase (PostgreSQL + Auth)
- ✅ Plaid bank integration
- ✅ OpenAI chat assistant
- ✅ Next.js 15 + React 19
- ✅ Vercel deployment

---

## Step 1: Add Database Schema

Add these tables to your Supabase project. Run in SQL Editor:

```sql
-- Market Data (stock prices, performance)
CREATE TABLE IF NOT EXISTS public.market_data (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC(12,4) NOT NULL,
  change_amount NUMERIC(12,4),
  change_percent NUMERIC(8,4),
  volume BIGINT,
  market_cap BIGINT,
  performance_30d NUMERIC(8,4),
  performance_90d NUMERIC(8,4),
  performance_365d NUMERIC(8,4),
  date DATE NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, date)
);

CREATE INDEX idx_market_data_symbol_date ON public.market_data(symbol, date DESC);

-- Market News
CREATE TABLE IF NOT EXISTS public.market_news (
  id BIGSERIAL PRIMARY KEY,
  article_id BIGINT UNIQUE NOT NULL,
  symbol TEXT NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  category TEXT,
  sentiment TEXT,
  is_significant BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_news_symbol ON public.market_news(symbol, published_at DESC);
CREATE INDEX idx_market_news_significant ON public.market_news(is_significant, published_at DESC);

-- User Watchlists
CREATE TABLE IF NOT EXISTS public.user_watchlists (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  notes TEXT,
  target_price NUMERIC(12,4),
  alert_enabled BOOLEAN DEFAULT false,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

ALTER TABLE public.user_watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own watchlist" ON public.user_watchlists
  FOR ALL USING (auth.uid() = user_id);

-- Weekly Analysis Reports
CREATE TABLE IF NOT EXISTS public.weekly_analysis (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('thesis', 'performance', 'news')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  detailed_analysis JSONB NOT NULL,
  recommendations JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weekly_analysis_user ON public.weekly_analysis(user_id, week_start DESC);
```

---

## Step 2: Install Dependencies

Add to your personal-finance `package.json`:

```bash
cd personal-finance
npm install yahoo-finance2 finnhub node-cron @anthropic-ai/sdk
npm install -D @types/node-cron
```

---

## Step 3: Create Services

### 3.1 Market Service (`src/services/marketService.ts`)

```typescript
import YahooFinanceClass from 'yahoo-finance2';
import { createServerClient } from '@supabase/ssr';

const yahooFinance = new YahooFinanceClass();

export interface TickerData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  performance30d?: number;
  performance90d?: number;
  performance365d?: number;
}

export class MarketService {
  private supabase: ReturnType<typeof createServerClient>;

  constructor(supabase: ReturnType<typeof createServerClient>) {
    this.supabase = supabase;
  }

  async fetchTickerData(symbol: string): Promise<TickerData | null> {
    try {
      const quote: any = await yahooFinance.quote(symbol);
      
      if (!quote || !quote.regularMarketPrice) {
        return null;
      }

      const tickerData: TickerData = {
        symbol: quote.symbol || symbol,
        name: quote.shortName || symbol,
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        volume: quote.regularMarketVolume,
        marketCap: quote.marketCap,
      };

      // Fetch historical performance
      const historical = await this.fetchHistoricalPerformance(symbol);
      if (historical) {
        Object.assign(tickerData, historical);
      }

      // Save to database
      await this.saveMarketData(tickerData);

      return tickerData;
    } catch (error) {
      console.error(`Failed to fetch data for ${symbol}:`, error);
      return null;
    }
  }

  private async fetchHistoricalPerformance(symbol: string): Promise<Partial<TickerData> | null> {
    try {
      const now = new Date();
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      const historical: any = await yahooFinance.historical(symbol, {
        period1: oneYearAgo,
        period2: now,
        interval: '1d'
      });

      if (!historical || historical.length === 0) return null;

      const currentPrice = historical[historical.length - 1]?.close;
      if (!currentPrice) return null;

      const findPrice = (daysAgo: number) => {
        const targetDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        let closest = historical[0];
        let minDiff = Math.abs(new Date(historical[0].date).getTime() - targetDate.getTime());

        for (const entry of historical) {
          const diff = Math.abs(new Date(entry.date).getTime() - targetDate.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closest = entry;
          }
        }
        return closest?.close;
      };

      const price30d = findPrice(30);
      const price90d = findPrice(90);
      const price365d = findPrice(365);

      return {
        performance30d: price30d ? ((currentPrice - price30d) / price30d) * 100 : undefined,
        performance90d: price90d ? ((currentPrice - price90d) / price90d) * 100 : undefined,
        performance365d: price365d ? ((currentPrice - price365d) / price365d) * 100 : undefined,
      };
    } catch (error) {
      console.error(`Failed to fetch historical for ${symbol}:`, error);
      return null;
    }
  }

  private async saveMarketData(data: TickerData): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    await this.supabase.from('market_data').upsert({
      symbol: data.symbol,
      name: data.name,
      price: data.price,
      change_amount: data.change,
      change_percent: data.changePercent,
      volume: data.volume,
      market_cap: data.marketCap,
      performance_30d: data.performance30d,
      performance_90d: data.performance90d,
      performance_365d: data.performance365d,
      date: today,
    }, { onConflict: 'symbol,date' });
  }

  async fetchMultipleTickers(symbols: string[]): Promise<Map<string, TickerData>> {
    const results = new Map<string, TickerData>();
    
    // Batch fetch with rate limiting
    for (let i = 0; i < symbols.length; i += 5) {
      const batch = symbols.slice(i, i + 5);
      const promises = batch.map(s => this.fetchTickerData(s));
      const batchResults = await Promise.allSettled(promises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.set(batch[index], result.value);
        }
      });

      if (i + 5 < symbols.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return results;
  }

  // Get user's watchlist with current prices
  async getWatchlistWithPrices(userId: string): Promise<(TickerData & { notes?: string })[]> {
    const { data: watchlist } = await this.supabase
      .from('user_watchlists')
      .select('symbol, notes')
      .eq('user_id', userId);

    if (!watchlist || watchlist.length === 0) return [];

    const symbols = watchlist.map(w => w.symbol);
    const prices = await this.fetchMultipleTickers(symbols);

    return watchlist.map(w => ({
      ...prices.get(w.symbol)!,
      notes: w.notes,
    })).filter(w => w.symbol);
  }
}
```

### 3.2 News Service (`src/services/newsService.ts`)

```typescript
import finnhub from 'finnhub';
import { createServerClient } from '@supabase/ssr';

export interface NewsArticle {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
  related: string;
  category: string;
}

export class NewsService {
  private client: any;
  private supabase: ReturnType<typeof createServerClient>;

  constructor(apiKey: string, supabase: ReturnType<typeof createServerClient>) {
    this.client = new finnhub.DefaultApi(apiKey);
    this.supabase = supabase;
  }

  async fetchCompanyNews(symbol: string, days: number = 7): Promise<NewsArticle[]> {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = new Date().toISOString().split('T')[0];

    return new Promise((resolve, reject) => {
      this.client.companyNews(symbol, from, to, (error: any, data: any) => {
        if (error) reject(error);
        else resolve(data || []);
      });
    });
  }

  async fetchAndSaveNews(symbols: string[]): Promise<Map<string, NewsArticle[]>> {
    const newsBySymbol = new Map<string, NewsArticle[]>();

    for (const symbol of symbols) {
      try {
        const news = await this.fetchCompanyNews(symbol);
        
        if (news.length > 0) {
          newsBySymbol.set(symbol, news);

          // Save to database
          for (const article of news) {
            await this.supabase.from('market_news').upsert({
              article_id: article.id,
              symbol,
              headline: article.headline,
              summary: article.summary,
              source: article.source,
              url: article.url,
              published_at: new Date(article.datetime * 1000).toISOString(),
              category: article.category,
              is_significant: this.isSignificant(article),
            }, { onConflict: 'article_id' });
          }
        }

        await new Promise(r => setTimeout(r, 100)); // Rate limit
      } catch (error) {
        console.error(`Error fetching news for ${symbol}:`, error);
      }
    }

    return newsBySymbol;
  }

  private isSignificant(article: NewsArticle): boolean {
    const keywords = [
      'earnings', 'merger', 'acquisition', 'contract', 'partnership',
      'fda', 'approval', 'nuclear', 'uranium', 'data center', 'ai'
    ];
    const text = `${article.headline} ${article.summary}`.toLowerCase();
    return keywords.some(k => text.includes(k));
  }
}
```

### 3.3 AI Analysis Service (`src/services/analysisService.ts`)

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { createServerClient } from '@supabase/ssr';

export interface WeeklyAnalysis {
  summary: string;
  topPerformers: { symbol: string; performance: number; catalyst?: string }[];
  worstPerformers: { symbol: string; performance: number; reason?: string }[];
  recommendations: string[];
  outlook: string;
}

export class AnalysisService {
  private anthropic: Anthropic;
  private supabase: ReturnType<typeof createServerClient>;

  constructor(apiKey: string, supabase: ReturnType<typeof createServerClient>) {
    this.anthropic = new Anthropic({ apiKey });
    this.supabase = supabase;
  }

  async generateWeeklyAnalysis(userId: string): Promise<WeeklyAnalysis> {
    const weekEnd = new Date();
    const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get user's watchlist
    const { data: watchlist } = await this.supabase
      .from('user_watchlists')
      .select('symbol')
      .eq('user_id', userId);

    const symbols = watchlist?.map(w => w.symbol) || [];

    // Get market data for the week
    const { data: marketData } = await this.supabase
      .from('market_data')
      .select('*')
      .in('symbol', symbols)
      .gte('date', weekStart.toISOString().split('T')[0])
      .lte('date', weekEnd.toISOString().split('T')[0]);

    // Get news for the week
    const { data: news } = await this.supabase
      .from('market_news')
      .select('*')
      .in('symbol', symbols)
      .gte('published_at', weekStart.toISOString())
      .order('published_at', { ascending: false })
      .limit(50);

    // Build prompt
    const prompt = this.buildAnalysisPrompt(marketData || [], news || [], weekStart, weekEnd);

    // Call Claude
    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const response = message.content[0].type === 'text' ? message.content[0].text : '';
    const analysis = JSON.parse(response);

    // Save to database
    await this.supabase.from('weekly_analysis').insert({
      user_id: userId,
      week_start: weekStart.toISOString().split('T')[0],
      week_end: weekEnd.toISOString().split('T')[0],
      analysis_type: 'performance',
      title: `Weekly Analysis ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`,
      summary: analysis.summary,
      detailed_analysis: analysis,
      recommendations: analysis.recommendations,
    });

    return analysis;
  }

  private buildAnalysisPrompt(marketData: any[], news: any[], weekStart: Date, weekEnd: Date): string {
    // Calculate weekly performance
    const symbolPerf = new Map<string, { start: number; end: number }>();
    for (const data of marketData) {
      if (!symbolPerf.has(data.symbol)) {
        symbolPerf.set(data.symbol, { start: data.price, end: data.price });
      }
      const perf = symbolPerf.get(data.symbol)!;
      if (data.date < perf.start) perf.start = data.price;
      if (data.date > perf.end) perf.end = data.price;
    }

    const performances = Array.from(symbolPerf.entries())
      .map(([symbol, { start, end }]) => ({
        symbol,
        performance: ((end - start) / start) * 100,
      }))
      .sort((a, b) => b.performance - a.performance);

    return `Analyze this week's investment portfolio performance (${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}).

## Performance Data
${performances.map(p => `- ${p.symbol}: ${p.performance >= 0 ? '+' : ''}${p.performance.toFixed(2)}%`).join('\n')}

## Recent News (${news.length} articles)
${news.slice(0, 10).map(n => `- ${n.symbol}: ${n.headline}`).join('\n')}

Provide analysis in this JSON format:
{
  "summary": "2-3 sentence executive summary",
  "topPerformers": [{"symbol": "...", "performance": 5.2, "catalyst": "..."}],
  "worstPerformers": [{"symbol": "...", "performance": -3.1, "reason": "..."}],
  "recommendations": ["Action item 1", "Action item 2"],
  "outlook": "1-2 sentence outlook for next week"
}

Return only valid JSON.`;
  }
}
```

---

## Step 4: Create API Routes

### 4.1 Investments API (`src/app/api/investments/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { MarketService } from '@/services/marketService';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const marketService = new MarketService(supabase);
  const watchlist = await marketService.getWatchlistWithPrices(user.id);

  return NextResponse.json({ watchlist });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { symbol, notes } = await req.json();

  const { error } = await supabase.from('user_watchlists').upsert({
    user_id: user.id,
    symbol: symbol.toUpperCase(),
    notes,
  }, { onConflict: 'user_id,symbol' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

### 4.2 Analysis API (`src/app/api/analysis/weekly/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AnalysisService } from '@/services/analysisService';

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ error: 'Analysis not configured' }, { status: 500 });
  }

  const analysisService = new AnalysisService(anthropicKey, supabase);
  const analysis = await analysisService.generateWeeklyAnalysis(user.id);

  return NextResponse.json({ analysis });
}
```

---

## Step 5: Add Environment Variables

Add to your `.env.local` and Vercel:

```env
# Existing
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
PLAID_CLIENT_ID=...
PLAID_SECRET=...
OPENAI_API_KEY=...

# New - Market Analysis
FINNHUB_API_KEY=your_finnhub_key  # Free at finnhub.io
ANTHROPIC_API_KEY=sk-ant-...       # For Claude analysis

# Optional - Discord Notifications
DISCORD_BOT_TOKEN=...
DISCORD_WEBHOOK_URL=...
```

---

## Step 6: Discord Integration (Optional)

For simple notifications without running a full bot, use Discord webhooks:

### Webhook Notification Service (`src/services/discordNotifier.ts`)

```typescript
export class DiscordNotifier {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async sendAlert(title: string, message: string, color: number = 0x5865F2): Promise<void> {
    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title,
          description: message,
          color,
          timestamp: new Date().toISOString(),
        }],
      }),
    });
  }

  async sendBudgetAlert(category: string, spent: number, limit: number): Promise<void> {
    const percent = (spent / limit) * 100;
    const color = percent >= 100 ? 0xFF0000 : percent >= 80 ? 0xFFAA00 : 0x00FF00;
    
    await this.sendAlert(
      '💰 Budget Alert',
      `**${category}**: $${spent.toFixed(2)} / $${limit.toFixed(2)} (${percent.toFixed(0)}%)`,
      color
    );
  }

  async sendMarketAlert(symbol: string, change: number, price: number): Promise<void> {
    const emoji = change >= 0 ? '📈' : '📉';
    const color = change >= 0 ? 0x00FF00 : 0xFF0000;
    
    await this.sendAlert(
      `${emoji} ${symbol} Alert`,
      `Price: $${price.toFixed(2)}\nChange: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
      color
    );
  }
}
```

---

## Folder Structure After Migration

```
personal-finance/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── investments/
│   │   │   │   └── route.ts         # Watchlist CRUD
│   │   │   ├── market/
│   │   │   │   ├── route.ts         # Fetch market data
│   │   │   │   └── news/route.ts    # Fetch news
│   │   │   └── analysis/
│   │   │       └── weekly/route.ts  # Generate AI analysis
│   │   ├── investments/
│   │   │   └── page.tsx             # Investment dashboard
│   │   └── ...existing pages
│   ├── services/
│   │   ├── marketService.ts         # Yahoo Finance
│   │   ├── newsService.ts           # Finnhub news
│   │   ├── analysisService.ts       # Claude analysis
│   │   └── discordNotifier.ts       # Optional notifications
│   └── ...existing
├── supabase/
│   └── migrations/
│       └── add_investments.sql      # New tables
└── ...
```

---

## Testing the Migration

1. **Test Market Data Fetch**:
   ```bash
   curl http://localhost:3000/api/investments
   ```

2. **Test Adding to Watchlist**:
   ```bash
   curl -X POST http://localhost:3000/api/investments \
     -H "Content-Type: application/json" \
     -d '{"symbol": "AAPL", "notes": "Tech giant"}'
   ```

3. **Test Weekly Analysis**:
   ```bash
   curl -X POST http://localhost:3000/api/analysis/weekly
   ```

---

## What Stays in AgentFlow

- Discord bot infrastructure (your personal agents)
- Voice control (ElevenLabs)
- Trello integration
- GitHub/deployment tools
- Complex multi-agent orchestration

The personal-finance app gets the **market analysis** and **investment tracking** features in a multi-tenant, web-first form.









