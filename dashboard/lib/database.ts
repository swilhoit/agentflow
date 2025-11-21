import Database from 'better-sqlite3';
import path from 'path';

// Connect to the existing AgentFlow database
const dbPath = path.join(process.cwd(), '..', 'data', 'agentflow.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(dbPath, { readonly: false });
    db.pragma('journal_mode = WAL'); // Better performance
  }
  return db;
}

// Types matching your existing database schema
export interface FinancialTransaction {
  id?: number;
  transaction_id: string;
  account_id: string;
  account_name?: string;
  account_type?: string;
  institution?: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category?: string;
  merchant?: string;
  details?: string;
  synced_at?: string;
  metadata?: string;
}

export interface DailyGoal {
  id?: number;
  guild_id: string;
  user_id: string;
  username: string;
  date: string;
  goals: string;
  timestamp: string;
  metadata?: string;
}

export interface AgentTask {
  id?: number;
  agent_id: string;
  guild_id: string;
  channel_id: string;
  user_id: string;
  task_description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  result?: string;
  error?: string;
}

export interface MarketData {
  id?: number;
  symbol: string;
  name: string;
  price: number;
  change_amount: number;
  change_percent: number;
  volume?: number;
  market_cap?: number;
  performance_30d?: number;
  performance_90d?: number;
  performance_365d?: number;
  timestamp: string;
  date: string;
}

// Query functions using existing database
export const db_queries = {
  // Financial queries
  getRecentTransactions: (limit: number = 50) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM financial_transactions
      ORDER BY date DESC, id DESC
      LIMIT ?
    `);
    return stmt.all(limit) as FinancialTransaction[];
  },

  getTransactionsByDateRange: (startDate: string, endDate: string) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM financial_transactions
      WHERE date BETWEEN ? AND ?
      ORDER BY date DESC
    `);
    return stmt.all(startDate, endDate) as FinancialTransaction[];
  },

  getSpendingSummary: (startDate: string, endDate: string) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT
        category,
        COUNT(*) as transaction_count,
        SUM(ABS(amount)) as total_spent,
        AVG(ABS(amount)) as avg_amount
      FROM financial_transactions
      WHERE date BETWEEN ? AND ? AND amount < 0
      GROUP BY category
      ORDER BY total_spent DESC
    `);
    return stmt.all(startDate, endDate);
  },

  getIncomeSummary: (startDate: string, endDate: string) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT
        SUM(amount) as total_income,
        COUNT(*) as transaction_count,
        AVG(amount) as avg_amount
      FROM financial_transactions
      WHERE date BETWEEN ? AND ? AND amount > 0
    `);
    return stmt.get(startDate, endDate);
  },

  getIncomeBySource: (startDate: string, endDate: string) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT
        description,
        SUM(amount) as total,
        COUNT(*) as count
      FROM financial_transactions
      WHERE date BETWEEN ? AND ? AND amount > 0
      GROUP BY description
      ORDER BY total DESC
    `);
    return stmt.all(startDate, endDate);
  },

  // Goals queries
  getDailyGoals: (userId: string, limit: number = 30) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM daily_goals
      WHERE user_id = ?
      ORDER BY date DESC
      LIMIT ?
    `);
    return stmt.all(userId, limit) as DailyGoal[];
  },

  getTodaysGoal: (userId: string, date: string) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM daily_goals
      WHERE user_id = ? AND date = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    return stmt.get(userId, date) as DailyGoal | undefined;
  },

  // Agent queries
  getActiveAgentTasks: () => {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM agent_tasks
      WHERE status IN ('pending', 'running')
      ORDER BY started_at DESC
    `);
    return stmt.all() as AgentTask[];
  },

  getRecentAgentTasks: (limit: number = 10) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM agent_tasks
      ORDER BY started_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as AgentTask[];
  },

  // Market queries
  getLatestMarketData: () => {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM market_data
      WHERE date = (SELECT MAX(date) FROM market_data)
      ORDER BY symbol
    `);
    return stmt.all() as MarketData[];
  },

  getMarketDataBySymbol: (symbol: string, days: number = 30) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM market_data
      WHERE symbol = ? AND date >= date('now', '-' || ? || ' days')
      ORDER BY date ASC
    `);
    return stmt.all(symbol, days) as MarketData[];
  },
};

export default getDatabase;
