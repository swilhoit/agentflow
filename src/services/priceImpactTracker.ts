import YahooFinanceClass from 'yahoo-finance2';
import { getSQLiteDatabase } from './databaseFactory';
import { logger } from '../utils/logger';
import { DatabaseService } from './database';

const yahooFinance = new YahooFinanceClass();

export interface PriceImpact {
  id?: number;
  articleId: number;
  symbol: string;
  newsTime: Date;
  priceBeforeNews: number;
  priceAfter5Min?: number;
  priceAfter15Min?: number;
  priceAfter30Min?: number;
  priceAfter1Hour?: number;
  priceAfter1Day?: number;
  volumeBeforeNews?: number;
  volumeAfter?: number;
  volumeSpike?: number; // Percentage increase
  impactScore?: number; // Overall impact percentage
  createdAt: Date;
  lastUpdatedAt: Date;
}

/**
 * Tracks price impact of news events
 *
 * Monitors stock price before and after significant news events to measure
 * market reaction and news impact on stock performance.
 */
export class PriceImpactTracker {
  private db: DatabaseService;
  private trackingIntervals: Map<number, NodeJS.Timeout[]> = new Map();

  constructor() {
    this.db = getSQLiteDatabase();
    this.initializeDatabase();
  }

  /**
   * Initialize price impact tracking table
   */
  private initializeDatabase(): void {
    try {
      // SQLite schema
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS news_price_impact (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          article_id INTEGER NOT NULL,
          symbol TEXT NOT NULL,
          news_time DATETIME NOT NULL,
          price_before_news REAL NOT NULL,
          price_after_5min REAL,
          price_after_15min REAL,
          price_after_30min REAL,
          price_after_1hour REAL,
          price_after_1day REAL,
          volume_before_news INTEGER,
          volume_after INTEGER,
          volume_spike REAL,
          impact_score REAL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (article_id) REFERENCES market_news(article_id)
        )
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_price_impact_article
        ON news_price_impact(article_id)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_price_impact_symbol_time
        ON news_price_impact(symbol, news_time DESC)
      `);

      logger.info('📈 Price impact tracking database initialized');
    } catch (error) {
      logger.error('Error initializing price impact database:', error);
    }
  }

  /**
   * Start tracking price impact for a news event
   */
  async startTracking(
    articleId: number,
    symbol: string,
    newsTime: Date,
    onUpdate?: (impactId: number, symbol: string, interval: string) => Promise<void>
  ): Promise<void> {
    try {
      logger.info(`📈 Starting price impact tracking for ${symbol} (article ${articleId})`);

      // Get current price as "before news" price
      const currentPrice = await this.getCurrentPrice(symbol);
      if (!currentPrice) {
        logger.warn(`Could not get current price for ${symbol}, skipping tracking`);
        return;
      }

      // Get current volume
      const currentVolume = await this.getCurrentVolume(symbol);

      // Save initial record
      const impactId = await this.saveInitialImpact({
        articleId,
        symbol,
        newsTime,
        priceBeforeNews: currentPrice,
        volumeBeforeNews: currentVolume ?? undefined,
        createdAt: new Date(),
        lastUpdatedAt: new Date()
      });

      if (!impactId) {
        logger.warn(`Failed to save initial impact record for ${symbol}`);
        return;
      }

      // Schedule price checks
      const intervals: NodeJS.Timeout[] = [];

      // Check after 5 minutes
      intervals.push(setTimeout(() => this.updatePriceImpact(impactId, symbol, '5min', onUpdate), 5 * 60 * 1000));

      // Check after 15 minutes
      intervals.push(setTimeout(() => this.updatePriceImpact(impactId, symbol, '15min', onUpdate), 15 * 60 * 1000));

      // Check after 30 minutes
      intervals.push(setTimeout(() => this.updatePriceImpact(impactId, symbol, '30min', onUpdate), 30 * 60 * 1000));

      // Check after 1 hour
      intervals.push(setTimeout(() => this.updatePriceImpact(impactId, symbol, '1hour', onUpdate), 60 * 60 * 1000));

      // Check after 1 day
      intervals.push(setTimeout(() => this.updatePriceImpact(impactId, symbol, '1day', onUpdate), 24 * 60 * 60 * 1000));

      // Store intervals for cleanup
      this.trackingIntervals.set(impactId, intervals);

      logger.info(`✅ Price impact tracking scheduled for ${symbol}`);
    } catch (error) {
      logger.error(`Error starting price impact tracking for ${symbol}:`, error);
    }
  }

  /**
   * Update price impact at a specific interval
   */
  private async updatePriceImpact(
    impactId: number,
    symbol: string,
    interval: string,
    onUpdate?: (impactId: number, symbol: string, interval: string) => Promise<void>
  ): Promise<void> {
    try {
      const price = await this.getCurrentPrice(symbol);
      if (!price) {
        logger.warn(`Could not get price for ${symbol} at ${interval}`);
        return;
      }

      const volume = await this.getCurrentVolume(symbol);

      // Get the original record
      const impact = await this.getPriceImpact(impactId);
      if (!impact) {
        logger.warn(`Price impact record ${impactId} not found`);
        return;
      }

      // Calculate impact score
      const impactScore = ((price - impact.priceBeforeNews) / impact.priceBeforeNews) * 100;

      // Calculate volume spike if we have before/after volume
      let volumeSpike: number | undefined;
      if (impact.volumeBeforeNews && volume) {
        volumeSpike = ((volume - impact.volumeBeforeNews) / impact.volumeBeforeNews) * 100;
      }

      // Update the specific interval
      const updates: any = {
        last_updated_at: new Date().toISOString()
      };

      switch (interval) {
        case '5min':
          updates.price_after_5min = price;
          break;
        case '15min':
          updates.price_after_15min = price;
          break;
        case '30min':
          updates.price_after_30min = price;
          break;
        case '1hour':
          updates.price_after_1hour = price;
          updates.volume_after = volume;
          updates.volume_spike = volumeSpike;
          break;
        case '1day':
          updates.price_after_1day = price;
          updates.impact_score = impactScore;
          break;
      }

      await this.updatePriceImpactRecord(impactId, updates);

      logger.info(`📊 Updated ${symbol} price impact at ${interval}: ${impactScore.toFixed(2)}%`);

      // Call the update callback if provided (for Discord notifications)
      if (onUpdate) {
        try {
          await onUpdate(impactId, symbol, interval);
        } catch (error) {
          logger.error(`Error in price impact update callback for ${symbol}:`, error);
        }
      }

      // Clean up interval reference if this was the last one
      if (interval === '1day') {
        const intervals = this.trackingIntervals.get(impactId);
        if (intervals) {
          intervals.forEach(clearTimeout);
          this.trackingIntervals.delete(impactId);
        }
      }
    } catch (error) {
      logger.error(`Error updating price impact for ${symbol} at ${interval}:`, error);
    }
  }

  /**
   * Get current price from Yahoo Finance
   */
  private async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const quote = await yahooFinance.quote(symbol);
      return quote.regularMarketPrice || null;
    } catch (error) {
      logger.error(`Error fetching price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get current volume from Yahoo Finance
   */
  private async getCurrentVolume(symbol: string): Promise<number | null> {
    try {
      const quote = await yahooFinance.quote(symbol);
      return quote.regularMarketVolume || null;
    } catch (error) {
      logger.error(`Error fetching volume for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Save initial price impact record
   */
  private async saveInitialImpact(impact: PriceImpact): Promise<number | null> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO news_price_impact (
          article_id, symbol, news_time, price_before_news,
          volume_before_news, created_at, last_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        impact.articleId,
        impact.symbol,
        impact.newsTime.toISOString(),
        impact.priceBeforeNews,
        impact.volumeBeforeNews || null,
        impact.createdAt.toISOString(),
        impact.lastUpdatedAt.toISOString()
      );

      return result.lastInsertRowid as number || null;
    } catch (error) {
      logger.error('Error saving initial price impact:', error);
      return null;
    }
  }

  /**
   * Get price impact record by ID
   */
  private async getPriceImpact(impactId: number): Promise<PriceImpact | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM news_price_impact WHERE id = ?
      `);

      const row = stmt.get(impactId) as any;
      if (!row) return null;

      return {
        id: row.id,
        articleId: row.article_id,
        symbol: row.symbol,
        newsTime: new Date(row.news_time),
        priceBeforeNews: row.price_before_news,
        priceAfter5Min: row.price_after_5min,
        priceAfter15Min: row.price_after_15min,
        priceAfter30Min: row.price_after_30min,
        priceAfter1Hour: row.price_after_1hour,
        priceAfter1Day: row.price_after_1day,
        volumeBeforeNews: row.volume_before_news,
        volumeAfter: row.volume_after,
        volumeSpike: row.volume_spike,
        impactScore: row.impact_score,
        createdAt: new Date(row.created_at),
        lastUpdatedAt: new Date(row.last_updated_at)
      };
    } catch (error) {
      logger.error('Error getting price impact:', error);
      return null;
    }
  }

  /**
   * Update price impact record
   */
  private async updatePriceImpactRecord(impactId: number, updates: any): Promise<void> {
    try {
      const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updates);

      const stmt = this.db.prepare(`
        UPDATE news_price_impact SET ${setClause} WHERE id = ?
      `);

      stmt.run(...values, impactId);
    } catch (error) {
      logger.error('Error updating price impact record:', error);
    }
  }

  /**
   * Get price impact for a news article
   */
  async getImpactForArticle(articleId: number): Promise<PriceImpact | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM news_price_impact WHERE article_id = ?
      `);

      const row = stmt.get(articleId) as any;
      if (!row) return null;

      return {
        id: row.id,
        articleId: row.article_id,
        symbol: row.symbol,
        newsTime: new Date(row.news_time),
        priceBeforeNews: row.price_before_news,
        priceAfter5Min: row.price_after_5min,
        priceAfter15Min: row.price_after_15min,
        priceAfter30Min: row.price_after_30min,
        priceAfter1Hour: row.price_after_1hour,
        priceAfter1Day: row.price_after_1day,
        volumeBeforeNews: row.volume_before_news,
        volumeAfter: row.volume_after,
        volumeSpike: row.volume_spike,
        impactScore: row.impact_score,
        createdAt: new Date(row.created_at),
        lastUpdatedAt: new Date(row.last_updated_at)
      };
    } catch (error) {
      logger.error('Error getting impact for article:', error);
      return null;
    }
  }

  /**
   * Format price impact for display
   */
  formatImpact(impact: PriceImpact): string {
    const lines: string[] = [];
    lines.push(`**Price Impact Analysis for ${impact.symbol}**\n`);
    lines.push(`📍 Price before news: $${impact.priceBeforeNews.toFixed(2)}\n`);

    if (impact.priceAfter5Min) {
      const change = ((impact.priceAfter5Min - impact.priceBeforeNews) / impact.priceBeforeNews) * 100;
      const emoji = change >= 0 ? '📈' : '📉';
      lines.push(`${emoji} After 5 min: $${impact.priceAfter5Min.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`);
    }

    if (impact.priceAfter15Min) {
      const change = ((impact.priceAfter15Min - impact.priceBeforeNews) / impact.priceBeforeNews) * 100;
      const emoji = change >= 0 ? '📈' : '📉';
      lines.push(`${emoji} After 15 min: $${impact.priceAfter15Min.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`);
    }

    if (impact.priceAfter1Hour) {
      const change = ((impact.priceAfter1Hour - impact.priceBeforeNews) / impact.priceBeforeNews) * 100;
      const emoji = change >= 0 ? '📈' : '📉';
      lines.push(`${emoji} After 1 hour: $${impact.priceAfter1Hour.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`);

      if (impact.volumeSpike) {
        lines.push(`\n📊 Volume spike: ${impact.volumeSpike >= 0 ? '+' : ''}${impact.volumeSpike.toFixed(0)}%`);
      }
    }

    if (impact.priceAfter1Day) {
      const change = ((impact.priceAfter1Day - impact.priceBeforeNews) / impact.priceBeforeNews) * 100;
      const emoji = change >= 0 ? '📈' : '📉';
      lines.push(`\n${emoji} After 1 day: $${impact.priceAfter1Day.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`);
      lines.push(`**Total Impact Score: ${impact.impactScore?.toFixed(2)}%**`);
    }

    return lines.join('\n');
  }

  /**
   * Cleanup tracking intervals
   */
  cleanup(): void {
    for (const intervals of this.trackingIntervals.values()) {
      intervals.forEach(clearTimeout);
    }
    this.trackingIntervals.clear();
  }
}
