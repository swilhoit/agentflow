import { DatabaseService } from './database';
import { CloudDatabaseService } from './cloudDatabase';
import { SupabaseDatabaseService } from './supabaseDatabase';
import { UnifiedDatabaseService, getUnifiedDatabase } from './unifiedDatabase';
import { PostgresDatabaseService, getPostgresDatabase } from './postgresDatabaseService';
import { logger } from '../utils/logger';

/**
 * Database Factory - Returns the appropriate database service based on configuration
 * Supports: Postgres (self-hosted), Supabase, SQLite (local dev), Cloud SQL (legacy)
 */

// Track which database type is in use
let currentDatabaseType: 'postgres' | 'supabase' | 'sqlite' | 'cloudsql' = 'supabase';

// AgentFlow's dedicated PostgreSQL instance (for logging, tasks, etc.)
let agentflowDbInstance: PostgresDatabaseService | null = null;

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

  getAllActiveAgentTasks(): any[] {
    return this.db.getAllActiveAgentTasks();
  }

  getFailedTasks(hours: number): any[] {
    return this.db.getFailedTasks(hours);
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
 * Default is now 'supabase' for unified cloud operation
 */
export function getDatabase(): IDatabase {
  if (databaseInstance) {
    return databaseInstance;
  }

  // Default to postgres for self-hosted AgentFlow database
  const databaseType = process.env.DATABASE_TYPE || 'supabase';
  currentDatabaseType = databaseType as 'postgres' | 'supabase' | 'sqlite' | 'cloudsql';

  if (databaseType === 'postgres') {
    // Self-hosted PostgreSQL on Hetzner VPS
    logger.info('🐘 Initializing self-hosted PostgreSQL database...');
    
    // For market data, we still use Supabase (personal-finance shared db)
    // But AgentFlow logging/tasks use local PostgreSQL
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && supabaseServiceKey) {
      // Use Supabase for market data but initialize AgentFlow DB separately
      databaseInstance = new SupabaseDatabaseService({
        url: supabaseUrl,
        serviceRoleKey: supabaseServiceKey,
      });
      logger.info('✅ Market data database (Supabase) initialized');
    }
    
    // Initialize AgentFlow's dedicated PostgreSQL
    agentflowDbInstance = getPostgresDatabase();
    logger.info('✅ AgentFlow PostgreSQL database initialized');
    logger.info(`   Host: ${process.env.AGENTFLOW_DB_HOST || 'localhost'}`);
    
    // If no Supabase, use a minimal wrapper
    if (!databaseInstance) {
      logger.warn('⚠️ No Supabase configured - market data features limited');
      // Create a minimal database wrapper that delegates to PostgreSQL
      databaseInstance = createPostgresWrapper(agentflowDbInstance);
    }
  } else if (databaseType === 'supabase') {
    // Check if Supabase credentials are configured
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      logger.error('❌ Supabase credentials not configured!');
      logger.error('   Required environment variables:');
      logger.error('   - SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)');
      logger.error('   - SUPABASE_SERVICE_ROLE_KEY');
      logger.error('');
      logger.error('   Set DATABASE_TYPE=sqlite for local development without cloud');
      throw new Error('Supabase credentials not configured. Set DATABASE_TYPE=sqlite for local development.');
    }

    logger.info('☁️  Initializing Supabase (PostgreSQL) database...');
    databaseInstance = new SupabaseDatabaseService({
      url: supabaseUrl,
      serviceRoleKey: supabaseServiceKey,
    });
    logger.info('✅ Supabase database initialized');
    logger.info(`   URL: ${supabaseUrl}`);
  } else if (databaseType === 'cloudsql') {
    // Legacy Cloud SQL support
    if (!process.env.CLOUDSQL_INSTANCE_CONNECTION_NAME ||
        !process.env.CLOUDSQL_DATABASE ||
        !process.env.CLOUDSQL_USER ||
        !process.env.CLOUDSQL_PASSWORD) {
      logger.error('❌ Cloud SQL credentials not configured!');
      throw new Error('Cloud SQL credentials not configured.');
    }

    logger.warn('⚠️  Using Cloud SQL (legacy) - consider migrating to Supabase');
    const config = {
      instanceConnectionName: process.env.CLOUDSQL_INSTANCE_CONNECTION_NAME,
      database: process.env.CLOUDSQL_DATABASE,
      user: process.env.CLOUDSQL_USER,
      password: process.env.CLOUDSQL_PASSWORD,
    };

    databaseInstance = new CloudDatabaseService(config);
    logger.info('✅ Cloud SQL database initialized');
  } else if (databaseType === 'sqlite') {
    logger.warn('⚠️  Using SQLite database (local development mode)');
    const sqliteDb = new DatabaseService();
    databaseInstance = new SQLiteDatabaseWrapper(sqliteDb);
    logger.info('✅ SQLite database initialized');
  } else {
    throw new Error(`Unknown DATABASE_TYPE: ${databaseType}. Valid options: 'postgres', 'supabase', 'cloudsql', 'sqlite'`);
  }

  return databaseInstance;
}

/**
 * Get the AgentFlow dedicated PostgreSQL database (for logging, tasks, etc.)
 * This is separate from the market data database (Supabase)
 */
export function getAgentFlowDatabase(): PostgresDatabaseService | null {
  if (agentflowDbInstance) {
    return agentflowDbInstance;
  }
  
  // Auto-initialize if DATABASE_TYPE is postgres
  if (process.env.DATABASE_TYPE === 'postgres') {
    agentflowDbInstance = getPostgresDatabase();
    return agentflowDbInstance;
  }
  
  return null;
}

/**
 * Create a minimal IDatabase wrapper for PostgreSQL
 */
function createPostgresWrapper(db: PostgresDatabaseService): IDatabase {
  return {
    async saveMarketData(): Promise<number> {
      logger.warn('Market data storage not available (no Supabase)');
      return 0;
    },
    async saveMarketNews(): Promise<number | null> {
      logger.warn('Market news storage not available (no Supabase)');
      return null;
    },
    async saveWeeklyAnalysis(): Promise<number> {
      logger.warn('Weekly analysis storage not available (no Supabase)');
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
      // This will be async but we return empty for sync interface
      logger.warn('getAllActiveAgentTasks: Use async getActiveAgentTasksAsync instead');
      return [];
    },
    getFailedTasks(): any[] {
      logger.warn('getFailedTasks: Use async getFailedTasksAsync instead');
      return [];
    },
    async close(): Promise<void> {
      await db.close();
    }
  };
}

/**
 * Check if we're using Supabase
 */
export function isUsingSupabase(): boolean {
  return currentDatabaseType === 'supabase';
}

/**
 * Check if we're using self-hosted PostgreSQL
 */
export function isUsingPostgres(): boolean {
  return currentDatabaseType === 'postgres';
}

/**
 * Get the current database type
 */
export function getDatabaseType(): 'postgres' | 'supabase' | 'sqlite' | 'cloudsql' {
  return currentDatabaseType;
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
