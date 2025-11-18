import YahooFinanceClass from 'yahoo-finance2';
import { logger } from '../utils/logger';
import { EmbedBuilder, Colors } from 'discord.js';
import { getDatabase } from './databaseFactory';

// Initialize yahoo-finance2 instance
const yahooFinance = new YahooFinanceClass();

export interface TickerData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  timestamp: Date;
  // Historical performance
  performance30d?: number;
  performance90d?: number;
  performance365d?: number;
}

export interface TickerCategory {
  name: string;
  description: string;
  tickers: string[];
  allocation?: string;
}

/**
 * AI Manhattan Project + China/ROW Thesis Ticker Configuration
 */
export const THESIS_PORTFOLIO: TickerCategory[] = [
  {
    name: "🇺🇸 US Nuclear & Micro Reactors",
    description: "Next-gen nuclear & small modular reactors",
    tickers: ["OKLO", "NNE", "SMR", "NNE"],
    allocation: "15-20%"
  },
  {
    name: "☢️ Uranium Mining & Enrichment",
    description: "Uranium production & fuel cycle",
    tickers: ["UUUU", "UEC", "CCJ", "LEU", "LTBR"],
    allocation: "15-20%"
  },
  {
    name: "⚡ Grid Infrastructure & Power",
    description: "Electrical grid modernization",
    tickers: ["PWR", "MYRG", "ET", "WMB", "TLN"],
    allocation: "10-15%"
  },
  {
    name: "🏢 Data Center REITs",
    description: "AI infrastructure real estate",
    tickers: ["DLR", "EQIX"],
    allocation: "10-15%"
  },
  {
    name: "⛏️ Critical Minerals",
    description: "Copper, rare earths, supply chain",
    tickers: ["FCX", "ASPI"],
    allocation: "5-10%"
  },
  {
    name: "🌏 China & ROW Nuclear/Uranium",
    description: "Global nuclear expansion",
    tickers: ["1816.HK", "PDN.AX", "KAP.L", "CGG.TO"],
    allocation: "15-20%"
  },
  {
    name: "📊 Thematic ETFs & Trusts",
    description: "Uranium & nuclear ETFs",
    tickers: ["SRUUF", "U-UN.TO", "URA", "NLR", "URNM"],
    allocation: "10-15%"
  }
];

/**
 * Ticker Monitoring Service
 * Fetches real-time market data for AI Manhattan Project thesis
 */
export class TickerMonitor {
  private cache: Map<string, TickerData> = new Map();
  private lastUpdate: Date | null = null;
  private db = getDatabase();

  constructor() {
    // yahoo-finance2 is a singleton, no initialization needed
  }

  /**
   * Fetch quote data for a single ticker
   */
  async fetchTickerData(symbol: string, includeHistorical: boolean = true): Promise<TickerData | null> {
    try {
      logger.info(`Fetching data for ${symbol}...`);

      const quote: any = await yahooFinance.quote(symbol);

      if (!quote || !quote.regularMarketPrice) {
        logger.warn(`No data available for ${symbol}`);
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
        timestamp: new Date()
      };

      // Fetch historical performance if requested
      if (includeHistorical) {
        const historical = await this.fetchHistoricalPerformance(symbol);
        if (historical) {
          tickerData.performance30d = historical.performance30d;
          tickerData.performance90d = historical.performance90d;
          tickerData.performance365d = historical.performance365d;
        }
      }

      // Cache the result
      this.cache.set(symbol, tickerData);

      // Save to database
      try {
        const today = new Date().toISOString().split('T')[0];
        this.db.saveMarketData({
          symbol: tickerData.symbol,
          name: tickerData.name,
          price: tickerData.price,
          changeAmount: tickerData.change,
          changePercent: tickerData.changePercent,
          volume: tickerData.volume,
          marketCap: tickerData.marketCap,
          performance30d: tickerData.performance30d,
          performance90d: tickerData.performance90d,
          performance365d: tickerData.performance365d,
          date: today
        });
      } catch (error) {
        logger.warn(`Failed to save market data for ${symbol} to database:`, error);
      }

      return tickerData;
    } catch (error: any) {
      logger.error(`Failed to fetch data for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch historical performance for a ticker
   */
  private async fetchHistoricalPerformance(symbol: string): Promise<{
    performance30d?: number;
    performance90d?: number;
    performance365d?: number;
  } | null> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      // Fetch historical data
      const historical: any = await yahooFinance.historical(symbol, {
        period1: oneYearAgo,
        period2: now,
        interval: '1d'
      });

      if (!historical || historical.length === 0) {
        return null;
      }

      // Get current price from the most recent data point
      const currentPrice = historical[historical.length - 1]?.close;
      if (!currentPrice) return null;

      // Find prices at different time periods
      const price30d = this.findClosestPrice(historical, thirtyDaysAgo);
      const price90d = this.findClosestPrice(historical, ninetyDaysAgo);
      const price365d = this.findClosestPrice(historical, oneYearAgo);

      return {
        performance30d: price30d ? ((currentPrice - price30d) / price30d) * 100 : undefined,
        performance90d: price90d ? ((currentPrice - price90d) / price90d) * 100 : undefined,
        performance365d: price365d ? ((currentPrice - price365d) / price365d) * 100 : undefined
      };
    } catch (error: any) {
      logger.warn(`Failed to fetch historical data for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Find the closest price to a target date
   */
  private findClosestPrice(historical: any[], targetDate: Date): number | null {
    if (!historical || historical.length === 0) return null;

    let closest = historical[0];
    let minDiff = Math.abs(new Date(historical[0].date).getTime() - targetDate.getTime());

    for (const entry of historical) {
      const diff = Math.abs(new Date(entry.date).getTime() - targetDate.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closest = entry;
      }
    }

    return closest?.close || null;
  }

  /**
   * Fetch data for multiple tickers
   */
  async fetchMultipleTickers(symbols: string[]): Promise<Map<string, TickerData>> {
    const results = new Map<string, TickerData>();

    // Fetch in batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const promises = batch.map(symbol => this.fetchTickerData(symbol));
      const batchResults = await Promise.allSettled(promises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.set(batch[index], result.value);
        }
      });

      // Small delay between batches
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    this.lastUpdate = new Date();
    return results;
  }

  /**
   * Fetch all tickers from thesis portfolio
   */
  async fetchThesisPortfolio(): Promise<Map<string, Map<string, TickerData>>> {
    const categoryData = new Map<string, Map<string, TickerData>>();

    for (const category of THESIS_PORTFOLIO) {
      logger.info(`Fetching ${category.name}...`);
      const data = await this.fetchMultipleTickers(category.tickers);
      categoryData.set(category.name, data);

      // Delay between categories
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return categoryData;
  }

  /**
   * Get top movers (biggest gains/losses)
   */
  getTopMovers(data: Map<string, TickerData>, count: number = 5): {
    gainers: TickerData[];
    losers: TickerData[];
  } {
    const allTickers = Array.from(data.values());

    const gainers = allTickers
      .filter(t => t.changePercent > 0)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, count);

    const losers = allTickers
      .filter(t => t.changePercent < 0)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, count);

    return { gainers, losers };
  }

  /**
   * Generate daily summary embed (mobile-friendly format)
   */
  generateDailySummaryEmbed(categoryData: Map<string, Map<string, TickerData>>): EmbedBuilder[] {
    const embeds: EmbedBuilder[] = [];

    // Calculate overall portfolio stats
    let totalTickers = 0;
    let gainers = 0;
    let losers = 0;
    const allTickerData: TickerData[] = [];

    for (const [categoryName, tickers] of categoryData) {
      const tickerArray = Array.from(tickers.values());
      totalTickers += tickerArray.length;
      gainers += tickerArray.filter(t => t.changePercent > 0).length;
      losers += tickerArray.filter(t => t.changePercent < 0).length;
      allTickerData.push(...tickerArray);
    }

    // Main summary embed - simplified for mobile
    const mainEmbed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle('📈 AI Manhattan Project Daily Update')
      .setDescription('Energy revolution powering AI × global competition')
      .setTimestamp()
      .setFooter({ text: 'Yahoo Finance • Swipe for details' });

    mainEmbed.addFields({
      name: '📊 Overview',
      value: `🟢 ${gainers} Up • 🔴 ${losers} Down • ⚪ ${totalTickers - gainers - losers} Flat`,
      inline: false
    });

    embeds.push(mainEmbed);

    // Top movers embed - cleaner mobile format
    const allData = new Map(allTickerData.map(t => [t.symbol, t]));
    const { gainers: topGainers, losers: topLosers } = this.getTopMovers(allData, 3);

    const moversEmbed = new EmbedBuilder()
      .setColor(Colors.Gold)
      .setTitle('🎯 Top Movers')
      .setTimestamp();

    if (topGainers.length > 0) {
      const gainersText = topGainers
        .map(t => `**${t.symbol}** $${t.price.toFixed(2)} ⬆ ${t.changePercent.toFixed(1)}%`)
        .join('\n');
      moversEmbed.addFields({ name: '🟢 Gainers', value: gainersText, inline: true });
    }

    if (topLosers.length > 0) {
      const losersText = topLosers
        .map(t => `**${t.symbol}** $${t.price.toFixed(2)} ⬇ ${Math.abs(t.changePercent).toFixed(1)}%`)
        .join('\n');
      moversEmbed.addFields({ name: '🔴 Losers', value: losersText, inline: true });
    }

    embeds.push(moversEmbed);

    // Category-specific embeds
    for (const category of THESIS_PORTFOLIO) {
      const data = categoryData.get(category.name);
      if (!data || data.size === 0) continue;

      const categoryEmbed = new EmbedBuilder()
        .setColor(this.getCategoryColor(category.name))
        .setTitle(category.name)
        .setDescription(`${category.description}\n*Target Allocation: ${category.allocation || 'TBD'}*`)
        .setTimestamp();

      let fieldText = '';
      for (const [symbol, ticker] of data) {
        // Color-coded markers based on performance
        const getDayMarker = (change: number): string => {
          if (change >= 5) return '🟩'; // Strong up
          if (change >= 2) return '🟢'; // Up
          if (change >= 0) return '🔵'; // Slight up
          if (change >= -2) return '🟡'; // Slight down
          if (change >= -5) return '🟠'; // Down
          return '🔴'; // Strong down
        };

        const dayMarker = getDayMarker(ticker.changePercent);
        const changeSymbol = ticker.changePercent >= 0 ? '+' : '';

        // Build price line with color-coded marker
        let line = `${dayMarker} **${ticker.symbol}**: $${ticker.price.toFixed(2)} (${changeSymbol}${ticker.changePercent.toFixed(2)}%)`;

        // Add historical performance if available with color coding
        if (ticker.performance30d !== undefined || ticker.performance90d !== undefined || ticker.performance365d !== undefined) {
          const perfParts = [];
          if (ticker.performance30d !== undefined) {
            const p30Marker = this.getPerformanceMarker(ticker.performance30d);
            perfParts.push(`${p30Marker}30d: ${ticker.performance30d >= 0 ? '+' : ''}${ticker.performance30d.toFixed(1)}%`);
          }
          if (ticker.performance90d !== undefined) {
            const p90Marker = this.getPerformanceMarker(ticker.performance90d);
            perfParts.push(`${p90Marker}90d: ${ticker.performance90d >= 0 ? '+' : ''}${ticker.performance90d.toFixed(1)}%`);
          }
          if (ticker.performance365d !== undefined) {
            const p365Marker = this.getPerformanceMarker(ticker.performance365d);
            perfParts.push(`${p365Marker}1y: ${ticker.performance365d >= 0 ? '+' : ''}${ticker.performance365d.toFixed(1)}%`);
          }
          if (perfParts.length > 0) {
            line += `\n   ${perfParts.join(' | ')}`;
          }
        }

        fieldText += line + '\n';
      }

      if (fieldText) {
        categoryEmbed.addFields({ name: 'Tickers', value: fieldText, inline: false });
      }

      // Add category stats
      const tickerArray = Array.from(data.values());
      const avgChange = tickerArray.reduce((sum, t) => sum + t.changePercent, 0) / tickerArray.length;
      categoryEmbed.addFields({
        name: 'Category Performance',
        value: `Avg Change: ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%`,
        inline: true
      });

      embeds.push(categoryEmbed);
    }

    return embeds;
  }

  /**
   * Generate compact summary (for quick updates)
   */
  generateCompactSummary(categoryData: Map<string, Map<string, TickerData>>): string {
    let summary = '📊 **AI Manhattan Thesis Update**\n\n';

    for (const [categoryName, tickers] of categoryData) {
      const tickerArray = Array.from(tickers.values());
      if (tickerArray.length === 0) continue;

      const avgChange = tickerArray.reduce((sum, t) => sum + t.changePercent, 0) / tickerArray.length;
      const emoji = avgChange >= 0 ? '🟢' : '🔴';

      summary += `${emoji} **${categoryName.replace(/[^\w\s]/g, '')}**: ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}% avg\n`;
    }

    summary += `\n*Last updated: ${new Date().toLocaleString()}*`;
    return summary;
  }

  /**
   * Get performance marker based on % change
   */
  private getPerformanceMarker(change: number): string {
    if (change >= 20) return '🟩'; // Strong up (>20%)
    if (change >= 10) return '🟢'; // Up (10-20%)
    if (change >= 0) return '🔵'; // Slight up (0-10%)
    if (change >= -10) return '🟡'; // Slight down (0 to -10%)
    if (change >= -20) return '🟠'; // Down (-10 to -20%)
    return '🔴'; // Strong down (<-20%)
  }

  /**
   * Get color for category
   */
  private getCategoryColor(categoryName: string): number {
    if (categoryName.includes('Nuclear') || categoryName.includes('Uranium')) return Colors.Orange;
    if (categoryName.includes('Grid') || categoryName.includes('Power')) return Colors.Yellow;
    if (categoryName.includes('REITs')) return Colors.Green;
    if (categoryName.includes('China') || categoryName.includes('ROW')) return Colors.Red;
    if (categoryName.includes('ETFs')) return Colors.Purple;
    if (categoryName.includes('Minerals')) return Colors.DarkGold;
    return Colors.Blue;
  }

  /**
   * Get cached data
   */
  getCachedData(symbol: string): TickerData | null {
    return this.cache.get(symbol) || null;
  }

  /**
   * Get last update time
   */
  getLastUpdateTime(): Date | null {
    return this.lastUpdate;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.lastUpdate = null;
    logger.info('Ticker cache cleared');
  }
}
