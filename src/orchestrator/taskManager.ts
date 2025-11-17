import { ToolBasedAgent, AgentTask, AgentResult } from '../agents/toolBasedAgent';
import { TrelloService } from '../services/trello';
import { logger } from '../utils/logger';

export interface ManagedTask {
  taskId: string;
  agent: ToolBasedAgent;
  task: AgentTask;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  result?: AgentResult;
  error?: string;
  channelId: string;
  guildId: string;
  userId: string;
  description: string;
}

export interface TaskStatus {
  taskId: string;
  status: ManagedTask['status'];
  description: string;
  channelId: string;
  guildId: string;
  userId: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  result?: AgentResult;
  error?: string;
}

/**
 * TaskManager - Manages multiple concurrent ToolBasedAgent instances
 *
 * Features:
 * - Full task isolation (each task gets its own agent)
 * - Channel-specific notifications
 * - Task tracking and status queries
 * - Concurrent task execution
 * - Task cancellation support
 */
export class TaskManager {
  private tasks: Map<string, ManagedTask> = new Map();
  private anthropicApiKey: string;
  private trelloService?: TrelloService;
  private notificationHandlers: Map<string, (channelId: string, message: string) => Promise<void>> = new Map();
  private maxConcurrentTasks: number;

  constructor(anthropicApiKey: string, maxConcurrentTasks: number = 10, trelloService?: TrelloService) {
    this.anthropicApiKey = anthropicApiKey;
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.trelloService = trelloService;
  }

  /**
   * Register a notification handler for sending messages to Discord
   */
  setNotificationHandler(handlerId: string, handler: (channelId: string, message: string) => Promise<void>): void {
    this.notificationHandlers.set(handlerId, handler);
    logger.info(`Registered notification handler: ${handlerId}`);
  }

  /**
   * Create and start a new task with its own isolated agent
   */
  async startTask(
    task: AgentTask,
    description: string,
    notificationHandlerId: string = 'default'
  ): Promise<string> {
    // Check concurrent task limit
    const runningTasks = Array.from(this.tasks.values()).filter(t => t.status === 'running').length;
    if (runningTasks >= this.maxConcurrentTasks) {
      throw new Error(`Maximum concurrent tasks (${this.maxConcurrentTasks}) reached. Please wait for a task to complete or cancel an existing task.`);
    }

    const taskId = this.generateTaskId();
    logger.info(`🚀 Starting new task: ${taskId} in channel ${task.context.channelId}`);

    // Create a new ToolBasedAgent instance for this task (full isolation!)
    const agent = new ToolBasedAgent(this.anthropicApiKey, this.trelloService);

    // Set up channel-specific notification handler
    const notificationHandler = this.notificationHandlers.get(notificationHandlerId);
    if (notificationHandler) {
      agent.setNotificationHandler(async (message: string) => {
        try {
          await notificationHandler(task.context.channelId, message);
        } catch (error) {
          logger.error(`Failed to send notification for task ${taskId}`, error);
        }
      });
    } else {
      logger.warn(`No notification handler found for: ${notificationHandlerId}`);
    }

    // Create managed task
    const managedTask: ManagedTask = {
      taskId,
      agent,
      task,
      status: 'pending',
      startedAt: new Date(),
      channelId: task.context.channelId,
      guildId: task.context.guildId,
      userId: task.context.userId,
      description
    };

    this.tasks.set(taskId, managedTask);

    // Execute task asynchronously
    this.executeTask(managedTask);

    return taskId;
  }

  /**
   * Execute a task in the background
   */
  private async executeTask(managedTask: ManagedTask): Promise<void> {
    const { taskId, agent, task } = managedTask;

    try {
      managedTask.status = 'running';
      logger.info(`▶️ Task ${taskId} started execution`);

      const result = await agent.executeTask(task);

      managedTask.status = result.success ? 'completed' : 'failed';
      managedTask.completedAt = new Date();
      managedTask.result = result;

      if (!result.success) {
        managedTask.error = result.error;
      }

      logger.info(`${result.success ? '✅' : '❌'} Task ${taskId} ${managedTask.status}`);
    } catch (error) {
      managedTask.status = 'failed';
      managedTask.completedAt = new Date();
      managedTask.error = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`❌ Task ${taskId} failed with exception`, error);
    }
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): TaskStatus | null {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }

    const duration = task.completedAt
      ? task.completedAt.getTime() - task.startedAt.getTime()
      : Date.now() - task.startedAt.getTime();

    return {
      taskId: task.taskId,
      status: task.status,
      description: task.description,
      channelId: task.channelId,
      guildId: task.guildId,
      userId: task.userId,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      duration,
      result: task.result,
      error: task.error
    };
  }

  /**
   * Get all tasks (optionally filtered by channel, guild, or status)
   */
  getAllTasks(filters?: {
    channelId?: string;
    guildId?: string;
    userId?: string;
    status?: ManagedTask['status'];
  }): TaskStatus[] {
    let tasks = Array.from(this.tasks.values());

    if (filters) {
      if (filters.channelId) {
        tasks = tasks.filter(t => t.channelId === filters.channelId);
      }
      if (filters.guildId) {
        tasks = tasks.filter(t => t.guildId === filters.guildId);
      }
      if (filters.userId) {
        tasks = tasks.filter(t => t.userId === filters.userId);
      }
      if (filters.status) {
        tasks = tasks.filter(t => t.status === filters.status);
      }
    }

    return tasks.map(t => this.getTaskStatus(t.taskId)!).filter(Boolean);
  }

  /**
   * Cancel a running task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.warn(`Cannot cancel task ${taskId}: not found`);
      return false;
    }

    if (task.status !== 'running' && task.status !== 'pending') {
      logger.warn(`Cannot cancel task ${taskId}: status is ${task.status}`);
      return false;
    }

    task.status = 'cancelled';
    task.completedAt = new Date();
    task.error = 'Cancelled by user';

    logger.info(`🛑 Task ${taskId} cancelled`);
    return true;
  }

  /**
   * Clean up completed/failed tasks older than specified age
   */
  cleanupOldTasks(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        const age = now - task.startedAt.getTime();
        if (age > maxAgeMs) {
          this.tasks.delete(taskId);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      logger.info(`🧹 Cleaned up ${cleaned} old tasks`);
    }

    return cleaned;
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
    pending: number;
  } {
    const tasks = Array.from(this.tasks.values());
    return {
      total: tasks.length,
      running: tasks.filter(t => t.status === 'running').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length,
      pending: tasks.filter(t => t.status === 'pending').length
    };
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
