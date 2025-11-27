import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

/**
 * PostgreSQL Database Service for Self-Hosted AgentFlow Database
 * 
 * This service connects to the self-hosted PostgreSQL container on Hetzner VPS.
 * It handles all agent logging, task tracking, and conversation history.
 */
export class PostgresDatabaseService {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor() {
    this.pool = new Pool({
      host: process.env.AGENTFLOW_DB_HOST || 'localhost',
      port: parseInt(process.env.AGENTFLOW_DB_PORT || '5432'),
      user: process.env.AGENTFLOW_DB_USER || 'agentflow',
      password: process.env.AGENTFLOW_DB_PASSWORD || 'agentflow_secure_2024',
      database: process.env.AGENTFLOW_DB_NAME || 'agentflow',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected PostgreSQL pool error:', err);
    });

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.isConnected = true;
      logger.info('✅ PostgreSQL database connected');
    } catch (error) {
      logger.error('❌ Failed to connect to PostgreSQL:', error);
      this.isConnected = false;
    }
  }

  /**
   * Ping the database to test connectivity
   * Returns true if connection is healthy
   */
  async ping(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch {
      return false;
    }
  }

  // ===========================================
  // AGENT TASKS
  // ===========================================

  async createAgentTask(task: {
    agentId: string;
    guildId: string;
    channelId: string;
    userId: string;
    username?: string;
    taskDescription: string;
    status?: string;
    metadata?: any;
  }): Promise<number> {
    const result = await this.pool.query(`
      INSERT INTO agent_tasks (agent_id, guild_id, channel_id, user_id, username, task_description, status, metadata, started_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (agent_id) DO UPDATE SET
        task_description = EXCLUDED.task_description,
        status = EXCLUDED.status,
        started_at = NOW()
      RETURNING id
    `, [
      task.agentId,
      task.guildId,
      task.channelId,
      task.userId,
      task.username || null,
      task.taskDescription,
      task.status || 'pending',
      JSON.stringify(task.metadata || {})
    ]);
    return result.rows[0].id;
  }

  async updateAgentTask(agentId: string, updates: {
    status?: string;
    result?: string;
    error?: string;
    iterations?: number;
    toolCalls?: number;
    completedAt?: Date;
  }): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(updates.status);
    }
    if (updates.result !== undefined) {
      fields.push(`result = $${paramCount++}`);
      values.push(updates.result);
    }
    if (updates.error !== undefined) {
      fields.push(`error = $${paramCount++}`);
      values.push(updates.error);
    }
    if (updates.iterations !== undefined) {
      fields.push(`iterations = $${paramCount++}`);
      values.push(updates.iterations);
    }
    if (updates.toolCalls !== undefined) {
      fields.push(`tool_calls = $${paramCount++}`);
      values.push(updates.toolCalls);
    }
    if (updates.completedAt !== undefined) {
      fields.push(`completed_at = $${paramCount++}`);
      values.push(updates.completedAt);
    }

    if (fields.length === 0) return;

    values.push(agentId);
    await this.pool.query(
      `UPDATE agent_tasks SET ${fields.join(', ')} WHERE agent_id = $${paramCount}`,
      values
    );
  }

  async getAgentTask(agentId: string): Promise<any | null> {
    const result = await this.pool.query(
      'SELECT * FROM agent_tasks WHERE agent_id = $1',
      [agentId]
    );
    return result.rows[0] || null;
  }

  async getAllActiveAgentTasks(): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT * FROM agent_tasks 
      WHERE status IN ('pending', 'running')
      ORDER BY started_at DESC
    `);
    return result.rows;
  }

  async getFailedTasks(hours: number = 24): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT * FROM agent_tasks 
      WHERE status = 'failed' 
      AND completed_at >= NOW() - INTERVAL '${hours} hours'
      ORDER BY completed_at DESC
    `);
    return result.rows;
  }

  // ===========================================
  // AGENT LOGS
  // ===========================================

  async logAgentActivity(log: {
    agentId: string;
    taskId?: string;
    guildId: string;
    channelId: string;
    logType: 'info' | 'warning' | 'error' | 'success' | 'step' | 'tool_call' | 'tool_result';
    message: string;
    details?: any;
  }): Promise<number> {
    const result = await this.pool.query(`
      INSERT INTO agent_logs (agent_id, task_id, guild_id, channel_id, log_type, message, details, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id
    `, [
      log.agentId,
      log.taskId || null,
      log.guildId,
      log.channelId,
      log.logType,
      log.message,
      log.details ? JSON.stringify(log.details) : null
    ]);
    return result.rows[0].id;
  }

  async getAgentLogs(agentId: string, limit: number = 100): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT * FROM agent_logs 
      WHERE agent_id = $1 
      ORDER BY timestamp DESC 
      LIMIT $2
    `, [agentId, limit]);
    return result.rows;
  }

  // ===========================================
  // CONVERSATIONS
  // ===========================================

  async saveConversation(message: {
    guildId: string;
    channelId: string;
    userId: string;
    username?: string;
    message: string;
    messageType?: string;
    metadata?: any;
  }): Promise<number> {
    const result = await this.pool.query(`
      INSERT INTO conversations (guild_id, channel_id, user_id, username, message, message_type, metadata, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id
    `, [
      message.guildId,
      message.channelId,
      message.userId,
      message.username || null,
      message.message,
      message.messageType || 'text',
      message.metadata ? JSON.stringify(message.metadata) : null
    ]);
    return result.rows[0].id;
  }

  async getConversationHistory(guildId: string, channelId: string, limit: number = 50): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT * FROM conversations 
      WHERE guild_id = $1 AND channel_id = $2
      ORDER BY timestamp DESC 
      LIMIT $3
    `, [guildId, channelId, limit]);
    return result.rows.reverse(); // Return in chronological order
  }

  // ===========================================
  // STARTUP LOGS
  // ===========================================

  async logStartupEvent(event: {
    eventType: string;
    message: string;
    details?: string;
    stackTrace?: string;
  }): Promise<number> {
    const result = await this.pool.query(`
      INSERT INTO startup_logs (event_type, message, details, stack_trace, timestamp)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
    `, [event.eventType, event.message, event.details || null, event.stackTrace || null]);
    return result.rows[0].id;
  }

  async getRecentStartupLogs(limit: number = 50): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT * FROM startup_logs 
      ORDER BY timestamp DESC 
      LIMIT $1
    `, [limit]);
    return result.rows;
  }

  // ===========================================
  // SYSTEM LOGS
  // ===========================================

  async logSystem(level: 'debug' | 'info' | 'warn' | 'error', service: string, message: string, details?: any): Promise<void> {
    await this.pool.query(`
      INSERT INTO system_logs (level, service, message, details, timestamp)
      VALUES ($1, $2, $3, $4, NOW())
    `, [level, service, message, details ? JSON.stringify(details) : null]);
  }

  async getSystemLogs(options: {
    level?: string;
    service?: string;
    since?: Date;
    limit?: number;
  } = {}): Promise<any[]> {
    let query = 'SELECT * FROM system_logs WHERE 1=1';
    const values: any[] = [];
    let paramCount = 1;

    if (options.level) {
      query += ` AND level = $${paramCount++}`;
      values.push(options.level);
    }
    if (options.service) {
      query += ` AND service = $${paramCount++}`;
      values.push(options.service);
    }
    if (options.since) {
      query += ` AND timestamp >= $${paramCount++}`;
      values.push(options.since);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramCount}`;
    values.push(options.limit || 100);

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  // ===========================================
  // TOOL EXECUTIONS
  // ===========================================

  async logToolExecution(execution: {
    taskId: string;
    agentId: string;
    toolName: string;
    toolInput?: any;
    toolOutput?: string;
    success?: boolean;
    error?: string;
    durationMs?: number;
  }): Promise<number> {
    const result = await this.pool.query(`
      INSERT INTO tool_executions (task_id, agent_id, tool_name, tool_input, tool_output, success, error, duration_ms, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id
    `, [
      execution.taskId,
      execution.agentId,
      execution.toolName,
      execution.toolInput ? JSON.stringify(execution.toolInput) : null,
      execution.toolOutput || null,
      execution.success !== false,
      execution.error || null,
      execution.durationMs || null
    ]);
    return result.rows[0].id;
  }

  // ===========================================
  // HEALTH CHECKS
  // ===========================================

  async logHealthCheck(health: {
    healthy: boolean;
    uptimeSeconds?: number;
    activeAgents?: number;
    pendingTasks?: number;
    completedTasks24h?: number;
    failedTasks24h?: number;
    memoryMb?: number;
    cpuPercent?: number;
    diskPercent?: number;
    details?: any;
  }): Promise<number> {
    const result = await this.pool.query(`
      INSERT INTO health_checks (healthy, uptime_seconds, active_agents, pending_tasks, completed_tasks_24h, failed_tasks_24h, memory_mb, cpu_percent, disk_percent, details, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING id
    `, [
      health.healthy,
      health.uptimeSeconds || null,
      health.activeAgents || null,
      health.pendingTasks || null,
      health.completedTasks24h || null,
      health.failedTasks24h || null,
      health.memoryMb || null,
      health.cpuPercent || null,
      health.diskPercent || null,
      health.details ? JSON.stringify(health.details) : null
    ]);
    return result.rows[0].id;
  }

  // ===========================================
  // FINANCIAL TRANSACTIONS
  // ===========================================

  async saveTransaction(transaction: {
    transactionId: string;
    accountId: string;
    accountName?: string;
    accountType?: string;
    institution?: string;
    date: string;
    description: string;
    amount: number;
    type: string;
    category?: string;
    merchant?: string;
    details?: string;
  }): Promise<number> {
    const result = await this.pool.query(`
      INSERT INTO financial_transactions
        (transaction_id, account_id, account_name, account_type, institution, date, description, amount, type, category, merchant, details, synced_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (transaction_id) DO UPDATE SET
        description = EXCLUDED.description,
        amount = EXCLUDED.amount,
        category = EXCLUDED.category,
        merchant = EXCLUDED.merchant,
        details = EXCLUDED.details,
        synced_at = NOW()
      RETURNING id
    `, [
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
      transaction.details || null
    ]);
    return result.rows[0].id;
  }

  async saveTransactionsBatch(transactions: Array<{
    transactionId: string;
    accountId: string;
    accountName?: string;
    accountType?: string;
    institution?: string;
    date: string;
    description: string;
    amount: number;
    type: string;
    category?: string;
    merchant?: string;
    details?: string;
  }>): Promise<number> {
    if (transactions.length === 0) return 0;

    // Build bulk upsert query
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const t of transactions) {
      placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, NOW())`);
      values.push(
        t.transactionId,
        t.accountId,
        t.accountName || null,
        t.accountType || null,
        t.institution || null,
        t.date,
        t.description,
        t.amount,
        t.type,
        t.category || null,
        t.merchant || null,
        t.details || null
      );
    }

    await this.pool.query(`
      INSERT INTO financial_transactions
        (transaction_id, account_id, account_name, account_type, institution, date, description, amount, type, category, merchant, details, synced_at)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (transaction_id) DO UPDATE SET
        description = EXCLUDED.description,
        amount = EXCLUDED.amount,
        category = EXCLUDED.category,
        merchant = EXCLUDED.merchant,
        details = EXCLUDED.details,
        synced_at = NOW()
    `, values);

    return transactions.length;
  }

  async getTransactionsByDateRange(startDate: string, endDate: string, accountId?: string): Promise<any[]> {
    let query = `
      SELECT * FROM financial_transactions
      WHERE date >= $1 AND date <= $2
    `;
    const params: any[] = [startDate, endDate];

    if (accountId) {
      query += ` AND account_id = $3`;
      params.push(accountId);
    }

    query += ` ORDER BY date DESC`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getTransactionsByAccount(accountId: string, limit: number = 100): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT * FROM financial_transactions
      WHERE account_id = $1
      ORDER BY date DESC
      LIMIT $2
    `, [accountId, limit]);
    return result.rows;
  }

  async getRecentTransactions(days: number = 30): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT * FROM financial_transactions
      WHERE date >= NOW() - INTERVAL '${days} days'
      ORDER BY date DESC
    `);
    return result.rows;
  }

  async getLastTransactionSync(): Promise<Date | null> {
    const result = await this.pool.query(`
      SELECT MAX(synced_at) as last_sync FROM financial_transactions
    `);
    return result.rows[0]?.last_sync || null;
  }

  async getSpendingSummary(startDate: string, endDate: string): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT
        category,
        COUNT(*) as transaction_count,
        SUM(ABS(amount)) as total_amount
      FROM financial_transactions
      WHERE date >= $1 AND date <= $2 AND amount < 0
      GROUP BY category
      ORDER BY total_amount DESC
    `, [startDate, endDate]);
    return result.rows;
  }

  async getTransactionCategories(): Promise<string[]> {
    const result = await this.pool.query(`
      SELECT DISTINCT category FROM financial_transactions WHERE category IS NOT NULL ORDER BY category
    `);
    return result.rows.map(r => r.category);
  }

  async deleteOldTransactions(daysToKeep: number = 365): Promise<number> {
    const result = await this.pool.query(`
      DELETE FROM financial_transactions
      WHERE date < NOW() - INTERVAL '${daysToKeep} days'
    `);
    return result.rowCount || 0;
  }

  // ===========================================
  // CONVERSATION TURNS (Full Context Logging)
  // ===========================================

  /**
   * Log a conversation turn - captures the full back-and-forth with Claude
   * This provides complete context for debugging and analysis
   */
  async logConversationTurn(turn: {
    taskId: string;
    agentId: string;
    guildId: string;
    channelId: string;
    turnNumber: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    contentType?: 'text' | 'tool_use' | 'tool_result' | 'planning' | 'reasoning';
    toolName?: string;
    toolInput?: any;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    metadata?: any;
  }): Promise<number> {
    const result = await this.pool.query(`
      INSERT INTO conversation_turns
        (task_id, agent_id, guild_id, channel_id, turn_number, role, content, content_type,
         tool_name, tool_input, model, input_tokens, output_tokens, metadata, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      RETURNING id
    `, [
      turn.taskId,
      turn.agentId,
      turn.guildId,
      turn.channelId,
      turn.turnNumber,
      turn.role,
      turn.content.substring(0, 50000), // Limit content size
      turn.contentType || 'text',
      turn.toolName || null,
      turn.toolInput ? JSON.stringify(turn.toolInput).substring(0, 10000) : null,
      turn.model || null,
      turn.inputTokens || null,
      turn.outputTokens || null,
      turn.metadata ? JSON.stringify(turn.metadata) : null
    ]);
    return result.rows[0].id;
  }

  /**
   * Get all conversation turns for a task - full context replay
   */
  async getConversationTurns(taskId: string): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT * FROM conversation_turns
      WHERE task_id = $1
      ORDER BY turn_number ASC, timestamp ASC
    `, [taskId]);
    return result.rows;
  }

  /**
   * Get recent conversation turns across all tasks for a channel
   */
  async getRecentConversationHistory(guildId: string, channelId: string, limit: number = 50): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT ct.*, at.task_description
      FROM conversation_turns ct
      LEFT JOIN agent_tasks at ON ct.task_id = at.agent_id
      WHERE ct.guild_id = $1 AND ct.channel_id = $2
      ORDER BY ct.timestamp DESC
      LIMIT $3
    `, [guildId, channelId, limit]);
    return result.rows.reverse(); // Return in chronological order
  }

  /**
   * Get formatted agent action history for context injection
   * This is the KEY method for giving the agent memory of its past actions
   */
  async getAgentActionHistory(guildId: string, channelId: string, options?: {
    maxTurns?: number;
    maxChars?: number;
    includeToolResults?: boolean;
    taskId?: string;  // If provided, only get history for this task
  }): Promise<string> {
    const maxTurns = options?.maxTurns || 30;
    const maxChars = options?.maxChars || 8000;
    const includeToolResults = options?.includeToolResults ?? true;

    let query: string;
    let params: any[];

    if (options?.taskId) {
      // Get history for a specific task
      query = `
        SELECT turn_number, role, content, content_type, tool_name, timestamp
        FROM conversation_turns
        WHERE task_id = $1
        ORDER BY turn_number ASC, timestamp ASC
        LIMIT $2
      `;
      params = [options.taskId, maxTurns];
    } else {
      // Get recent history across all tasks in this channel
      query = `
        SELECT ct.task_id, ct.turn_number, ct.role, ct.content, ct.content_type, ct.tool_name, ct.timestamp
        FROM conversation_turns ct
        WHERE ct.guild_id = $1 AND ct.channel_id = $2
        ORDER BY ct.timestamp DESC
        LIMIT $3
      `;
      params = [guildId, channelId, maxTurns];
    }

    const result = await this.pool.query(query, params);
    const turns = options?.taskId ? result.rows : result.rows.reverse();

    if (turns.length === 0) {
      return '';
    }

    // Format turns into a readable history
    const formattedTurns: string[] = [];
    let totalChars = 0;

    for (const turn of turns) {
      let turnText = '';

      switch (turn.content_type) {
        case 'text':
          if (turn.role === 'user') {
            turnText = `[USER] ${turn.content}`;
          } else {
            turnText = `[ASSISTANT] ${turn.content}`;
          }
          break;

        case 'tool_use':
          turnText = `[TOOL CALL] ${turn.tool_name}`;
          break;

        case 'tool_result':
          if (includeToolResults) {
            // Truncate long tool results
            const content = turn.content?.substring(0, 500) || '';
            turnText = `[TOOL RESULT] ${turn.tool_name}: ${content}${turn.content?.length > 500 ? '...' : ''}`;
          }
          break;

        case 'planning':
          turnText = `[PLANNING] ${turn.content?.substring(0, 300) || ''}`;
          break;

        case 'reasoning':
          // Include key reasoning, but truncate
          const reasoning = turn.content?.substring(0, 400) || '';
          turnText = `[REASONING] ${reasoning}${turn.content?.length > 400 ? '...' : ''}`;
          break;

        default:
          turnText = `[${turn.role?.toUpperCase()}] ${turn.content?.substring(0, 300) || ''}`;
      }

      if (turnText && (totalChars + turnText.length) <= maxChars) {
        formattedTurns.push(turnText);
        totalChars += turnText.length;
      } else if (totalChars >= maxChars) {
        break;  // Hit character limit
      }
    }

    if (formattedTurns.length === 0) {
      return '';
    }

    return `## Recent Agent Actions (${formattedTurns.length} turns)\n${formattedTurns.join('\n\n')}`;
  }

  /**
   * Get conversation summary for a task
   */
  async getTaskConversationSummary(taskId: string): Promise<{
    totalTurns: number;
    userTurns: number;
    assistantTurns: number;
    toolCalls: number;
    totalTokens: number;
    models: string[];
    duration?: number;
  }> {
    const result = await this.pool.query(`
      SELECT
        COUNT(*) as total_turns,
        COUNT(*) FILTER (WHERE role = 'user') as user_turns,
        COUNT(*) FILTER (WHERE role = 'assistant') as assistant_turns,
        COUNT(*) FILTER (WHERE content_type = 'tool_use') as tool_calls,
        COALESCE(SUM(input_tokens), 0) + COALESCE(SUM(output_tokens), 0) as total_tokens,
        ARRAY_AGG(DISTINCT model) FILTER (WHERE model IS NOT NULL) as models,
        EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) as duration_seconds
      FROM conversation_turns
      WHERE task_id = $1
    `, [taskId]);

    const row = result.rows[0];
    return {
      totalTurns: parseInt(row.total_turns) || 0,
      userTurns: parseInt(row.user_turns) || 0,
      assistantTurns: parseInt(row.assistant_turns) || 0,
      toolCalls: parseInt(row.tool_calls) || 0,
      totalTokens: parseInt(row.total_tokens) || 0,
      models: row.models || [],
      duration: row.duration_seconds ? parseFloat(row.duration_seconds) : undefined
    };
  }

  // ===========================================
  // UTILITY
  // ===========================================

  async query(sql: string, params?: any[]): Promise<any> {
    return this.pool.query(sql, params);
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.isConnected = false;
    logger.info('PostgreSQL database connection closed');
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
let postgresInstance: PostgresDatabaseService | null = null;

export function getPostgresDatabase(): PostgresDatabaseService {
  if (!postgresInstance) {
    postgresInstance = new PostgresDatabaseService();
  }
  return postgresInstance;
}




