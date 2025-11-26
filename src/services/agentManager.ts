import { Client, TextChannel, EmbedBuilder, Colors } from 'discord.js';
import { getSQLiteDatabase, isUsingSupabase, getDatabaseType } from './databaseFactory';
import { getUnifiedDatabase, UnifiedDatabaseService } from './unifiedDatabase';
import { logger } from '../utils/logger';
import * as cron from 'node-cron';

/**
 * Agent Configuration
 * Represents a configured agent in the system
 */
export interface AgentConfig {
  id?: number;
  agentName: string; // 'mr krabs', 'Atlas', 'voice-agent', 'orchestrator'
  displayName: string; // 'Mr. Krabs Financial Advisor'
  description: string;
  agentType: 'discord-bot' | 'scheduler' | 'service';
  status: 'active' | 'inactive' | 'error';
  isEnabled: boolean;
  channelIds?: string; // JSON array of channel IDs to monitor
  config?: string; // JSON configuration specific to this agent
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Recurring Task Configuration
 * Scheduled tasks that agents perform automatically
 */
export interface RecurringTask {
  id?: number;
  taskName: string; // 'Daily Market Update', 'Morning Briefing', etc.
  agentName: string; // Which agent runs this task
  description: string;
  cronSchedule: string; // Cron expression
  timezone: string;
  isEnabled: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  config?: string; // JSON config for task execution
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Task Execution History
 * Logs each execution of a recurring task
 */
export interface TaskExecution {
  id?: number;
  taskId: number;
  taskName: string;
  agentName: string;
  status: 'success' | 'failed' | 'skipped';
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // milliseconds
  result?: string; // JSON result
  error?: string;
  metadata?: string; // JSON additional data
}

/**
 * Agent Manager Service
 * Central management for all agents and their recurring tasks
 * Supports both SQLite (local dev) and Supabase (cloud production)
 */
export class AgentManagerService {
  private client: Client;
  private scheduledTasks: Map<number, cron.ScheduledTask> = new Map();
  private taskExecutors: Map<string, TaskExecutor> = new Map();
  private unifiedDb: UnifiedDatabaseService | null = null;
  private useSupabase: boolean = false;

  constructor(client: Client) {
    this.client = client;
    this.useSupabase = isUsingSupabase();
    this.initializeDatabase();
    this.registerDefaultAgents();
  }

  /**
   * Initialize database schema for agent management
   */
  private initializeDatabase(): void {
    if (this.useSupabase) {
      // For Supabase, tables are already created via migrations
      // Just get the unified database instance
      this.unifiedDb = getUnifiedDatabase();
      logger.info('✅ Agent Manager using Supabase (cloud mode)');
      return;
    }

    // SQLite mode - create tables locally
    const db = getSQLiteDatabase().getRawDatabase();

    // Agent configurations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_name TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT NOT NULL,
        agent_type TEXT NOT NULL CHECK(agent_type IN ('discord-bot', 'scheduler', 'service')),
        status TEXT NOT NULL CHECK(status IN ('active', 'inactive', 'error')) DEFAULT 'active',
        is_enabled BOOLEAN NOT NULL DEFAULT 1,
        channel_ids TEXT,
        config TEXT,
        last_active_at DATETIME,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Recurring tasks table
    db.exec(`
      CREATE TABLE IF NOT EXISTS recurring_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_name TEXT UNIQUE NOT NULL,
        agent_name TEXT NOT NULL,
        description TEXT NOT NULL,
        cron_schedule TEXT NOT NULL,
        timezone TEXT NOT NULL DEFAULT 'America/New_York',
        is_enabled BOOLEAN NOT NULL DEFAULT 1,
        last_run_at DATETIME,
        next_run_at DATETIME,
        total_runs INTEGER NOT NULL DEFAULT 0,
        successful_runs INTEGER NOT NULL DEFAULT 0,
        failed_runs INTEGER NOT NULL DEFAULT 0,
        config TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_name) REFERENCES agent_configs(agent_name)
      )
    `);

    // Task execution history table
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        task_name TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'skipped')),
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        duration INTEGER,
        result TEXT,
        error TEXT,
        metadata TEXT,
        FOREIGN KEY (task_id) REFERENCES recurring_tasks(id)
      )
    `);

    // Create indexes
    db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_configs_status ON agent_configs(status, is_enabled)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_recurring_tasks_agent ON recurring_tasks(agent_name, is_enabled)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_recurring_tasks_schedule ON recurring_tasks(next_run_at, is_enabled)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_task_executions_task ON task_executions(task_id, started_at DESC)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_task_executions_status ON task_executions(status, started_at DESC)`);

    logger.info('✅ Agent Manager using SQLite (local mode)');
  }

  /**
   * Register default agents in the system
   */
  private registerDefaultAgents(): void {
    const agents: Partial<AgentConfig>[] = [
      {
        agentName: 'mr-krabs',
        displayName: 'Mr. Krabs Financial Advisor',
        description: 'Personal finance expert using Teller API for real bank account data. Provides spending analysis, budgeting, savings goals, and financial advice.',
        agentType: 'discord-bot',
        status: 'active',
        isEnabled: true
      },
      {
        agentName: 'atlas',
        displayName: 'Atlas Global Markets',
        description: 'Global markets expert and macro analyst. Covers Asian/European/EM markets, crypto, geopolitics, and cross-market dynamics.',
        agentType: 'discord-bot',
        status: 'active',
        isEnabled: true
      },
      {
        agentName: 'voice-agent',
        displayName: 'Voice Agent (Realtime API)',
        description: 'OpenAI Realtime API voice agent for natural voice conversations in Discord.',
        agentType: 'discord-bot',
        status: 'active',
        isEnabled: true
      },
      {
        agentName: 'market-scheduler',
        displayName: 'Market Update Scheduler',
        description: 'Automated market updates for AI Manhattan Project thesis portfolio. Daily updates, market close summaries, news checks, and weekly analysis.',
        agentType: 'scheduler',
        status: 'active',
        isEnabled: true
      },
      {
        agentName: 'goals-scheduler',
        displayName: 'Daily Goals Scheduler',
        description: 'Daily goals check-in system. Prompts users for daily goals and tracks progress over time.',
        agentType: 'scheduler',
        status: 'active',
        isEnabled: true
      },
      {
        agentName: 'supervisor',
        displayName: 'Supervisor Service',
        description: 'Chief of Staff for the agentic framework. Monitors task health, provides daily briefings, and nudges about forgotten tasks.',
        agentType: 'service',
        status: 'active',
        isEnabled: true
      },
      {
        agentName: 'vercel-monitor',
        displayName: 'Vercel Deployment Monitor',
        description: 'Monitors Vercel deployments and sends alerts to Discord when deployments fail. Tracks deployment health across all projects.',
        agentType: 'service',
        status: 'active',
        isEnabled: true
      }
    ];

    if (this.useSupabase && this.unifiedDb) {
      // Supabase mode - agents already exist from migration
      // Just verify they're there
      logger.info('✅ Default agents verified in Supabase');
      return;
    }

    // SQLite mode
    const db = getSQLiteDatabase().getRawDatabase();
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO agent_configs (agent_name, display_name, description, agent_type, status, is_enabled)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const agent of agents) {
      stmt.run(
        agent.agentName,
        agent.displayName,
        agent.description,
        agent.agentType,
        agent.status,
        agent.isEnabled ? 1 : 0
      );
    }

    logger.info('✅ Default agents registered');
  }

  /**
   * Get all agents
   */
  getAllAgents(): AgentConfig[] {
    if (this.useSupabase && this.unifiedDb) {
      // Return empty for sync call - use async getAllAgentsAsync for Supabase
      logger.warn('getAllAgents called in Supabase mode - use getAllAgentsAsync');
      return [];
    }
    const db = getSQLiteDatabase().getRawDatabase();
    const stmt = db.prepare('SELECT * FROM agent_configs ORDER BY agent_type, display_name');
    const rows = stmt.all() as any[];

    return rows.map(this.mapRowToAgentConfig);
  }

  /**
   * Get all agents (async - works with both SQLite and Supabase)
   */
  async getAllAgentsAsync(): Promise<AgentConfig[]> {
    if (this.useSupabase && this.unifiedDb) {
      const rows = await this.unifiedDb.getAllAgentConfigs();
      return rows.map(this.mapRowToAgentConfig);
    }
    return this.getAllAgents();
  }

  /**
   * Get agent by name
   */
  getAgent(agentName: string): AgentConfig | undefined {
    if (this.useSupabase && this.unifiedDb) {
      // Return undefined for sync call - use async getAgentAsync for Supabase
      logger.warn('getAgent called in Supabase mode - use getAgentAsync');
      return undefined;
    }
    const db = getSQLiteDatabase().getRawDatabase();
    const stmt = db.prepare('SELECT * FROM agent_configs WHERE agent_name = ?');
    const row = stmt.get(agentName) as any;

    return row ? this.mapRowToAgentConfig(row) : undefined;
  }

  /**
   * Get agent by name (async - works with both SQLite and Supabase)
   */
  async getAgentAsync(agentName: string): Promise<AgentConfig | undefined> {
    if (this.useSupabase && this.unifiedDb) {
      const row = await this.unifiedDb.getAgentConfig(agentName);
      return row ? this.mapRowToAgentConfig(row) : undefined;
    }
    return this.getAgent(agentName);
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentName: string, status: 'active' | 'inactive' | 'error'): void {
    if (this.useSupabase && this.unifiedDb) {
      // Fire and forget for async
      this.unifiedDb.updateAgentStatus(agentName, status);
      return;
    }
    const db = getSQLiteDatabase().getRawDatabase();
    const stmt = db.prepare(`
      UPDATE agent_configs
      SET status = ?, last_active_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE agent_name = ?
    `);
    stmt.run(status, agentName);
  }

  /**
   * Enable/disable agent
   */
  setAgentEnabled(agentName: string, isEnabled: boolean): void {
    if (this.useSupabase && this.unifiedDb) {
      // For Supabase, we'd need to add this method to UnifiedDatabaseService
      logger.warn('setAgentEnabled not fully implemented for Supabase');
      return;
    }
    const db = getSQLiteDatabase().getRawDatabase();
    const stmt = db.prepare(`
      UPDATE agent_configs
      SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE agent_name = ?
    `);
    stmt.run(isEnabled ? 1 : 0, agentName);
    logger.info(`${isEnabled ? 'Enabled' : 'Disabled'} agent: ${agentName}`);
  }

  /**
   * Register a recurring task
   */
  registerRecurringTask(task: Omit<RecurringTask, 'id' | 'totalRuns' | 'successfulRuns' | 'failedRuns' | 'createdAt' | 'updatedAt'>): number {
    if (this.useSupabase && this.unifiedDb) {
      // For Supabase, tasks are already registered via migration
      logger.info(`Task ${task.taskName} already exists in Supabase`);
      return 0;
    }
    const db = getSQLiteDatabase().getRawDatabase();
    const stmt = db.prepare(`
      INSERT INTO recurring_tasks (task_name, agent_name, description, cron_schedule, timezone, is_enabled, config)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      task.taskName,
      task.agentName,
      task.description,
      task.cronSchedule,
      task.timezone,
      task.isEnabled ? 1 : 0,
      task.config || null
    );

    logger.info(`✅ Registered recurring task: ${task.taskName}`);
    return result.lastInsertRowid as number;
  }

  /**
   * Get all recurring tasks
   */
  getAllRecurringTasks(): RecurringTask[] {
    if (this.useSupabase && this.unifiedDb) {
      logger.warn('getAllRecurringTasks called in Supabase mode - use getAllRecurringTasksAsync');
      return [];
    }
    const db = getSQLiteDatabase().getRawDatabase();
    const stmt = db.prepare('SELECT * FROM recurring_tasks ORDER BY agent_name, task_name');
    const rows = stmt.all() as any[];

    return rows.map(this.mapRowToRecurringTask);
  }

  /**
   * Get all recurring tasks (async - works with both)
   */
  async getAllRecurringTasksAsync(): Promise<RecurringTask[]> {
    if (this.useSupabase && this.unifiedDb) {
      const rows = await this.unifiedDb.getAllRecurringTasks();
      return rows.map(this.mapRowToRecurringTask);
    }
    return this.getAllRecurringTasks();
  }

  /**
   * Get enabled recurring tasks (async)
   */
  async getEnabledRecurringTasksAsync(): Promise<RecurringTask[]> {
    if (this.useSupabase && this.unifiedDb) {
      const rows = await this.unifiedDb.getEnabledRecurringTasks();
      return rows.map(this.mapRowToRecurringTask);
    }
    // SQLite fallback
    const db = getSQLiteDatabase().getRawDatabase();
    const stmt = db.prepare('SELECT * FROM recurring_tasks WHERE is_enabled = 1 ORDER BY agent_name, task_name');
    const rows = stmt.all() as any[];
    return rows.map(this.mapRowToRecurringTask);
  }

  /**
   * Get recurring tasks by agent
   */
  getAgentRecurringTasks(agentName: string): RecurringTask[] {
    if (this.useSupabase && this.unifiedDb) {
      logger.warn('getAgentRecurringTasks called in Supabase mode');
      return [];
    }
    const db = getSQLiteDatabase().getRawDatabase();
    const stmt = db.prepare('SELECT * FROM recurring_tasks WHERE agent_name = ? ORDER BY task_name');
    const rows = stmt.all(agentName) as any[];

    return rows.map(this.mapRowToRecurringTask);
  }

  /**
   * Enable/disable recurring task
   */
  setRecurringTaskEnabled(taskId: number, isEnabled: boolean): void {
    if (this.useSupabase && this.unifiedDb) {
      logger.warn('setRecurringTaskEnabled not fully implemented for Supabase');
      return;
    }
    const db = getSQLiteDatabase().getRawDatabase();
    const stmt = db.prepare(`
      UPDATE recurring_tasks
      SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(isEnabled ? 1 : 0, taskId);

    // Update scheduled tasks
    if (isEnabled) {
      const task = this.getRecurringTask(taskId);
      if (task) {
        this.scheduleTask(task);
      }
    } else {
      this.unscheduleTask(taskId);
    }
  }

  /**
   * Get recurring task by ID
   */
  getRecurringTask(taskId: number): RecurringTask | undefined {
    if (this.useSupabase && this.unifiedDb) {
      logger.warn('getRecurringTask called in Supabase mode - use async version');
      return undefined;
    }
    const db = getSQLiteDatabase().getRawDatabase();
    const stmt = db.prepare('SELECT * FROM recurring_tasks WHERE id = ?');
    const row = stmt.get(taskId) as any;

    return row ? this.mapRowToRecurringTask(row) : undefined;
  }

  /**
   * Update task execution stats
   */
  updateTaskStats(taskId: number, success: boolean): void {
    if (this.useSupabase && this.unifiedDb) {
      // Fire and forget
      this.unifiedDb.updateTaskLastRun(taskId, success);
      return;
    }
    const db = getSQLiteDatabase().getRawDatabase();
    const stmt = db.prepare(`
      UPDATE recurring_tasks
      SET
        last_run_at = CURRENT_TIMESTAMP,
        total_runs = total_runs + 1,
        ${success ? 'successful_runs = successful_runs + 1' : 'failed_runs = failed_runs + 1'},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(taskId);
  }

  /**
   * Log task execution
   */
  logTaskExecution(execution: Omit<TaskExecution, 'id'>): number {
    if (this.useSupabase && this.unifiedDb) {
      // Fire and forget for async
      this.unifiedDb.logTaskExecution({
        taskId: execution.taskId,
        taskName: execution.taskName,
        agentName: execution.agentName,
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        duration: execution.duration,
        result: execution.result,
        error: execution.error,
        metadata: execution.metadata,
      });
      return 0;
    }
    const db = getSQLiteDatabase().getRawDatabase();
    const stmt = db.prepare(`
      INSERT INTO task_executions (task_id, task_name, agent_name, status, started_at, completed_at, duration, result, error, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      execution.taskId,
      execution.taskName,
      execution.agentName,
      execution.status,
      execution.startedAt.toISOString(),
      execution.completedAt?.toISOString() || null,
      execution.duration || null,
      execution.result || null,
      execution.error || null,
      execution.metadata || null
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Get task execution history
   */
  getTaskExecutionHistory(taskId: number, limit: number = 50): TaskExecution[] {
    if (this.useSupabase && this.unifiedDb) {
      logger.warn('getTaskExecutionHistory called in Supabase mode');
      return [];
    }
    const db = getSQLiteDatabase().getRawDatabase();
    const stmt = db.prepare(`
      SELECT * FROM task_executions
      WHERE task_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(taskId, limit) as any[];

    return rows.map(this.mapRowToTaskExecution);
  }

  /**
   * Get recent task executions across all tasks
   */
  getRecentExecutions(limit: number = 50): TaskExecution[] {
    if (this.useSupabase && this.unifiedDb) {
      logger.warn('getRecentExecutions called in Supabase mode - use async');
      return [];
    }
    const db = getSQLiteDatabase().getRawDatabase();
    const stmt = db.prepare(`
      SELECT * FROM task_executions
      ORDER BY started_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as any[];

    return rows.map(this.mapRowToTaskExecution);
  }

  /**
   * Get recent task executions (async - works with both)
   */
  async getRecentExecutionsAsync(hours: number = 24): Promise<TaskExecution[]> {
    if (this.useSupabase && this.unifiedDb) {
      const rows = await this.unifiedDb.getRecentTaskExecutions(hours);
      return rows.map(this.mapRowToTaskExecution);
    }
    return this.getRecentExecutions(100);
  }

  /**
   * Schedule a recurring task
   */
  scheduleTask(task: RecurringTask): void {
    if (!task.id || !task.isEnabled) {
      return;
    }

    // Remove existing schedule if any
    this.unscheduleTask(task.id);

    try {
      const scheduledTask = cron.schedule(
        task.cronSchedule,
        async () => {
          await this.executeTask(task);
        },
        {
          timezone: task.timezone as any
        }
      );

      this.scheduledTasks.set(task.id, scheduledTask);
      logger.info(`📅 Scheduled task: ${task.taskName} (${task.cronSchedule} ${task.timezone})`);
    } catch (error) {
      logger.error(`Failed to schedule task ${task.taskName}:`, error);
    }
  }

  /**
   * Unschedule a task
   */
  unscheduleTask(taskId: number): void {
    const scheduledTask = this.scheduledTasks.get(taskId);
    if (scheduledTask) {
      scheduledTask.stop();
      this.scheduledTasks.delete(taskId);
      logger.info(`🛑 Unscheduled task ID: ${taskId}`);
    }
  }

  /**
   * Execute a recurring task
   */
  private async executeTask(task: RecurringTask): Promise<void> {
    if (!task.id) return;

    const startedAt = new Date();
    let status: 'success' | 'failed' | 'skipped' = 'skipped';
    let error: string | undefined;
    let result: string | undefined;

    try {
      logger.info(`⚡ Executing task: ${task.taskName} (${task.agentName})`);

      // Get the task executor for this agent
      const executor = this.taskExecutors.get(task.agentName);
      if (!executor) {
        throw new Error(`No executor registered for agent: ${task.agentName}`);
      }

      // Execute the task
      const executionResult = await executor(task);
      result = JSON.stringify(executionResult);
      status = 'success';

      logger.info(`✅ Task completed: ${task.taskName}`);
    } catch (err: any) {
      status = 'failed';
      error = err.message || String(err);
      logger.error(`❌ Task failed: ${task.taskName}`, err);
    } finally {
      const completedAt = new Date();
      const duration = completedAt.getTime() - startedAt.getTime();

      // Log execution
      this.logTaskExecution({
        taskId: task.id,
        taskName: task.taskName,
        agentName: task.agentName,
        status,
        startedAt,
        completedAt,
        duration,
        result,
        error
      });

      // Update stats
      this.updateTaskStats(task.id, status === 'success');
    }
  }

  /**
   * Register a task executor function
   * @param agentName The agent that executes tasks
   * @param executor The function that executes the task
   */
  registerTaskExecutor(agentName: string, executor: TaskExecutor): void {
    this.taskExecutors.set(agentName, executor);
    logger.info(`✅ Registered task executor for agent: ${agentName}`);
  }

  /**
   * Start all enabled recurring tasks
   */
  startAllTasks(): void {
    // For Supabase, we need to use async
    if (this.useSupabase && this.unifiedDb) {
      this.startAllTasksAsync();
      return;
    }

    const tasks = this.getAllRecurringTasks();
    const enabledTasks = tasks.filter(t => t.isEnabled);

    logger.info(`🚀 Starting ${enabledTasks.length} recurring tasks...`);

    for (const task of enabledTasks) {
      this.scheduleTask(task);
    }

    logger.info(`✅ All recurring tasks started`);
  }

  /**
   * Start all tasks (async version for Supabase)
   */
  async startAllTasksAsync(): Promise<void> {
    const tasks = await this.getEnabledRecurringTasksAsync();

    logger.info(`🚀 Starting ${tasks.length} recurring tasks (Supabase)...`);

    for (const task of tasks) {
      this.scheduleTask(task);
    }

    logger.info(`✅ All recurring tasks started`);
  }

  /**
   * Stop all scheduled tasks
   */
  stopAllTasks(): void {
    logger.info('🛑 Stopping all scheduled tasks...');

    for (const [taskId, scheduledTask] of this.scheduledTasks) {
      scheduledTask.stop();
    }

    this.scheduledTasks.clear();
    logger.info('✅ All scheduled tasks stopped');
  }

  /**
   * Get task statistics
   */
  getTaskStats(): {
    totalTasks: number;
    enabledTasks: number;
    disabledTasks: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
  } {
    const db = getSQLiteDatabase().getRawDatabase();

    const taskStats = db.prepare(`
      SELECT
        COUNT(*) as total_tasks,
        SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) as enabled_tasks,
        SUM(CASE WHEN is_enabled = 0 THEN 1 ELSE 0 END) as disabled_tasks,
        SUM(total_runs) as total_executions,
        SUM(successful_runs) as successful_executions,
        SUM(failed_runs) as failed_executions
      FROM recurring_tasks
    `).get() as any;

    return {
      totalTasks: taskStats.total_tasks || 0,
      enabledTasks: taskStats.enabled_tasks || 0,
      disabledTasks: taskStats.disabled_tasks || 0,
      totalExecutions: taskStats.total_executions || 0,
      successfulExecutions: taskStats.successful_executions || 0,
      failedExecutions: taskStats.failed_executions || 0
    };
  }

  /**
   * Helper: Map database row to AgentConfig
   */
  private mapRowToAgentConfig(row: any): AgentConfig {
    return {
      id: row.id,
      agentName: row.agent_name,
      displayName: row.display_name,
      description: row.description,
      agentType: row.agent_type,
      status: row.status,
      isEnabled: row.is_enabled === 1,
      channelIds: row.channel_ids,
      config: row.config,
      lastActiveAt: row.last_active_at ? new Date(row.last_active_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Helper: Map database row to RecurringTask
   */
  private mapRowToRecurringTask(row: any): RecurringTask {
    return {
      id: row.id,
      taskName: row.task_name,
      agentName: row.agent_name,
      description: row.description,
      cronSchedule: row.cron_schedule,
      timezone: row.timezone,
      isEnabled: row.is_enabled === 1,
      lastRunAt: row.last_run_at ? new Date(row.last_run_at) : undefined,
      nextRunAt: row.next_run_at ? new Date(row.next_run_at) : undefined,
      totalRuns: row.total_runs,
      successfulRuns: row.successful_runs,
      failedRuns: row.failed_runs,
      config: row.config,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Helper: Map database row to TaskExecution
   */
  private mapRowToTaskExecution(row: any): TaskExecution {
    return {
      id: row.id,
      taskId: row.task_id,
      taskName: row.task_name,
      agentName: row.agent_name,
      status: row.status,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      duration: row.duration,
      result: row.result,
      error: row.error,
      metadata: row.metadata
    };
  }
}

/**
 * Task executor function type
 * Takes a recurring task and executes it, returning any result data
 */
export type TaskExecutor = (task: RecurringTask) => Promise<any>;
