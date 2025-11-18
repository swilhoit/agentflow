import { logger } from '../utils/logger';

/**
 * Perplexity Market Intelligence Service
 *
 * Centralized service for real-time market intelligence using Perplexity AI.
 * Used by Atlas bot for current market data, news, and analysis.
 */
export class PerplexityMarketService {
  private apiKey: string;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    logger.info('✅ PerplexityMarketService initialized');
  }

  /**
   * Search for latest market news
   */
  async searchNews(query: string, focus: 'news' | 'analysis' | 'both' = 'both'): Promise<any> {
    const cacheKey = `news:${query}:${focus}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      logger.info(`Perplexity news search: ${query}`);

      const systemPrompt = focus === 'news'
        ? 'You are a financial news aggregator. Provide a concise summary of the latest breaking news on the topic. Focus on what happened, when, and immediate market impact. Include key data points and quotes.'
        : focus === 'analysis'
        ? 'You are a market analyst. Provide analytical insights on the topic. Focus on implications, trends, expert opinions, and market outlook. Skip basic news recap.'
        : 'You are a comprehensive market intelligence source. Provide both breaking news and analytical insights. Include what happened, why it matters, expert opinions, and market implications.';

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Market query: ${query}\n\nProvide latest information as of ${new Date().toISOString().split('T')[0]}. Include specific dates, numbers, and sources where relevant. Be concise but comprehensive.`
            }
          ],
          temperature: 0.2,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }

      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content;

      const result = {
        query,
        focus,
        summary: content || 'No news found',
        timestamp: new Date().toISOString(),
        source: 'Perplexity AI'
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('Perplexity news search error:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive market intelligence on a topic
   */
  async getMarketIntelligence(topic: string): Promise<any> {
    const cacheKey = `intelligence:${topic}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      logger.info(`Perplexity market intelligence: ${topic}`);

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [
            {
              role: 'system',
              content: `You are a global markets intelligence analyst. Provide comprehensive, multi-faceted analysis on market topics. Include:
1. Recent Developments: Key events, announcements, data releases (with dates)
2. Expert Opinions: What analysts, economists, or industry leaders are saying
3. Data Points: Relevant statistics, metrics, price levels
4. Market Implications: How this affects different markets (equities, crypto, FX, commodities)
5. Outlook: Short-term and medium-term expectations

Be specific, cite sources implicitly, use numbers, and maintain analytical objectivity.`
            },
            {
              role: 'user',
              content: `Provide comprehensive market intelligence on: ${topic}\n\nCurrent date: ${new Date().toISOString().split('T')[0]}`
            }
          ],
          temperature: 0.3,
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }

      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content;

      const result = {
        topic,
        intelligence: content || 'No intelligence available',
        timestamp: new Date().toISOString(),
        source: 'Perplexity AI',
        model: 'sonar-pro'
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('Perplexity market intelligence error:', error);
      throw error;
    }
  }

  /**
   * Get deep analysis on a specific ticker/asset
   */
  async getAssetAnalysis(symbol: string): Promise<any> {
    const cacheKey = `asset:${symbol}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      logger.info(`Perplexity asset analysis: ${symbol}`);

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: 'You are a financial analyst. Provide concise analysis on the asset including: recent price action, key news/catalysts, analyst opinions, technical levels, and outlook. Be specific with numbers and dates.'
            },
            {
              role: 'user',
              content: `Analyze ${symbol}. Today's date: ${new Date().toISOString().split('T')[0]}. Include latest developments, price levels, and market sentiment.`
            }
          ],
          temperature: 0.2,
          max_tokens: 800
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }

      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content;

      const result = {
        symbol,
        analysis: content || 'No analysis available',
        timestamp: new Date().toISOString(),
        source: 'Perplexity AI'
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('Perplexity asset analysis error:', error);
      throw error;
    }
  }

  /**
   * Get sector analysis
   */
  async getSectorAnalysis(sector: string): Promise<any> {
    const cacheKey = `sector:${sector}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      logger.info(`Perplexity sector analysis: ${sector}`);

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: 'You are a sector analyst. Provide analysis on the sector including: performance trends, key players, recent developments, catalysts, risks, and outlook. Include specific data points and comparisons.'
            },
            {
              role: 'user',
              content: `Analyze the ${sector} sector. Today: ${new Date().toISOString().split('T')[0]}. What are the key trends, top performers/laggards, and market drivers?`
            }
          ],
          temperature: 0.2,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }

      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content;

      const result = {
        sector,
        analysis: content || 'No analysis available',
        timestamp: new Date().toISOString(),
        source: 'Perplexity AI'
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('Perplexity sector analysis error:', error);
      throw error;
    }
  }

  /**
   * Get geopolitical context for market events
   */
  async getGeopoliticalContext(event: string): Promise<any> {
    const cacheKey = `geopolitical:${event}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      logger.info(`Perplexity geopolitical context: ${event}`);

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [
            {
              role: 'system',
              content: 'You are a geopolitical analyst focused on market implications. Provide context on how geopolitical events affect markets: equities, crypto, commodities, FX. Include historical precedents where relevant.'
            },
            {
              role: 'user',
              content: `Analyze the market implications of: ${event}. Today: ${new Date().toISOString().split('T')[0]}. How are markets reacting? What are the risks and opportunities?`
            }
          ],
          temperature: 0.3,
          max_tokens: 1200
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }

      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content;

      const result = {
        event,
        context: content || 'No context available',
        timestamp: new Date().toISOString(),
        source: 'Perplexity AI'
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('Perplexity geopolitical context error:', error);
      throw error;
    }
  }

  /**
   * Get earnings analysis
   */
  async getEarningsAnalysis(company: string): Promise<any> {
    const cacheKey = `earnings:${company}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      logger.info(`Perplexity earnings analysis: ${company}`);

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: 'You are an earnings analyst. Provide concise analysis of latest earnings: beat/miss, key metrics, guidance, management commentary, and market reaction. Include specific numbers.'
            },
            {
              role: 'user',
              content: `Analyze latest earnings for ${company}. Today: ${new Date().toISOString().split('T')[0]}. What were the key takeaways and how did the market react?`
            }
          ],
          temperature: 0.2,
          max_tokens: 800
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }

      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content;

      const result = {
        company,
        analysis: content || 'No earnings data available',
        timestamp: new Date().toISOString(),
        source: 'Perplexity AI'
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('Perplexity earnings analysis error:', error);
      throw error;
    }
  }

  /**
   * Get from cache if not expired
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    logger.info(`Cache hit: ${key} (age: ${Math.floor(age / 1000)}s)`);
    return cached.data;
  }

  /**
   * Set cache
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Perplexity cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}
