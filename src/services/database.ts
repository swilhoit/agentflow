import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';

export interface ConversationMessage {
  id?: number;
  guildId: string;
  channelId: string;
  userId: string;
  username: string;
  message: string;
  messageType: 'voice' | 'text' | 'agent_response';
  timestamp: Date;
  metadata?: string; // JSON string for additional data
}

export interface AgentLog {
  id?: number;
  agentId: string;
  taskId: string;
  guildId: string;
  channelId: string;
  logType: 'info' | 'warning' | 'error' | 'success' | 'step';
  message: string;
  details?: string; // JSON string
  timestamp: Date;
}

export interface AgentTask {
  id?: number;
  agentId: string;
  guildId: string;
  channelId: string;
  userId: string;
  taskDescription: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  result?: string; // JSON string
  error?: string;
}

export interface DailyGoal {
  id?: number;
  guildId: string;
  userId: string;
  username: string;
  date: string; // Format: YYYY-MM-DD
  goals: string;
  timestamp: Date;
  metadata?: string; // JSON string for additional data
}

export interface FinancialTransaction {
  id?: number;
  transactionId: string;
  accountId: string;
  accountName?: string;
  accountType?: string;
  institution?: string;
  date: string; // Format: YYYY-MM-DD
  description: string;
  amount: number;
  type: string;
  category?: string;
  merchant?: string;
  details?: string; // JSON string
  syncedAt?: Date;
  metadata?: string; // JSON string for additional data
}

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const defaultPath = path.join(process.cwd(), 'data', 'agentflow.db');

    // Ensure data directory exists
    const dataDir = path.dirname(dbPath || defaultPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      logger.info(`Created database directory: ${dataDir}`);
    }

    this.db = new Database(dbPath || defaultPath);

    logger.info(`Database initialized at: ${dbPath || defaultPath}`);

    this.initialize();
  }

  /**
   * Initialize database schema
   */
  private initialize(): void {
    // Create conversations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        message TEXT NOT NULL,
        message_type TEXT NOT NULL CHECK(message_type IN ('voice', 'text', 'agent_response')),
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT
      )
    `);

    // Create indexes for conversations
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_conversations_guild_channel_time
                   ON conversations(guild_id, channel_id, timestamp DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_conversations_user
                   ON conversations(user_id)`);

    // Create agent_logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        log_type TEXT NOT NULL CHECK(log_type IN ('info', 'warning', 'error', 'success', 'step')),
        message TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for agent_logs
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_logs_agent
                   ON agent_logs(agent_id, timestamp DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_logs_task
                   ON agent_logs(task_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_logs_guild_channel
                   ON agent_logs(guild_id, channel_id)`);

    // Create agent_tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL UNIQUE,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        task_description TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed')),
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        result TEXT,
        error TEXT
      )
    `);

    // Create indexes for agent_tasks
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent
                   ON agent_tasks(agent_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_tasks_guild_channel
                   ON agent_tasks(guild_id, channel_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_tasks_status
                   ON agent_tasks(status, started_at DESC)`);

    // Create daily_goals table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS daily_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        date TEXT NOT NULL,
        goals TEXT NOT NULL,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT
      )
    `);

    // Create indexes for daily_goals
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_goals_user_date
                   ON daily_goals(user_id, date DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_goals_guild_date
                   ON daily_goals(guild_id, date DESC)`);

    // Create market_data table for ticker prices and performance
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS market_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        change_amount REAL NOT NULL,
        change_percent REAL NOT NULL,
        volume INTEGER,
        market_cap INTEGER,
        performance_30d REAL,
        performance_90d REAL,
        performance_365d REAL,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        date TEXT NOT NULL
      )
    `);

    // Create indexes for market_data
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_market_data_symbol_date
                   ON market_data(symbol, date DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_market_data_timestamp
                   ON market_data(timestamp DESC)`);

    // Create market_news table for news articles
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS market_news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id INTEGER UNIQUE NOT NULL,
        symbol TEXT NOT NULL,
        headline TEXT NOT NULL,
        summary TEXT,
        source TEXT NOT NULL,
        url TEXT NOT NULL,
        published_at DATETIME NOT NULL,
        category TEXT,
        sentiment TEXT,
        is_significant BOOLEAN DEFAULT 0,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for market_news
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_market_news_symbol_date
                   ON market_news(symbol, published_at DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_market_news_published
                   ON market_news(published_at DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_market_news_significant
                   ON market_news(is_significant, published_at DESC)`);

    // Create weekly_analysis table for thesis reports
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS weekly_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_start TEXT NOT NULL,
        week_end TEXT NOT NULL,
        analysis_type TEXT NOT NULL CHECK(analysis_type IN ('thesis', 'performance', 'news')),
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        detailed_analysis TEXT NOT NULL,
        key_events TEXT,
        recommendations TEXT,
        metadata TEXT,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for weekly_analysis
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_weekly_analysis_date
                   ON weekly_analysis(week_start DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_weekly_analysis_type
                   ON weekly_analysis(analysis_type, week_start DESC)`);

    // Create financial_transactions table for Teller API data
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS financial_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT UNIQUE NOT NULL,
        account_id TEXT NOT NULL,
        account_name TEXT,
        account_type TEXT,
        institution TEXT,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        category TEXT,
        merchant TEXT,
        details TEXT,
        synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT
      )
    `);

    // Create indexes for financial_transactions
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_account_date
                   ON financial_transactions(account_id, date DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_date
                   ON financial_transactions(date DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_category
                   ON financial_transactions(category, date DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_merchant
                   ON financial_transactions(merchant, date DESC)`);

    logger.info('Database schema initialized');
  }

  /**
   * Store a conversation message
   */
  saveMessage(message: ConversationMessage): number {
    const stmt = this.db.prepare(`
      INSERT INTO conversations (guild_id, channel_id, user_id, username, message, message_type, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      message.guildId,
      message.channelId,
      message.userId,
      message.username,
      message.message,
      message.messageType,
      message.timestamp.toISOString(),
      message.metadata || null
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Get conversation history for a channel
   */
  getConversationHistory(
    guildId: string,
    channelId: string,
    limit: number = 50,
    offset: number = 0
  ): ConversationMessage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations
      WHERE guild_id = ? AND channel_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(guildId, channelId, limit, offset) as any[];

    return rows.map(row => ({
      id: row.id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      userId: row.user_id,
      username: row.username,
      message: row.message,
      messageType: row.message_type,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata
    }));
  }

  /**
   * Get recent conversation context for AI (formatted)
   */
  getConversationContext(
    guildId: string,
    channelId: string,
    messageCount: number = 20
  ): string {
    const messages = this.getConversationHistory(guildId, channelId, messageCount);

    // Reverse to show oldest first
    messages.reverse();

    return messages
      .map(msg => {
        const time = msg.timestamp.toLocaleTimeString();
        return `[${time}] ${msg.username}: ${msg.message}`;
      })
      .join('\n');
  }

  /**
   * Log agent activity
   */
  logAgentActivity(log: AgentLog): number {
    const stmt = this.db.prepare(`
      INSERT INTO agent_logs (agent_id, task_id, guild_id, channel_id, log_type, message, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      log.agentId,
      log.taskId,
      log.guildId,
      log.channelId,
      log.logType,
      log.message,
      log.details || null,
      log.timestamp.toISOString()
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Get agent logs
   */
  getAgentLogs(agentId: string, limit: number = 100): AgentLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_logs
      WHERE agent_id = ?
      ORDER BY timestamp ASC
      LIMIT ?
    `);

    const rows = stmt.all(agentId, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      agentId: row.agent_id,
      taskId: row.task_id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      logType: row.log_type,
      message: row.message,
      details: row.details,
      timestamp: new Date(row.timestamp)
    }));
  }

  /**
   * Create agent task
   */
  createAgentTask(task: AgentTask): number {
    const stmt = this.db.prepare(`
      INSERT INTO agent_tasks (agent_id, guild_id, channel_id, user_id, task_description, status, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      task.agentId,
      task.guildId,
      task.channelId,
      task.userId,
      task.taskDescription,
      task.status,
      task.startedAt.toISOString()
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Update agent task status
   */
  updateAgentTask(
    agentId: string,
    updates: Partial<Omit<AgentTask, 'id' | 'agentId'>>
  ): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.completedAt) {
      fields.push('completed_at = ?');
      values.push(updates.completedAt.toISOString());
    }
    if (updates.result !== undefined) {
      fields.push('result = ?');
      values.push(updates.result);
    }
    if (updates.error !== undefined) {
      fields.push('error = ?');
      values.push(updates.error);
    }

    if (fields.length === 0) return;

    values.push(agentId);

    const stmt = this.db.prepare(`
      UPDATE agent_tasks
      SET ${fields.join(', ')}
      WHERE agent_id = ?
    `);

    stmt.run(...values);
  }

  /**
   * Get agent task
   */
  getAgentTask(agentId: string): AgentTask | null {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_tasks
      WHERE agent_id = ?
    `);

    const row = stmt.get(agentId) as any;

    if (!row) return null;

    return {
      id: row.id,
      agentId: row.agent_id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      userId: row.user_id,
      taskDescription: row.task_description,
      status: row.status,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      result: row.result,
      error: row.error
    };
  }

  /**
   * Get all active agent tasks for a guild
   */
  getActiveAgentTasks(guildId: string): AgentTask[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_tasks
      WHERE guild_id = ? AND status IN ('pending', 'running')
      ORDER BY started_at DESC
    `);

    const rows = stmt.all(guildId) as any[];

    return rows.map(row => ({
      id: row.id,
      agentId: row.agent_id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      userId: row.user_id,
      taskDescription: row.task_description,
      status: row.status,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      result: row.result,
      error: row.error
    }));
  }

  /**
   * Get all active agent tasks (across all guilds)
   */
  getAllActiveAgentTasks(): AgentTask[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_tasks
      WHERE status IN ('pending', 'running')
      ORDER BY started_at DESC
    `);

    const rows = stmt.all() as any[];

    return rows.map(row => ({
      id: row.id,
      agentId: row.agent_id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      userId: row.user_id,
      taskDescription: row.task_description,
      status: row.status,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      result: row.result,
      error: row.error
    }));
  }

  /**
   * Get failed tasks within the last N hours
   */
  getFailedTasks(hours: number = 24): AgentTask[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_tasks
      WHERE status = 'failed' 
      AND completed_at >= datetime('now', '-' || ? || ' hours')
      ORDER BY completed_at DESC
    `);

    const rows = stmt.all(hours) as any[];

    return rows.map(row => ({
      id: row.id,
      agentId: row.agent_id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      userId: row.user_id,
      taskDescription: row.task_description,
      status: row.status,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      result: row.result,
      error: row.error
    }));
  }

  /**
   * Search conversations
   */
  searchConversations(
    guildId: string,
    searchQuery: string,
    limit: number = 50
  ): ConversationMessage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations
      WHERE guild_id = ? AND message LIKE ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(guildId, `%${searchQuery}%`, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      userId: row.user_id,
      username: row.username,
      message: row.message,
      messageType: row.message_type,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata
    }));
  }

  /**
   * Save daily goals
   */
  saveDailyGoal(goal: DailyGoal): number {
    const stmt = this.db.prepare(`
      INSERT INTO daily_goals (guild_id, user_id, username, date, goals, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      goal.guildId,
      goal.userId,
      goal.username,
      goal.date,
      goal.goals,
      goal.timestamp.toISOString(),
      goal.metadata || null
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Get daily goals for a user on a specific date
   */
  getDailyGoal(userId: string, date: string): DailyGoal | null {
    const stmt = this.db.prepare(`
      SELECT * FROM daily_goals
      WHERE user_id = ? AND date = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    const row = stmt.get(userId, date) as any;

    if (!row) return null;

    return {
      id: row.id,
      guildId: row.guild_id,
      userId: row.user_id,
      username: row.username,
      date: row.date,
      goals: row.goals,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata
    };
  }

  /**
   * Get all daily goals for a user (with optional limit)
   */
  getUserGoalsHistory(userId: string, limit: number = 30): DailyGoal[] {
    const stmt = this.db.prepare(`
      SELECT * FROM daily_goals
      WHERE user_id = ?
      ORDER BY date DESC
      LIMIT ?
    `);

    const rows = stmt.all(userId, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      guildId: row.guild_id,
      userId: row.user_id,
      username: row.username,
      date: row.date,
      goals: row.goals,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata
    }));
  }

  /**
   * Get all goals for a specific date across all users in a guild
   */
  getGuildGoalsForDate(guildId: string, date: string): DailyGoal[] {
    const stmt = this.db.prepare(`
      SELECT * FROM daily_goals
      WHERE guild_id = ? AND date = ?
      ORDER BY timestamp DESC
    `);

    const rows = stmt.all(guildId, date) as any[];

    return rows.map(row => ({
      id: row.id,
      guildId: row.guild_id,
      userId: row.user_id,
      username: row.username,
      date: row.date,
      goals: row.goals,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata
    }));
  }

  /**
   * Get statistics
   */
  getStatistics(guildId: string): {
    totalMessages: number;
    totalAgentTasks: number;
    activeAgentTasks: number;
    completedAgentTasks: number;
    failedAgentTasks: number;
  } {
    const totalMessages = this.db.prepare(`
      SELECT COUNT(*) as count FROM conversations WHERE guild_id = ?
    `).get(guildId) as any;

    const totalAgentTasks = this.db.prepare(`
      SELECT COUNT(*) as count FROM agent_tasks WHERE guild_id = ?
    `).get(guildId) as any;

    const activeAgentTasks = this.db.prepare(`
      SELECT COUNT(*) as count FROM agent_tasks WHERE guild_id = ? AND status IN ('pending', 'running')
    `).get(guildId) as any;

    const completedAgentTasks = this.db.prepare(`
      SELECT COUNT(*) as count FROM agent_tasks WHERE guild_id = ? AND status = 'completed'
    `).get(guildId) as any;

    const failedAgentTasks = this.db.prepare(`
      SELECT COUNT(*) as count FROM agent_tasks WHERE guild_id = ? AND status = 'failed'
    `).get(guildId) as any;

    return {
      totalMessages: totalMessages.count,
      totalAgentTasks: totalAgentTasks.count,
      activeAgentTasks: activeAgentTasks.count,
      completedAgentTasks: completedAgentTasks.count,
      failedAgentTasks: failedAgentTasks.count
    };
  }

  /**
   * Close database connection
   */
  /**
   * Get raw database instance (for advanced queries)
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Save market data for a ticker
   */
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
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO market_data (
        symbol, name, price, change_amount, change_percent, volume, market_cap,
        performance_30d, performance_90d, performance_365d, date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.symbol,
      data.name,
      data.price,
      data.changeAmount,
      data.changePercent,
      data.volume || null,
      data.marketCap || null,
      data.performance30d || null,
      data.performance90d || null,
      data.performance365d || null,
      data.date
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Save market news article
   */
  saveMarketNews(news: {
    articleId: number;
    symbol: string;
    headline: string;
    summary?: string;
    source: string;
    url: string;
    publishedAt: Date;
    category?: string;
    sentiment?: string;
    isSignificant: boolean;
  }): number | null {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO market_news (
          article_id, symbol, headline, summary, source, url, published_at,
          category, sentiment, is_significant
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        news.articleId,
        news.symbol,
        news.headline,
        news.summary || null,
        news.source,
        news.url,
        news.publishedAt.toISOString(),
        news.category || null,
        news.sentiment || null,
        news.isSignificant ? 1 : 0
      );

      return result.lastInsertRowid as number;
    } catch (error: any) {
      // Ignore duplicate article IDs
      if (error.code === 'SQLITE_CONSTRAINT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Save weekly analysis
   */
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
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO weekly_analysis (
        week_start, week_end, analysis_type, title, summary, detailed_analysis,
        key_events, recommendations, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      analysis.weekStart,
      analysis.weekEnd,
      analysis.analysisType,
      analysis.title,
      analysis.summary,
      analysis.detailedAnalysis,
      analysis.keyEvents || null,
      analysis.recommendations || null,
      analysis.metadata || null
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Get market data for a symbol within date range
   */
  getMarketData(symbol: string, startDate: string, endDate: string): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM market_data
      WHERE symbol = ? AND date BETWEEN ? AND ?
      ORDER BY date DESC
    `);

    return stmt.all(symbol, startDate, endDate);
  }

  /**
   * Get all market data for a specific date
   */
  getMarketDataByDate(date: string): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM market_data
      WHERE date = ?
      ORDER BY symbol
    `);

    return stmt.all(date);
  }

  /**
   * Get all market data within a date range (for all symbols)
   */
  getMarketDataByDateRange(startDate: string, endDate: string): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM market_data
      WHERE date BETWEEN ? AND ?
      ORDER BY date ASC, symbol ASC
    `);

    return stmt.all(startDate, endDate);
  }

  /**
   * Get news for a symbol within date range
   */
  getMarketNews(symbol: string, startDate: string, endDate: string): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM market_news
      WHERE symbol = ? AND DATE(published_at) BETWEEN ? AND ?
      ORDER BY published_at DESC
    `);

    return stmt.all(symbol, startDate, endDate);
  }

  /**
   * Get all news within a date range (for all symbols)
   */
  getMarketNewsByDateRange(startDate: string, endDate: string): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM market_news
      WHERE DATE(published_at) BETWEEN ? AND ?
      ORDER BY published_at DESC
    `);

    return stmt.all(startDate, endDate);
  }

  /**
   * Get significant news within date range
   */
  getSignificantNews(startDate: string, endDate: string): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM market_news
      WHERE is_significant = 1 AND DATE(published_at) BETWEEN ? AND ?
      ORDER BY published_at DESC
    `);

    return stmt.all(startDate, endDate);
  }

  /**
   * Get latest weekly analysis
   */
  getLatestWeeklyAnalysis(analysisType?: 'thesis' | 'performance' | 'news'): any | null {
    const stmt = analysisType
      ? this.db.prepare(`
          SELECT * FROM weekly_analysis
          WHERE analysis_type = ?
          ORDER BY week_start DESC
          LIMIT 1
        `)
      : this.db.prepare(`
          SELECT * FROM weekly_analysis
          ORDER BY week_start DESC
          LIMIT 1
        `);

    return analysisType ? stmt.get(analysisType) : stmt.get();
  }

  /**
   * Get weekly analyses within date range
   */
  getWeeklyAnalyses(startDate: string, endDate: string): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM weekly_analysis
      WHERE week_start BETWEEN ? AND ?
      ORDER BY week_start DESC
    `);

    return stmt.all(startDate, endDate);
  }

  /**
   * Execute a raw SQL statement (for setup operations like CREATE TABLE)
   */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  /**
   * Prepare a SQL statement for execution
   */
  prepare(sql: string): Database.Statement {
    return this.db.prepare(sql);
  }

  /**
   * Save a financial transaction (Teller API)
   */
  saveTransaction(transaction: FinancialTransaction): number {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO financial_transactions 
      (transaction_id, account_id, account_name, account_type, institution, date, description, amount, type, category, merchant, details, synced_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      transaction.transactionId,
      transaction.accountId,
      transaction.accountName || null,
      transaction.accountType || null,
      transaction.institution || null,
      transaction.date,
      transaction.description,
      transaction.amount,
      transaction.type,
      transaction.category || null,
      transaction.merchant || null,
      transaction.details || null,
      transaction.syncedAt ? transaction.syncedAt.toISOString() : new Date().toISOString(),
      transaction.metadata || null
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Save multiple transactions in a batch
   */
  saveTransactionsBatch(transactions: FinancialTransaction[]): number {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO financial_transactions 
      (transaction_id, account_id, account_name, account_type, institution, date, description, amount, type, category, merchant, details, synced_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((txns: FinancialTransaction[]) => {
      for (const transaction of txns) {
        stmt.run(
          transaction.transactionId,
          transaction.accountId,
          transaction.accountName || null,
          transaction.accountType || null,
          transaction.institution || null,
          transaction.date,
          transaction.description,
          transaction.amount,
          transaction.type,
          transaction.category || null,
          transaction.merchant || null,
          transaction.details || null,
          transaction.syncedAt ? transaction.syncedAt.toISOString() : new Date().toISOString(),
          transaction.metadata || null
        );
      }
    });

    insertMany(transactions);
    return transactions.length;
  }

  /**
   * Get transactions for a specific account
   */
  getTransactionsByAccount(accountId: string, limit: number = 100): FinancialTransaction[] {
    const stmt = this.db.prepare(`
      SELECT * FROM financial_transactions
      WHERE account_id = ?
      ORDER BY date DESC, id DESC
      LIMIT ?
    `);

    return stmt.all(accountId, limit) as FinancialTransaction[];
  }

  /**
   * Get transactions within a date range
   */
  getTransactionsByDateRange(startDate: string, endDate: string, accountId?: string): FinancialTransaction[] {
    const stmt = accountId
      ? this.db.prepare(`
          SELECT * FROM financial_transactions
          WHERE date BETWEEN ? AND ? AND account_id = ?
          ORDER BY date DESC, id DESC
        `)
      : this.db.prepare(`
          SELECT * FROM financial_transactions
          WHERE date BETWEEN ? AND ?
          ORDER BY date DESC, id DESC
        `);

    return accountId 
      ? (stmt.all(startDate, endDate, accountId) as FinancialTransaction[])
      : (stmt.all(startDate, endDate) as FinancialTransaction[]);
  }

  /**
   * Get transactions by category
   */
  getTransactionsByCategory(category: string, days: number = 30): FinancialTransaction[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const startDate = cutoffDate.toISOString().split('T')[0];

    const stmt = this.db.prepare(`
      SELECT * FROM financial_transactions
      WHERE category = ? AND date >= ?
      ORDER BY date DESC, id DESC
    `);

    return stmt.all(category, startDate) as FinancialTransaction[];
  }

  /**
   * Get all unique categories
   */
  getTransactionCategories(): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT category
      FROM financial_transactions
      WHERE category IS NOT NULL
      ORDER BY category
    `);

    return stmt.all().map((row: any) => row.category);
  }

  /**
   * Get spending summary by category for a date range
   */
  getSpendingSummary(startDate: string, endDate: string): any[] {
    const stmt = this.db.prepare(`
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
  }

  /**
   * Get total balance from all transactions
   */
  getTransactionBalance(accountId?: string): number {
    const stmt = accountId
      ? this.db.prepare(`SELECT SUM(amount) as balance FROM financial_transactions WHERE account_id = ?`)
      : this.db.prepare(`SELECT SUM(amount) as balance FROM financial_transactions`);

    const result: any = accountId ? stmt.get(accountId) : stmt.get();
    return result?.balance || 0;
  }

  /**
   * Get recent transactions (last N days)
   */
  getRecentTransactions(days: number = 30, limit: number = 100): FinancialTransaction[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const startDate = cutoffDate.toISOString().split('T')[0];

    const stmt = this.db.prepare(`
      SELECT * FROM financial_transactions
      WHERE date >= ?
      ORDER BY date DESC, id DESC
      LIMIT ?
    `);

    return stmt.all(startDate, limit) as FinancialTransaction[];
  }

  /**
   * Get last sync time for transactions
   */
  getLastTransactionSync(): Date | null {
    const stmt = this.db.prepare(`
      SELECT MAX(synced_at) as last_sync
      FROM financial_transactions
    `);

    const result: any = stmt.get();
    return result?.last_sync ? new Date(result.last_sync) : null;
  }

  /**
   * Delete old transactions (for cleanup)
   */
  deleteOldTransactions(daysToKeep: number = 365): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const stmt = this.db.prepare(`
      DELETE FROM financial_transactions
      WHERE date < ?
    `);

    const result = stmt.run(cutoffDateStr);
    return result.changes;
  }

  close(): void {
    this.db.close();
    logger.info('Database connection closed');
  }
}

// Singleton instance
let dbInstance: DatabaseService | null = null;

export function getDatabase(): DatabaseService {
  if (!dbInstance) {
    dbInstance = new DatabaseService();
  }
  return dbInstance;
}
