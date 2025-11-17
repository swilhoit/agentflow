import { DatabaseService } from './database';
import { CloudDatabaseService } from './cloudDatabase';
import { logger } from '../utils/logger';

/**
 * Database Factory - Returns the appropriate database service based on configuration
 * Supports hybrid mode: SQLite for local development, Cloud SQL for production
 */

export interface IDatabase {
  // Market data methods
  saveMarketData(data: {
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
  }): Promise<number> | number;

  // Market news methods
  saveMarketNews(news: {
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
  }): Promise<number | null> | number | null;

  // Weekly analysis methods
  saveWeeklyAnalysis(analysis: {
    weekStart: string;
    weekEnd: string;
    analysisType: 'thesis' | 'performance' | 'news';
    title: string;
    summary: string;
    detailedAnalysis: string;
    keyEvents?: string;
    recommendations?: string;
    metadata?: string;
  }): Promise<number> | number;

  // Query methods
  getMarketDataByDateRange(startDate: string, endDate: string): Promise<any[]> | any[];
  getMarketNewsByDateRange(startDate: string, endDate: string): Promise<any[]> | any[];
  getLatestWeeklyAnalysis(analysisType?: 'thesis' | 'performance' | 'news'): Promise<any | null> | any | null;

  // Lifecycle methods
  close(): Promise<void> | void;
}

/**
 * Wrapper for SQLite database to match async interface
 */
class SQLiteDatabaseWrapper implements IDatabase {
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  async saveMarketData(data: any): Promise<number> {
    return this.db.saveMarketData(data);
  }

  async saveMarketNews(news: any): Promise<number | null> {
    return this.db.saveMarketNews(news);
  }

  async saveWeeklyAnalysis(analysis: any): Promise<number> {
    return this.db.saveWeeklyAnalysis(analysis);
  }

  async getMarketDataByDateRange(startDate: string, endDate: string): Promise<any[]> {
    return this.db.getMarketDataByDateRange(startDate, endDate);
  }

  async getMarketNewsByDateRange(startDate: string, endDate: string): Promise<any[]> {
    return this.db.getMarketNewsByDateRange(startDate, endDate);
  }

  async getLatestWeeklyAnalysis(analysisType?: 'thesis' | 'performance' | 'news'): Promise<any | null> {
    const result = this.db.getLatestWeeklyAnalysis(analysisType);
    return result !== null ? result : null;
  }

  async close(): Promise<void> {
    this.db.close();
  }

  // Expose original database for methods not in interface
  getOriginal(): DatabaseService {
    return this.db;
  }
}

/**
 * Singleton instances
 */
let databaseInstance: IDatabase | null = null;

/**
 * Get the appropriate database service based on DATABASE_TYPE environment variable
 */
export function getDatabase(): IDatabase {
  if (databaseInstance) {
    return databaseInstance;
  }

  const databaseType = process.env.DATABASE_TYPE || 'sqlite';

  if (databaseType === 'cloudsql') {
    // Check if Cloud SQL credentials are configured
    if (!process.env.CLOUDSQL_INSTANCE_CONNECTION_NAME ||
        !process.env.CLOUDSQL_DATABASE ||
        !process.env.CLOUDSQL_USER ||
        !process.env.CLOUDSQL_PASSWORD) {
      logger.error('❌ DATABASE_TYPE=cloudsql but Cloud SQL credentials are not configured!');
      logger.error('   Required: CLOUDSQL_INSTANCE_CONNECTION_NAME, CLOUDSQL_DATABASE, CLOUDSQL_USER, CLOUDSQL_PASSWORD');
      logger.error('   Falling back to SQLite...');

      const sqliteDb = new DatabaseService();
      databaseInstance = new SQLiteDatabaseWrapper(sqliteDb);
      logger.info('📁 Using SQLite database (fallback)');
      return databaseInstance;
    }

    logger.info('☁️  Initializing Cloud SQL (PostgreSQL) database...');
    const config = {
      instanceConnectionName: process.env.CLOUDSQL_INSTANCE_CONNECTION_NAME,
      database: process.env.CLOUDSQL_DATABASE,
      user: process.env.CLOUDSQL_USER,
      password: process.env.CLOUDSQL_PASSWORD,
    };

    databaseInstance = new CloudDatabaseService(config);
    logger.info('✅ Cloud SQL database initialized');
    logger.info(`   Instance: ${config.instanceConnectionName}`);
    logger.info(`   Database: ${config.database}`);
  } else {
    logger.info('📁 Initializing SQLite database...');
    const sqliteDb = new DatabaseService();
    databaseInstance = new SQLiteDatabaseWrapper(sqliteDb);
    logger.info('✅ SQLite database initialized');
  }

  return databaseInstance;
}

/**
 * Get SQLite database instance (for legacy code that needs direct access)
 */
export function getSQLiteDatabase(): DatabaseService {
  const db = getDatabase();
  if (db instanceof SQLiteDatabaseWrapper) {
    return (db as SQLiteDatabaseWrapper).getOriginal();
  }
  throw new Error('Current database is not SQLite - cannot get SQLite instance');
}

/**
 * Reset database instance (useful for testing or switching databases)
 */
export function resetDatabaseInstance(): void {
  if (databaseInstance) {
    databaseInstance.close();
    databaseInstance = null;
  }
}
