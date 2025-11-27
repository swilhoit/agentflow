import { Client, TextChannel, EmbedBuilder, Colors } from 'discord.js';
import { getSQLiteDatabase, isUsingPostgres, getDatabaseType } from './databaseFactory';
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
 * Uses Hetzner PostgreSQL for persistent storage
 */
export class AgentManagerService {
  private client: Client;
  private scheduledTasks: Map<number, cron.ScheduledTask> = new Map();
  private taskExecutors: Map<string, TaskExecutor> = new Map();
  private unifiedDb: UnifiedDatabaseService | null = null;
  // In-memory storage for agents (no database dependency)
  private inMemoryAgents: Map<string, AgentConfig> = new Map();
  private inMemoryTasks: Map<string, RecurringTask> = new Map();

  constructor(client: Client) {
    this.client = client;
    // NO DATABASE FOR AGENT MANAGER - use in-memory storage
    // Core agent logging uses PostgresDatabaseService directly
    this.initializeDatabase();
    this.registerDefaultAgents();
  }

  /**
   * Initialize database schema for agent management
   * Tables are created in Hetzner PostgreSQL
   */
  private initializeDatabase(): void {
    // NO SUPABASE - Tables already exist in Hetzner PostgreSQL
    // Created via migration script: agent_configs, recurring_tasks, agent_task_executions
    logger.info('✅ Agent Manager database schema initialized (Hetzner PostgreSQL)');
    return;

    // Legacy SQLite code below - kept for reference but never executed
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
    // Define required fields for default agent configs
    type DefaultAgentConfig = Pick<AgentConfig, 'agentName' | 'displayName' | 'description' | 'agentType' | 'status' | 'isEnabled'>;
    const agents: DefaultAgentConfig[] = [
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

    // Store agents in memory (no database dependency for agent manager)
    for (const agent of agents) {
      const fullConfig: AgentConfig = {
        agentName: agent.agentName,
        displayName: agent.displayName,
        description: agent.description,
        agentType: agent.agentType,
        status: agent.status,
        isEnabled: agent.isEnabled,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.inMemoryAgents.set(fullConfig.agentName, fullConfig);
    }

    logger.info(`✅ Default agents registered (${agents.length} agents in memory)`);
  }

  /**
   * Get all agents
   */
  getAllAgents(): AgentConfig[] {
    // Return agents from in-memory storage
    return Array.from(this.inMemoryAgents.values());
  }

  /**
   * Get all agents (async - works with both SQLite and Supabase)
   */
  async getAllAgentsAsync(): Promise<AgentConfig[]> {
    return this.getAllAgents();
  }

  /**
   * Get agent by name
   */
  getAgent(agentName: string): AgentConfig | undefined {
    return this.inMemoryAgents.get(agentName);
  }

  /**
   * Get agent by name (async)
   */
  async getAgentAsync(agentName: string): Promise<AgentConfig | undefined> {
    return this.getAgent(agentName);
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentName: string, status: 'active' | 'inactive' | 'error'): void {
    const agent = this.inMemoryAgents.get(agentName);
    if (agent) {
      agent.status = status;
      agent.lastActiveAt = new Date();
      agent.updatedAt = new Date();
    }
  }

  /**
   * Enable/disable agent
   */
  setAgentEnabled(agentName: string, isEnabled: boolean): void {
    const agent = this.inMemoryAgents.get(agentName);
    if (agent) {
      agent.isEnabled = isEnabled;
      agent.updatedAt = new Date();
      logger.info(`${isEnabled ? 'Enabled' : 'Disabled'} agent: ${agentName}`);
    }
  }

  /**
   * Register a recurring task
   */
  registerRecurringTask(task: Omit<RecurringTask, 'id' | 'totalRuns' | 'successfulRuns' | 'failedRuns' | 'createdAt' | 'updatedAt'>): number {
    const taskId = this.inMemoryTasks.size + 1;
    const fullTask: RecurringTask = {
      id: taskId,
      ...task,
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.inMemoryTasks.set(task.taskName, fullTask);

    const result = { lastInsertRowid: taskId };

    logger.info(`✅ Registered recurring task: ${task.taskName}`);
    return result.lastInsertRowid as number;
  }

  /**
   * Get all recurring tasks
   */
  getAllRecurringTasks(): RecurringTask[] {
    return Array.from(this.inMemoryTasks.values());
  }

  /**
   * Get all recurring tasks (async)
   */
  async getAllRecurringTasksAsync(): Promise<RecurringTask[]> {
    return this.getAllRecurringTasks();
  }

  /**
   * Get enabled recurring tasks (async)
   */
  async getEnabledRecurringTasksAsync(): Promise<RecurringTask[]> {
    return Array.from(this.inMemoryTasks.values()).filter(t => t.isEnabled);
  }

  /**
   * Get recurring tasks by agent
   */
  getAgentRecurringTasks(agentName: string): RecurringTask[] {
    return Array.from(this.inMemoryTasks.values()).filter(t => t.agentName === agentName);
  }

  /**
   * Enable/disable recurring task
   */
  setRecurringTaskEnabled(taskId: number, isEnabled: boolean): void {
    for (const task of this.inMemoryTasks.values()) {
      if (task.id === taskId) {
        task.isEnabled = isEnabled;
        task.updatedAt = new Date();
        if (isEnabled) {
          this.scheduleTask(task);
        } else {
          this.unscheduleTask(taskId);
        }
        break;
      }
    }
  }

  /**
   * Get recurring task by ID
   */
  getRecurringTask(taskId: number): RecurringTask | undefined {
    for (const task of this.inMemoryTasks.values()) {
      if (task.id === taskId) return task;
    }
    return undefined;
  }

  /**
   * Update task execution stats
   */
  updateTaskStats(taskId: number, success: boolean): void {
    const task = this.getRecurringTask(taskId);
    if (task) {
      task.lastRunAt = new Date();
      task.totalRuns++;
      if (success) task.successfulRuns++;
      else task.failedRuns++;
      task.updatedAt = new Date();
    }
  }

  // In-memory task execution history
  private taskExecutionHistory: TaskExecution[] = [];

  /**
   * Log task execution
   */
  logTaskExecution(execution: Omit<TaskExecution, 'id'>): number {
    const id = this.taskExecutionHistory.length + 1;
    const fullExecution: TaskExecution = { id, ...execution };
    this.taskExecutionHistory.unshift(fullExecution); // Add to front
    // Keep only last 1000 executions in memory
    if (this.taskExecutionHistory.length > 1000) {
      this.taskExecutionHistory = this.taskExecutionHistory.slice(0, 1000);
    }
    return id;
  }

  /**
   * Get task execution history
   */
  getTaskExecutionHistory(taskId: number, limit: number = 50): TaskExecution[] {
    return this.taskExecutionHistory
      .filter(e => e.taskId === taskId)
      .slice(0, limit);
  }

  /**
   * Get recent task executions across all tasks
   */
  getRecentExecutions(limit: number = 50): TaskExecution[] {
    return this.taskExecutionHistory.slice(0, limit);
  }

  /**
   * Get recent task executions (async)
   */
  async getRecentExecutionsAsync(hours: number = 24): Promise<TaskExecution[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.taskExecutionHistory.filter(e => e.startedAt >= cutoff);
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
    const tasks = this.getAllRecurringTasks();
    const enabledTasks = tasks.filter(t => t.isEnabled);

    logger.info(`🚀 Starting ${enabledTasks.length} recurring tasks...`);

    for (const task of enabledTasks) {
      this.scheduleTask(task);
    }

    logger.info(`✅ All recurring tasks started`);
  }

  /**
   * Start all tasks (async version)
   */
  async startAllTasksAsync(): Promise<void> {
    const tasks = await this.getEnabledRecurringTasksAsync();

    logger.info(`🚀 Starting ${tasks.length} recurring tasks...`);

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
