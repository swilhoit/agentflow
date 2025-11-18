import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { PerplexityMarketService } from '../services/perplexityMarketService';
import { TickerMonitor } from '../services/tickerMonitor';
import { NewsMonitor } from '../services/newsMonitor';

/**
 * Atlas Tools - Specialized tools for global markets analysis
 *
 * Provides real-time market data, sentiment analysis, and news for Atlas bot
 */
export class AtlasTools {
  private perplexity: PerplexityMarketService | null = null;
  private tickerMonitor: TickerMonitor;
  private newsMonitor: NewsMonitor | null = null;

  constructor() {
    // Initialize Perplexity
    const perplexityKey = process.env.PERPLEXITY_API_KEY;
    if (perplexityKey) {
      this.perplexity = new PerplexityMarketService(perplexityKey);
      logger.info('✅ Perplexity integration enabled for Atlas');
    } else {
      logger.warn('⚠️ PERPLEXITY_API_KEY not found');
    }

    // Initialize TickerMonitor for AI Manhattan Project portfolio
    this.tickerMonitor = new TickerMonitor();
    logger.info('✅ TickerMonitor integrated into Atlas');

    // Initialize NewsMonitor if Finnhub key available
    const finnhubKey = process.env.FINNHUB_API_KEY;
    if (finnhubKey) {
      this.newsMonitor = new NewsMonitor(finnhubKey);
      logger.info('✅ NewsMonitor integrated into Atlas');
    }
  }
  /**
   * Get tool definitions for Claude
   */
  getToolDefinitions(): Anthropic.Tool[] {
    return [
      {
        name: 'crypto_price',
        description: 'Get current cryptocurrency price and 24h change. Supports BTC, ETH, and other major cryptocurrencies.',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'Cryptocurrency symbol (e.g., BTC, ETH, SOL)'
            }
          },
          required: ['symbol']
        }
      },
      {
        name: 'forex_rate',
        description: 'Get current foreign exchange rate between two currencies.',
        input_schema: {
          type: 'object',
          properties: {
            from: {
              type: 'string',
              description: 'Base currency code (e.g., USD, EUR)'
            },
            to: {
              type: 'string',
              description: 'Quote currency code (e.g., EUR, JPY)'
            }
          },
          required: ['from', 'to']
        }
      },
      {
        name: 'market_sentiment',
        description: 'Get crypto market sentiment indicators including Fear & Greed Index, funding rates, and on-chain metrics.',
        input_schema: {
          type: 'object',
          properties: {
            metric: {
              type: 'string',
              enum: ['fear_greed', 'funding_rates', 'all'],
              description: 'Which sentiment metric to retrieve'
            }
          },
          required: ['metric']
        }
      },
      {
        name: 'news_search',
        description: 'Get latest real-time news and analysis on market topics using Perplexity AI. Returns current news, expert analysis, and relevant context with citations.',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Market news query (e.g., "latest Bitcoin ETF news", "Fed rate decision today", "China economic stimulus", "Nvidia earnings")'
            },
            focus: {
              type: 'string',
              enum: ['news', 'analysis', 'both'],
              description: 'Focus on breaking news, analytical insights, or both (default: both)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'market_intelligence',
        description: 'Get comprehensive market intelligence report on a topic using Perplexity. Includes recent developments, expert opinions, data points, and market implications.',
        input_schema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: 'Market intelligence topic (e.g., "global semiconductor supply chain", "crypto regulation 2024", "emerging markets outlook")'
            }
          },
          required: ['topic']
        }
      },
      {
        name: 'chart_analysis',
        description: 'Get technical analysis summary for an asset (support/resistance, trend, indicators).',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'Asset symbol (e.g., BTCUSD, ETHUSD, EURUSD)'
            },
            timeframe: {
              type: 'string',
              enum: ['1h', '4h', '1d', '1w'],
              description: 'Chart timeframe'
            }
          },
          required: ['symbol', 'timeframe']
        }
      },
      {
        name: 'portfolio_snapshot',
        description: 'Get current snapshot of AI Manhattan Project thesis portfolio - includes 30+ tickers across nuclear, uranium, grid infrastructure, data centers, China/ROW positions, and ETFs. Shows prices, changes, and category performance.',
        input_schema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'ticker_deep_dive',
        description: 'Deep analysis on a specific ticker - combines real-time price from Yahoo Finance, latest news from Perplexity, analyst opinions, and market context. Use for detailed stock/ETF analysis.',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'Ticker symbol (e.g., CCJ, OKLO, BTC-USD, URA)'
            }
          },
          required: ['symbol']
        }
      },
      {
        name: 'sector_analysis',
        description: 'Comprehensive sector analysis using Perplexity - trends, key players, performance, catalysts. Good for uranium, nuclear, AI chips, data centers, crypto, etc.',
        input_schema: {
          type: 'object',
          properties: {
            sector: {
              type: 'string',
              description: 'Sector name (e.g., "uranium mining", "AI semiconductors", "nuclear energy", "DeFi")'
            }
          },
          required: ['sector']
        }
      },
      {
        name: 'geopolitical_analysis',
        description: 'Analyze market implications of geopolitical events using Perplexity - wars, elections, policy changes, trade disputes, central bank actions.',
        input_schema: {
          type: 'object',
          properties: {
            event: {
              type: 'string',
              description: 'Geopolitical event (e.g., "China stimulus package", "Fed rate decision", "Ukraine conflict", "US-China trade tensions")'
            }
          },
          required: ['event']
        }
      },
      {
        name: 'earnings_analysis',
        description: 'Get latest earnings analysis for a company using Perplexity - results, guidance, market reaction, key takeaways.',
        input_schema: {
          type: 'object',
          properties: {
            company: {
              type: 'string',
              description: 'Company name or ticker (e.g., "Nvidia", "TSLA", "Cameco")'
            }
          },
          required: ['company']
        }
      },
      {
        name: 'breaking_market_news',
        description: 'Get breaking market news from Finnhub webhooks for AI Manhattan thesis tickers (if available), supplemented with Perplexity real-time search.',
        input_schema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: 'Optional topic filter (e.g., "uranium", "nuclear")'
            }
          },
          required: []
        }
      }
    ];
  }

  /**
   * Execute a tool call
   */
  async executeTool(toolName: string, input: Record<string, any>): Promise<any> {
    logger.info(`Atlas executing tool: ${toolName}`, input);

    switch (toolName) {
      case 'crypto_price':
        return await this.getCryptoPrice(input.symbol);

      case 'forex_rate':
        return await this.getForexRate(input.from, input.to);

      case 'market_sentiment':
        return await this.getMarketSentiment(input.metric);

      case 'news_search':
        return await this.searchNews(input.query, input.focus || 'both');

      case 'market_intelligence':
        return await this.getMarketIntelligence(input.topic);

      case 'chart_analysis':
        return await this.getChartAnalysis(input.symbol, input.timeframe);

      case 'portfolio_snapshot':
        return await this.getPortfolioSnapshot();

      case 'ticker_deep_dive':
        return await this.getTickerDeepDive(input.symbol);

      case 'sector_analysis':
        return await this.getSectorAnalysis(input.sector);

      case 'geopolitical_analysis':
        return await this.getGeopoliticalAnalysis(input.event);

      case 'earnings_analysis':
        return await this.getEarningsAnalysis(input.company);

      case 'breaking_market_news':
        return await this.getBreakingNews(input.topic);

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  /**
   * Get cryptocurrency price
   */
  private async getCryptoPrice(symbol: string): Promise<any> {
    try {
      // Use CoinGecko API (free, no key required)
      const coinId = this.getCoinGeckoId(symbol);
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
      );

      if (!response.ok) {
        return { error: 'Failed to fetch price data' };
      }

      const data: any = await response.json();
      const coinData = data[coinId];

      if (!coinData) {
        return { error: `Price data not found for ${symbol}` };
      }

      return {
        symbol: symbol.toUpperCase(),
        price: coinData.usd,
        change_24h: coinData.usd_24h_change?.toFixed(2),
        market_cap: coinData.usd_market_cap,
        volume_24h: coinData.usd_24h_vol,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error fetching crypto price for ${symbol}:`, error);
      return { error: 'Price data unavailable' };
    }
  }

  /**
   * Get forex rate
   */
  private async getForexRate(from: string, to: string): Promise<any> {
    try {
      // Use exchangerate-api (free tier)
      const response = await fetch(
        `https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`
      );

      if (!response.ok) {
        return { error: 'Failed to fetch forex data' };
      }

      const data: any = await response.json();
      const rate = data.rates[to.toUpperCase()];

      if (!rate) {
        return { error: `Rate not found for ${from}/${to}` };
      }

      return {
        pair: `${from.toUpperCase()}/${to.toUpperCase()}`,
        rate: rate,
        timestamp: data.date
      };
    } catch (error) {
      logger.error(`Error fetching forex rate for ${from}/${to}:`, error);
      return { error: 'Forex data unavailable' };
    }
  }

  /**
   * Get market sentiment
   */
  private async getMarketSentiment(metric: string): Promise<any> {
    try {
      // Use Fear & Greed Index API (free)
      const response = await fetch('https://api.alternative.me/fng/');

      if (!response.ok) {
        return { error: 'Failed to fetch sentiment data' };
      }

      const data: any = await response.json();
      const latest = data.data[0];

      return {
        fear_greed_index: parseInt(latest.value),
        classification: latest.value_classification,
        timestamp: latest.timestamp,
        interpretation: this.interpretFearGreed(parseInt(latest.value))
      };
    } catch (error) {
      logger.error('Error fetching market sentiment:', error);
      return { error: 'Sentiment data unavailable' };
    }
  }

  /**
   * Get AI Manhattan Project portfolio snapshot
   */
  private async getPortfolioSnapshot(): Promise<any> {
    try {
      logger.info('Fetching AI Manhattan Project portfolio snapshot...');
      const categoryData = await this.tickerMonitor.fetchThesisPortfolio();

      const summary: any = {
        portfolioName: 'AI Manhattan Project + China/ROW',
        timestamp: new Date().toISOString(),
        categories: []
      };

      for (const [categoryName, tickers] of categoryData) {
        const tickerArray = Array.from(tickers.values());
        const avgChange = tickerArray.reduce((sum, t) => sum + t.changePercent, 0) / tickerArray.length;

        summary.categories.push({
          name: categoryName,
          tickerCount: tickerArray.length,
          avgChange: avgChange.toFixed(2),
          tickers: tickerArray.map(t => ({
            symbol: t.symbol,
            name: t.name,
            price: t.price,
            change: t.changePercent,
            performance30d: t.performance30d,
            performance90d: t.performance90d
          }))
        });
      }

      return summary;
    } catch (error) {
      logger.error('Error fetching portfolio snapshot:', error);
      return { error: 'Portfolio data unavailable' };
    }
  }

  /**
   * Deep dive on a specific ticker
   */
  private async getTickerDeepDive(symbol: string): Promise<any> {
    try {
      logger.info(`Ticker deep dive: ${symbol}`);

      // Get price data
      const tickerData = await this.tickerMonitor.fetchTickerData(symbol, true);

      // Get latest news/analysis from Perplexity
      const analysis = this.perplexity
        ? await this.perplexity.getAssetAnalysis(symbol)
        : { analysis: 'Perplexity not available' };

      return {
        symbol,
        price: tickerData?.price,
        change: tickerData?.changePercent,
        volume: tickerData?.volume,
        marketCap: tickerData?.marketCap,
        performance: {
          '30d': tickerData?.performance30d,
          '90d': tickerData?.performance90d,
          '1y': tickerData?.performance365d
        },
        analysis: analysis.analysis,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error in ticker deep dive for ${symbol}:`, error);
      return { error: 'Ticker analysis failed' };
    }
  }

  /**
   * Get sector analysis
   */
  private async getSectorAnalysis(sector: string): Promise<any> {
    if (!this.perplexity) {
      return { error: 'Perplexity not available' };
    }
    return await this.perplexity.getSectorAnalysis(sector);
  }

  /**
   * Get geopolitical analysis
   */
  private async getGeopoliticalAnalysis(event: string): Promise<any> {
    if (!this.perplexity) {
      return { error: 'Perplexity not available' };
    }
    return await this.perplexity.getGeopoliticalContext(event);
  }

  /**
   * Get earnings analysis
   */
  private async getEarningsAnalysis(company: string): Promise<any> {
    if (!this.perplexity) {
      return { error: 'Perplexity not available' };
    }
    return await this.perplexity.getEarningsAnalysis(company);
  }

  /**
   * Get breaking market news
   */
  private async getBreakingNews(topic?: string): Promise<any> {
    try {
      // Use Perplexity for real-time breaking news
      if (this.perplexity) {
        const query = topic
          ? `latest breaking news on ${topic} markets`
          : 'latest breaking market news today';
        return await this.perplexity.searchNews(query, 'news');
      }

      return { error: 'News service not available' };
    } catch (error) {
      logger.error('Error fetching breaking news:', error);
      return { error: 'Breaking news unavailable' };
    }
  }

  /**
   * Search for news using Perplexity
   */
  private async searchNews(query: string, focus: string): Promise<any> {
    if (!this.perplexity) {
      return {
        error: 'Perplexity API key not configured',
        fallback: 'Use your knowledge of recent market events'
      };
    }

    return await this.perplexity.searchNews(query, focus as any);
  }

  /**
   * Get comprehensive market intelligence using Perplexity
   */
  private async getMarketIntelligence(topic: string): Promise<any> {
    if (!this.perplexity) {
      return {
        error: 'Perplexity API key not configured',
        fallback: 'Use your knowledge of the topic'
      };
    }

    return await this.perplexity.getMarketIntelligence(topic);
  }

  /**
   * Get chart analysis
   */
  private async getChartAnalysis(symbol: string, timeframe: string): Promise<any> {
    try {
      // Simplified technical analysis
      // TODO: Integrate with TradingView or similar API
      return {
        symbol,
        timeframe,
        note: 'Use price data from crypto_price tool to provide technical context',
        suggestion: 'Reference key levels, trends, and patterns from your training data'
      };
    } catch (error) {
      logger.error('Error getting chart analysis:', error);
      return { error: 'Chart analysis unavailable' };
    }
  }

  /**
   * Map crypto symbols to CoinGecko IDs
   */
  private getCoinGeckoId(symbol: string): string {
    const mapping: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'SOL': 'solana',
      'BNB': 'binancecoin',
      'XRP': 'ripple',
      'ADA': 'cardano',
      'DOGE': 'dogecoin',
      'AVAX': 'avalanche-2',
      'DOT': 'polkadot',
      'MATIC': 'matic-network',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'ATOM': 'cosmos',
      'LTC': 'litecoin',
      'BCH': 'bitcoin-cash'
    };

    return mapping[symbol.toUpperCase()] || symbol.toLowerCase();
  }

  /**
   * Interpret Fear & Greed Index value
   */
  private interpretFearGreed(value: number): string {
    if (value >= 75) {
      return 'Extreme Greed - Market may be overheated, watch for reversal';
    } else if (value >= 55) {
      return 'Greed - Bullish sentiment, but not extreme';
    } else if (value >= 45) {
      return 'Neutral - Balanced market sentiment';
    } else if (value >= 25) {
      return 'Fear - Bearish sentiment, potential buying opportunity';
    } else {
      return 'Extreme Fear - Possible capitulation, contrarian buy signal';
    }
  }
}
