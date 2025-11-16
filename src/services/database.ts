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
