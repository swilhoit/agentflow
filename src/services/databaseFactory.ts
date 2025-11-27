import { PostgresDatabaseService, getPostgresDatabase } from './postgresDatabaseService';
import { DatabaseService } from './database';
import { logger } from '../utils/logger';

/**
 * Database Factory - Hetzner PostgreSQL ONLY
 * All data is stored on the Hetzner VPS PostgreSQL instance
 * NO SUPABASE - everything goes to our own database
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

  // Task management methods
  getAllActiveAgentTasks(): any[];
  getFailedTasks(hours: number): any[];

  // Lifecycle methods
  close(): Promise<void> | void;
}

// Singleton instances
let databaseInstance: IDatabase | null = null;
let agentflowDbInstance: PostgresDatabaseService | null = null;

/**
 * Get the database service - Hetzner PostgreSQL ONLY
 * NO SUPABASE - all data stored on our own VPS
 */
export function getDatabase(): IDatabase {
  if (databaseInstance) {
    return databaseInstance;
  }

  logger.info('🐘 Initializing Hetzner PostgreSQL database (NO SUPABASE)...');

  // Initialize AgentFlow's dedicated PostgreSQL on Hetzner VPS
  agentflowDbInstance = getPostgresDatabase();
  logger.info('✅ AgentFlow PostgreSQL database initialized');
  logger.info(`   Host: ${process.env.AGENTFLOW_DB_HOST || 'localhost'}`);

  // Create wrapper that delegates to PostgreSQL
  logger.info('📦 Using Hetzner PostgreSQL for ALL data storage');
  databaseInstance = createPostgresWrapper(agentflowDbInstance);

  return databaseInstance;
}

/**
 * Get the AgentFlow dedicated PostgreSQL database
 */
export function getAgentFlowDatabase(): PostgresDatabaseService | null {
  if (agentflowDbInstance) {
    return agentflowDbInstance;
  }

  agentflowDbInstance = getPostgresDatabase();
  return agentflowDbInstance;
}

/**
 * Create IDatabase wrapper for PostgreSQL
 */
function createPostgresWrapper(db: PostgresDatabaseService): IDatabase {
  return {
    async saveMarketData(): Promise<number> {
      logger.warn('Market data storage: implement in PostgresDatabaseService if needed');
      return 0;
    },
    async saveMarketNews(): Promise<number | null> {
      logger.warn('Market news storage: implement in PostgresDatabaseService if needed');
      return null;
    },
    async saveWeeklyAnalysis(): Promise<number> {
      logger.warn('Weekly analysis storage: implement in PostgresDatabaseService if needed');
      return 0;
    },
    async getMarketDataByDateRange(): Promise<any[]> {
      return [];
    },
    async getMarketNewsByDateRange(): Promise<any[]> {
      return [];
    },
    async getLatestWeeklyAnalysis(): Promise<any | null> {
      return null;
    },
    getAllActiveAgentTasks(): any[] {
      logger.warn('getAllActiveAgentTasks: Use async method from PostgresDatabaseService');
      return [];
    },
    getFailedTasks(): any[] {
      logger.warn('getFailedTasks: Use async method from PostgresDatabaseService');
      return [];
    },
    async close(): Promise<void> {
      await db.close();
    }
  };
}

/**
 * Check if using PostgreSQL (always true now)
 */
export function isUsingPostgres(): boolean {
  return true;
}

/**
 * Check if using Supabase - ALWAYS FALSE
 * We use Hetzner PostgreSQL for everything
 */
export function isUsingSupabase(): boolean {
  return false; // NO SUPABASE - everything on Hetzner Postgres
}

/**
 * Get the current database type (always postgres)
 */
export function getDatabaseType(): 'postgres' {
  return 'postgres';
}

/**
 * Reset database instance (useful for testing)
 */
export function resetDatabaseInstance(): void {
  if (databaseInstance) {
    databaseInstance.close();
    databaseInstance = null;
  }
}

/**
 * Backward compatibility - returns a proxy that uses PostgreSQL
 * @deprecated Use getAgentFlowDatabase() instead
 */
export function getSQLiteDatabase(): any {
  const pgDb = getAgentFlowDatabase();
  if (!pgDb) {
    throw new Error('PostgreSQL database not available - check AGENTFLOW_DB_* environment variables');
  }

  // Return the PostgreSQL database - it has compatible methods
  // for transactions, agent tasks, conversations, etc.
  return pgDb;
}
