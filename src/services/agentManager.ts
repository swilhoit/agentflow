import { Client } from 'discord.js';
import { getPostgresDatabase } from './postgresDatabaseService';
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

  constructor(client: Client) {
    this.client = client;
    // Initialize database schema is handled by migration script now
    this.registerDefaultAgents();
  }

  /**
   * Register default agents in the system
   * Upserts them into Postgres
   */
  private async registerDefaultAgents(): Promise<void> {
    const db = getPostgresDatabase();
    
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

    try {
    for (const agent of agents) {
        await db.upsertAgentConfig({
          ...agent,
          config: JSON.stringify({}),
          channelIds: JSON.stringify([])
        });
      }
      logger.info(`✅ Default agents registered/updated in Postgres (${agents.length} agents)`);
    } catch (error) {
      logger.error('Failed to register default agents:', error);
    }
  }

  /**
   * Get all agents
   */
  async getAllAgents(): Promise<AgentConfig[]> {
    const db = getPostgresDatabase();
    const rows = await db.getAllAgentConfigs();
    return rows.map(this.mapRowToAgentConfig);
  }

  /**
   * Get agent by name
   */
  async getAgent(agentName: string): Promise<AgentConfig | undefined> {
    const db = getPostgresDatabase();
    const row = await db.getAgentConfig(agentName);
    return row ? this.mapRowToAgentConfig(row) : undefined;
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(agentName: string, status: 'active' | 'inactive' | 'error'): Promise<void> {
    const db = getPostgresDatabase();
    await db.updateAgentStatus(agentName, status);
  }

  /**
   * Enable/disable agent
   */
  async setAgentEnabled(agentName: string, isEnabled: boolean): Promise<void> {
    const db = getPostgresDatabase();
    // We need to get the full config to update just one field with upsert, 
    // or we add a specific method. For now, let's fetch and upsert.
    // Actually, updateAgentStatus logic is specific.
    // Let's just assume upsert handles it or add a method.
    // Since upsert requires all fields in my implementation, I should fetch first.
    const agent = await this.getAgent(agentName);
    if (agent) {
      await db.upsertAgentConfig({
        ...agent,
        isEnabled
      });
      logger.info(`${isEnabled ? 'Enabled' : 'Disabled'} agent: ${agentName}`);
    }
  }

  /**
   * Register a recurring task
   */
  async registerRecurringTask(task: Omit<RecurringTask, 'id' | 'totalRuns' | 'successfulRuns' | 'failedRuns' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const db = getPostgresDatabase();
    const id = await db.upsertRecurringTask({
      ...task,
      config: task.config || '{}'
    });
    logger.info(`✅ Registered recurring task: ${task.taskName}`);
    return id;
  }

  /**
   * Get all recurring tasks
   */
  async getAllRecurringTasks(): Promise<RecurringTask[]> {
    const db = getPostgresDatabase();
    const rows = await db.getAllRecurringTasks();
    return rows.map(this.mapRowToRecurringTask);
  }

  /**
   * Get enabled recurring tasks
   */
  async getEnabledRecurringTasks(): Promise<RecurringTask[]> {
    const db = getPostgresDatabase();
    const rows = await db.getEnabledRecurringTasks();
    return rows.map(this.mapRowToRecurringTask);
  }

  /**
   * Get recurring tasks by agent
   */
  async getAgentRecurringTasks(agentName: string): Promise<RecurringTask[]> {
    const tasks = await this.getAllRecurringTasks();
    return tasks.filter(t => t.agentName === agentName);
  }

  /**
   * Enable/disable recurring task
   */
  async setRecurringTaskEnabled(taskId: number, isEnabled: boolean): Promise<void> {
    // We need to update the DB and then update the schedule
    const db = getPostgresDatabase();
    // Since I don't have a partial update method for tasks yet, I fetch and upsert.
    // Or better, I'll just implement it via direct query in the DB service later if needed.
    // For now, let's fetch all tasks to find the one (inefficient but safe).
    const tasks = await this.getAllRecurringTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (task) {
        task.isEnabled = isEnabled;
      await db.upsertRecurringTask(task);
      
        if (isEnabled) {
          this.scheduleTask(task);
        } else {
          this.unscheduleTask(taskId);
      }
    }
  }

  /**
   * Get recurring task by ID
   */
  async getRecurringTaskById(taskId: number): Promise<RecurringTask | undefined> {
    const tasks = await this.getAllRecurringTasks();
    return tasks.find(t => t.id === taskId);
  }

  /**
   * Update task execution stats
   */
  async updateTaskStats(taskId: number, success: boolean): Promise<void> {
    const db = getPostgresDatabase();
    await db.updateTaskLastRun(taskId, success);
    }

  /**
   * Log task execution
   */
  async logTaskExecution(execution: Omit<TaskExecution, 'id'>): Promise<number> {
    const db = getPostgresDatabase();
    return await db.logTaskExecutionHistory(execution);
  }

  /**
   * Get task execution history
   */
  async getTaskExecutionHistory(taskId: number, limit: number = 50): Promise<TaskExecution[]> {
    // The DB method returns all executions, we might want to filter. 
    // Current DB service implementation `getRecentTaskExecutions` doesn't filter by ID.
    // I should rely on `getRecentTaskExecutions` for now or add a specific method.
    // For this refactor, I'll return recent executions and filter in memory (not ideal but quick fix)
    const db = getPostgresDatabase();
    const rows = await db.getRecentTaskExecutions(24 * 7); // Last 7 days
    return rows
      .filter(r => r.task_id === taskId)
      .slice(0, limit)
      .map(this.mapRowToTaskExecution);
  }

  /**
   * Get recent task executions across all tasks
   */
  async getRecentExecutions(limit: number = 50): Promise<TaskExecution[]> {
    const db = getPostgresDatabase();
    const rows = await db.getRecentTaskExecutions(24);
    return rows.slice(0, limit).map(this.mapRowToTaskExecution);
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
      await this.logTaskExecution({
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
      await this.updateTaskStats(task.id, status === 'success');
    }
  }

  /**
   * Register a task executor function
   */
  registerTaskExecutor(agentName: string, executor: TaskExecutor): void {
    this.taskExecutors.set(agentName, executor);
    logger.info(`✅ Registered task executor for agent: ${agentName}`);
  }

  /**
   * Start all enabled recurring tasks
   */
  async startAllTasks(): Promise<void> {
    const tasks = await this.getEnabledRecurringTasks();

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
  getTaskStats(): { enabledTasks: number; scheduledTasks: number } {
    return {
      enabledTasks: this.scheduledTasks.size,
      scheduledTasks: this.scheduledTasks.size
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
      isEnabled: row.is_enabled,
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
      isEnabled: row.is_enabled,
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
