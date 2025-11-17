import { Client, Pool } from 'pg';
import { Connector } from '@google-cloud/cloud-sql-connector';
import { logger } from '../utils/logger';

/**
 * Cloud SQL (PostgreSQL) Database Service
 * This is an alternative to the SQLite database for cloud deployment
 */
export class CloudDatabaseService {
  private pool: Pool;
  private connector: Connector;

  constructor(config: {
    instanceConnectionName: string;
    database: string;
    user: string;
    password: string;
  }) {
    this.connector = new Connector();
    this.pool = this.initializePool(config);
  }

  private initializePool(config: {
    instanceConnectionName: string;
    database: string;
    user: string;
    password: string;
  }): Pool {
    // Create a connection pool with Cloud SQL Connector
    const pool = new Pool({
      max: 5,
      user: config.user,
      password: config.password,
      database: config.database,
      // Cloud SQL Connector will handle connection via Unix socket or TCP
    });

    // Use Cloud SQL connector for connection
    pool.on('connect', async (client) => {
      logger.debug('New Cloud SQL connection established');
    });

    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });

    logger.info(`Cloud SQL connection pool initialized for ${config.database}`);

    return pool;
  }

  /**
   * Get a client for Cloud SQL with proper connector setup
   */
  async getClient(): Promise<Client> {
    const clientOpts = await this.connector.getOptions({
      instanceConnectionName: process.env.CLOUDSQL_INSTANCE_CONNECTION_NAME!,
      ipType: 'PUBLIC' as any,
    });

    const client = new Client({
      ...clientOpts,
      user: process.env.CLOUDSQL_USER!,
      password: process.env.CLOUDSQL_PASSWORD!,
      database: process.env.CLOUDSQL_DATABASE!,
    });

    await client.connect();
    return client;
  }

  /**
   * Execute a query
   */
  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.getClient();
    try {
      const result = await client.query(text, params);
      return result.rows;
    } finally {
      await client.end();
    }
  }

  /**
   * Save market data
   */
  async saveMarketData(data: {
    symbol: string;
    name: string;
    price: number;
    changeAmount: number;
    changePercent: number;
    volume?: number;
    marketCap?: number;
    performance30d?: number;
    performance90d?: number;
    performance365d?: number;
    date: string;
  }): Promise<number> {
    const result = await this.query(
      `INSERT INTO market_data
       (symbol, name, price, change_amount, change_percent, volume, market_cap,
        performance_30d, performance_90d, performance_365d, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        data.symbol,
        data.name,
        data.price,
        data.changeAmount,
        data.changePercent,
        data.volume,
        data.marketCap,
        data.performance30d,
        data.performance90d,
        data.performance365d,
        data.date,
      ]
    );

    return result[0].id;
  }

  /**
   * Save market news
   */
  async saveMarketNews(news: {
    articleId: number;
    symbol: string;
    headline: string;
    summary: string;
    source: string;
    url: string;
    publishedAt: Date;
    category?: string;
    sentiment?: string;
    isSignificant?: boolean;
  }): Promise<number> {
    try {
      const result = await this.query(
        `INSERT INTO market_news
         (article_id, symbol, headline, summary, source, url, published_at,
          category, sentiment, is_significant)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (article_id) DO NOTHING
         RETURNING id`,
        [
          news.articleId,
          news.symbol,
          news.headline,
          news.summary,
          news.source,
          news.url,
          news.publishedAt,
          news.category,
          news.sentiment,
          news.isSignificant || false,
        ]
      );

      return result.length > 0 ? result[0].id : 0;
    } catch (error) {
      logger.warn(`Failed to save news article ${news.articleId}:`, error);
      return 0;
    }
  }

  /**
   * Save weekly analysis
   */
  async saveWeeklyAnalysis(analysis: {
    weekStart: string;
    weekEnd: string;
    analysisType: 'thesis' | 'performance' | 'news';
    title: string;
    summary: string;
    detailedAnalysis: string;
    keyEvents?: string;
    recommendations?: string;
    metadata?: string;
  }): Promise<number> {
    const result = await this.query(
      `INSERT INTO weekly_analysis
       (week_start, week_end, analysis_type, title, summary, detailed_analysis,
        key_events, recommendations, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        analysis.weekStart,
        analysis.weekEnd,
        analysis.analysisType,
        analysis.title,
        analysis.summary,
        analysis.detailedAnalysis,
        analysis.keyEvents,
        analysis.recommendations,
        analysis.metadata,
      ]
    );

    return result[0].id;
  }

  /**
   * Get market data by date range
   */
  async getMarketDataByDateRange(startDate: string, endDate: string): Promise<any[]> {
    return await this.query(
      `SELECT * FROM market_data
       WHERE date BETWEEN $1 AND $2
       ORDER BY date ASC, symbol ASC`,
      [startDate, endDate]
    );
  }

  /**
   * Get market news by date range
   */
  async getMarketNewsByDateRange(startDate: string, endDate: string): Promise<any[]> {
    return await this.query(
      `SELECT * FROM market_news
       WHERE DATE(published_at) BETWEEN $1 AND $2
       ORDER BY published_at DESC`,
      [startDate, endDate]
    );
  }

  /**
   * Get latest weekly analysis
   */
  async getLatestWeeklyAnalysis(analysisType?: 'thesis' | 'performance' | 'news'): Promise<any | null> {
    const query = analysisType
      ? `SELECT * FROM weekly_analysis
         WHERE analysis_type = $1
         ORDER BY week_start DESC
         LIMIT 1`
      : `SELECT * FROM weekly_analysis
         ORDER BY week_start DESC
         LIMIT 1`;

    const result = analysisType
      ? await this.query(query, [analysisType])
      : await this.query(query);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
    this.connector.close();
    logger.info('Cloud SQL connection closed');
  }
}

// Singleton instance
let cloudDbInstance: CloudDatabaseService | null = null;

export function getCloudDatabase(): CloudDatabaseService {
  if (!cloudDbInstance) {
    const config = {
      instanceConnectionName: process.env.CLOUDSQL_INSTANCE_CONNECTION_NAME!,
      database: process.env.CLOUDSQL_DATABASE!,
      user: process.env.CLOUDSQL_USER!,
      password: process.env.CLOUDSQL_PASSWORD!,
    };

    cloudDbInstance = new CloudDatabaseService(config);
  }

  return cloudDbInstance;
}
