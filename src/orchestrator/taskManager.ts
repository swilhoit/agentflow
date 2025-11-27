import { ToolBasedAgent, AgentTask, AgentResult } from '../agents/toolBasedAgent';
import { TrelloService } from '../services/trello';
import { logger } from '../utils/logger';
import { isUsingSupabase, isUsingPostgres, getSQLiteDatabase, getAgentFlowDatabase } from '../services/databaseFactory';
import { PostgresDatabaseService } from '../services/postgresDatabaseService';

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
  trelloCardId?: string;
  trelloCardUrl?: string;
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
 * - Persistent conversation history (SQLite)
 */
export class TaskManager {
  private tasks: Map<string, ManagedTask> = new Map();
  private anthropicApiKey: string;
  private trelloService?: TrelloService;
  private notificationHandlers: Map<string, (channelId: string, message: string) => Promise<void>> = new Map();
  private maxConcurrentTasks: number;
  private pgDb: PostgresDatabaseService | null = null;

  constructor(anthropicApiKey: string, maxConcurrentTasks: number = 10, trelloService?: TrelloService) {
    this.anthropicApiKey = anthropicApiKey;
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.trelloService = trelloService;
    
    // Initialize PostgreSQL if configured
    if (isUsingPostgres()) {
      this.pgDb = getAgentFlowDatabase();
    }
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

    // PERSISTENCE: Save user command to database
    if (this.pgDb) {
      // Use PostgreSQL (self-hosted)
      try {
        await this.pgDb.saveConversation({
          guildId: task.context.guildId,
          channelId: task.context.channelId,
          userId: task.context.userId,
          username: 'User',
          message: task.command,
          messageType: 'text'
        });
        
        await this.pgDb.createAgentTask({
          agentId: taskId,
          guildId: task.context.guildId,
          channelId: task.context.channelId,
          userId: task.context.userId,
          taskDescription: description,
          status: 'pending'
        });
      } catch (e) { 
        logger.error('Failed to save task to PostgreSQL', e); 
      }
    } else if (!isUsingSupabase()) {
      // Fallback to SQLite (local dev only)
      try {
        const db = getSQLiteDatabase();
        
        // Save user message
        db.saveMessage({
          guildId: task.context.guildId,
          channelId: task.context.channelId,
          userId: task.context.userId,
          username: 'User',
          message: task.command,
          messageType: 'voice',
          timestamp: new Date()
        });

        // Save initial task state to DB
        db.createAgentTask({
          agentId: taskId,
          guildId: task.context.guildId,
          channelId: task.context.channelId,
          userId: task.context.userId,
          taskDescription: description,
          status: 'pending',
          startedAt: new Date()
        });
        logger.info(`💾 Persisted task ${taskId} to database`);

        // Load context (recent history)
        const history = db.getConversationContext(task.context.guildId, task.context.channelId, 10);
        
        // Inject into task context
        task.context.conversationHistory = history;
        logger.info(`📜 Injected conversation history (${history.length} chars)`);
      } catch (error) {
        logger.error('Failed to persist message or load history:', error);
        // Continue without history if DB fails
      }
    } else {
      // Supabase mode - skip SQLite operations
      logger.info(`💾 Task ${taskId} created (Supabase mode - using cloud storage)`);
    }

    // Create a new ToolBasedAgent instance for this task (full isolation!)
    const agent = new ToolBasedAgent(this.anthropicApiKey, this.trelloService);
    
    // Set task context for PostgreSQL logging
    agent.setTaskContext(taskId, task.context.guildId, task.context.channelId);

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

    // TRELLO SYNC: Create card in Inbox
    if (this.trelloService) {
      try {
        // Need to get configuration (passed in or from env)
        // For now, we'll check process.env directly as a fallback, but ideally config should be passed to TaskManager
        const boardId = process.env.TRELLO_BOARD_ID;
        const listId = process.env.TRELLO_INBOX_LIST_ID;

        if (listId) {
           logger.info(`📋 Syncing task to Trello List: ${listId}`);
           const card = await this.trelloService.createCard({
             idList: listId,
             name: `[${taskId}] ${description.substring(0, 80)}${description.length > 80 ? '...' : ''}`,
             desc: `**Task ID:** ${taskId}\n**User:** ${task.context.userId}\n**Channel:** ${task.context.channelId}\n\n${description}`
           });
           
           managedTask.trelloCardId = card.id;
           managedTask.trelloCardUrl = card.shortUrl;
           logger.info(`✅ Trello Card created: ${card.shortUrl}`);
           
           // Notify user
           if (notificationHandler) {
             await notificationHandler(task.context.channelId, `📋 **Trello Card Created:** <${card.shortUrl}>`);
           }
        }
      } catch (error) {
        logger.error('Failed to sync task to Trello:', error);
      }
    }

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

      // PERSISTENCE: Update status
      if (this.pgDb) {
        try {
          await this.pgDb.updateAgentTask(taskId, { status: 'running' });
        } catch (e) { logger.error('Failed to update task status in PostgreSQL', e); }
      } else if (!isUsingSupabase() && !isUsingPostgres()) {
        try {
          getSQLiteDatabase().updateAgentTask(taskId, { status: 'running' });
        } catch (e) { logger.error('Failed to update task status in SQLite', e); }
      }

      const result = await agent.executeTask(task);

      managedTask.status = result.success ? 'completed' : 'failed';
      managedTask.completedAt = new Date();
      managedTask.result = result;

      if (!result.success) {
        managedTask.error = result.error;
      }

      // TRELLO SYNC: Update card on completion
      if (this.trelloService && managedTask.trelloCardId) {
        try {
          logger.info(`📋 Updating Trello Card ${managedTask.trelloCardId}...`);
          
          // 1. Add comment with result
          const comment = result.success 
            ? `✅ **Task Completed**\n\n${result.message}`
            : `❌ **Task Failed**\n\nError: ${result.error}\n\n${result.message}`;
          
          await this.trelloService.addComment(managedTask.trelloCardId, comment);

          // 2. Move to Done list (if success and configured)
          const doneListId = process.env.TRELLO_DONE_LIST_ID;
          if (result.success && doneListId) {
            await this.trelloService.moveCard(managedTask.trelloCardId, doneListId, 'top');
            logger.info(`✅ Moved Trello card to Done list`);
          } else if (!result.success) {
            // Maybe add a "Failed" label? (For now just leaving in Inbox with comment)
            // await this.trelloService.addLabelToCard(managedTask.trelloCardId, 'red_label_id');
          }
        } catch (error) {
          logger.error('Failed to update Trello card:', error);
        }
      }

      // PERSISTENCE: Update completion status
      if (this.pgDb) {
        try {
          await this.pgDb.updateAgentTask(taskId, {
            status: managedTask.status,
            result: result.message || (result.success ? 'Task completed' : 'Task failed'),
            error: managedTask.error,
            iterations: result.iterations,
            toolCalls: result.toolCalls,
            completedAt: managedTask.completedAt
          });

          await this.pgDb.saveConversation({
            guildId: task.context.guildId,
            channelId: task.context.channelId,
            userId: 'agent',
            username: 'AgentFlow',
            message: result.message || (result.success ? 'Task completed' : 'Task failed'),
            messageType: 'agent_response',
            metadata: {
              taskId,
              iterations: result.iterations,
              toolCalls: result.toolCalls,
              success: result.success,
              trelloCardUrl: managedTask.trelloCardUrl
            }
          });
        } catch (error) {
          logger.error('Failed to save agent response to PostgreSQL:', error);
        }
      } else if (!isUsingSupabase() && !isUsingPostgres()) {
        try {
          const db = getSQLiteDatabase();
          db.updateAgentTask(taskId, {
            status: managedTask.status,
            completedAt: managedTask.completedAt,
            result: JSON.stringify(result),
            error: managedTask.error
          });

          db.saveMessage({
            guildId: task.context.guildId,
            channelId: task.context.channelId,
            userId: 'agent',
            username: 'AgentFlow',
            message: result.message || (result.success ? 'Task completed' : 'Task failed'),
            messageType: 'agent_response',
            timestamp: new Date(),
            metadata: JSON.stringify({
              taskId,
              iterations: result.iterations,
              toolCalls: result.toolCalls,
              success: result.success,
              trelloCardUrl: managedTask.trelloCardUrl
            })
          });
        } catch (error) {
          logger.error('Failed to save agent response to SQLite:', error);
        }
      }

      logger.info(`${result.success ? '✅' : '❌'} Task ${taskId} ${managedTask.status}`);
    } catch (error) {
      managedTask.status = 'failed';
      managedTask.completedAt = new Date();
      managedTask.error = error instanceof Error ? error.message : 'Unknown error';

      // TRELLO SYNC: Report fatal error
      if (this.trelloService && managedTask.trelloCardId) {
        try {
          await this.trelloService.addComment(managedTask.trelloCardId, `🔥 **Fatal System Error**\n\n${managedTask.error}`);
        } catch (e) { logger.error('Failed to update Trello card on fatal error', e); }
      }

      // PERSISTENCE: Update error status
      if (this.pgDb) {
        try {
          await this.pgDb.updateAgentTask(taskId, {
            status: 'failed',
            completedAt: managedTask.completedAt,
            error: managedTask.error
          });
        } catch (e) { logger.error('Failed to update task error in PostgreSQL', e); }
      } else if (!isUsingSupabase() && !isUsingPostgres()) {
        try {
          getSQLiteDatabase().updateAgentTask(taskId, {
            status: 'failed',
            completedAt: managedTask.completedAt,
            error: managedTask.error
          });
        } catch (e) { logger.error('Failed to update task error in SQLite', e); }
      }

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
   * Restore active tasks from database on startup
   * Marks interrupted tasks as failed so they don't hang forever
   */
  async restoreTasks(): Promise<void> {
    // PostgreSQL: Mark any running tasks as failed (they were interrupted)
    if (this.pgDb) {
      try {
        const activeTasks = await this.pgDb.getAllActiveAgentTasks();
        if (activeTasks.length > 0) {
          logger.info(`🔄 Found ${activeTasks.length} interrupted tasks - marking as failed`);
          for (const task of activeTasks) {
            await this.pgDb.updateAgentTask(task.agent_id, {
              status: 'failed',
              error: 'Task interrupted by system restart',
              completedAt: new Date()
            });
          }
        }
        logger.info('✅ Task restoration complete (PostgreSQL)');
        return;
      } catch (e) {
        logger.error('Failed to restore tasks from PostgreSQL:', e);
        return;
      }
    }
    
    if (isUsingSupabase() || isUsingPostgres()) {
      logger.info('🔄 Task restoration skipped (cloud mode - managed by PostgreSQL)');
      return;
    }
    
    // SQLite fallback (local dev only)
    try {
      const db = getSQLiteDatabase();
      const activeTasks = db.getAllActiveAgentTasks();
      
      if (activeTasks.length > 0) {
        logger.info(`🔄 Restoring ${activeTasks.length} interrupted tasks from database...`);

        for (const task of activeTasks) {
          // Create a placeholder agent
          const agent = new ToolBasedAgent(this.anthropicApiKey, this.trelloService);
          
          // Reconstruct context (partial)
          const context = {
            userId: task.userId,
            guildId: task.guildId,
            channelId: task.channelId
          };

          const managedTask: ManagedTask = {
            taskId: task.agentId,
            agent,
            task: {
              command: task.taskDescription,
              context
            },
            status: 'failed', // Mark as failed because process died
            startedAt: task.startedAt,
            completedAt: new Date(), // Completed now (by interruption)
            error: 'System restart detected - Task interrupted',
            channelId: task.channelId,
            guildId: task.guildId,
            userId: task.userId,
            description: task.taskDescription
          };

          // Update DB to reflect failure
          db.updateAgentTask(task.agentId, {
            status: 'failed',
            completedAt: new Date(),
            error: 'System restart detected - Task interrupted'
          });

          this.tasks.set(task.agentId, managedTask);
          logger.info(`⚠️ Marked task ${task.agentId} as interrupted`);
        }
      }
    } catch (error) {
      logger.error('Failed to restore tasks:', error);
    }
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
