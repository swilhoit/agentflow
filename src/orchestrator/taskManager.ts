import { ToolBasedAgent, AgentTask, AgentResult } from '../agents/toolBasedAgent';
import { TrelloService } from '../services/trello';
import { logger } from '../utils/logger';
import { isUsingPostgres, getSQLiteDatabase, getAgentFlowDatabase } from '../services/databaseFactory';
import { PostgresDatabaseService } from '../services/postgresDatabaseService';
import { getTaskLifecycleManager, TaskCheckpoint } from '../services/taskLifecycleManager';
import { TaskProvider, RunningTask, getGracefulShutdownHandler } from '../services/gracefulShutdown';
import { getWorkspaceRegistry } from '../services/workspaceRegistry';

export interface ManagedTask {
  taskId: string;
  agent: ToolBasedAgent;
  task: AgentTask;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
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
  // Reliability tracking
  currentIteration: number;
  toolCallCount: number;
  workspacePath?: string;
  discoveries: string[];
  artifacts: {
    files_created: string[];
    urls_deployed: string[];
    repos_created: string[];
  };
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
 * - Task checkpointing for recovery
 * - Graceful shutdown with task preservation
 */
export class TaskManager implements TaskProvider {
  private tasks: Map<string, ManagedTask> = new Map();
  private anthropicApiKey: string;
  private trelloService?: TrelloService;
  private notificationHandlers: Map<string, (channelId: string, message: string) => Promise<void>> = new Map();
  private maxConcurrentTasks: number;
  private pgDb: PostgresDatabaseService | null = null;
  private checkpointInterval: NodeJS.Timeout | null = null;
  private autoResumeEnabled: boolean = true;

  constructor(anthropicApiKey: string, maxConcurrentTasks: number = 10, trelloService?: TrelloService) {
    this.anthropicApiKey = anthropicApiKey;
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.trelloService = trelloService;

    // Initialize PostgreSQL if configured
    if (isUsingPostgres()) {
      this.pgDb = getAgentFlowDatabase();
    }

    // Register this TaskManager with the GracefulShutdownHandler
    const shutdownHandler = getGracefulShutdownHandler();
    shutdownHandler.setTaskProvider(this);
  }

  // ==========================================
  // TaskProvider Interface Implementation
  // ==========================================

  /**
   * Get all currently running tasks (for graceful shutdown)
   */
  getRunningTasks(): RunningTask[] {
    const runningTasks: RunningTask[] = [];

    for (const task of this.tasks.values()) {
      if (task.status === 'running') {
        runningTasks.push({
          taskId: task.taskId,
          channelId: task.channelId,
          guildId: task.guildId,
          currentPhase: undefined, // We'd need to expose this from agent
          currentIteration: task.currentIteration,
          toolCallCount: task.toolCallCount,
          workspacePath: task.workspacePath,
          discoveries: task.discoveries,
          artifacts: task.artifacts,
          conversationHistory: [], // Agent's internal history - truncated for performance
          memoryState: undefined
        });
      }
    }

    return runningTasks;
  }

  /**
   * Mark a task as interrupted (for graceful shutdown)
   */
  async markTaskInterrupted(taskId: string, reason: string, resumable: boolean): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'interrupted';
    task.completedAt = new Date();
    task.error = reason;

    // Persist to database
    if (this.pgDb) {
      try {
        await this.pgDb.updateAgentTask(taskId, {
          status: 'failed', // DB uses 'failed' status
          error: reason,
          completedAt: task.completedAt
        });

        // Mark as resumable in the task record
        await this.pgDb.query(`
          UPDATE agent_tasks SET is_resumable = $1 WHERE agent_id = $2
        `, [resumable, taskId]);
      } catch (e) {
        logger.error(`Failed to mark task ${taskId} as interrupted:`, e);
      }
    }

    logger.info(`⏸️ Task ${taskId} marked as interrupted (resumable: ${resumable})`);
  }

  /**
   * Mark a task as failed (for graceful shutdown when checkpoint fails)
   */
  async markTaskFailed(taskId: string, error: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'failed';
    task.completedAt = new Date();
    task.error = error;

    if (this.pgDb) {
      try {
        await this.pgDb.updateAgentTask(taskId, {
          status: 'failed',
          error,
          completedAt: task.completedAt
        });
      } catch (e) {
        logger.error(`Failed to mark task ${taskId} as failed:`, e);
      }
    }
  }

  /**
   * Send notification to a Discord channel
   */
  async notify(channelId: string, message: string): Promise<void> {
    // Try all registered handlers
    for (const handler of this.notificationHandlers.values()) {
      try {
        await handler(channelId, message);
        return; // Success, don't try other handlers
      } catch (e) {
        // Try next handler
      }
    }
    logger.warn(`Failed to send notification to channel ${channelId}`);
  }

  /**
   * Update task progress (called by agent during execution)
   */
  updateTaskProgress(taskId: string, progress: {
    iteration?: number;
    toolCalls?: number;
    workspacePath?: string;
    discovery?: string;
    artifact?: { type: 'file' | 'url' | 'repo'; value: string };
  }): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    if (progress.iteration !== undefined) task.currentIteration = progress.iteration;
    if (progress.toolCalls !== undefined) task.toolCallCount = progress.toolCalls;
    if (progress.workspacePath) task.workspacePath = progress.workspacePath;
    if (progress.discovery) task.discoveries.push(progress.discovery);
    if (progress.artifact) {
      switch (progress.artifact.type) {
        case 'file': task.artifacts.files_created.push(progress.artifact.value); break;
        case 'url': task.artifacts.urls_deployed.push(progress.artifact.value); break;
        case 'repo': task.artifacts.repos_created.push(progress.artifact.value); break;
      }
    }

    // Check if we should checkpoint
    const lifecycleManager = getTaskLifecycleManager();
    if (lifecycleManager.shouldCheckpoint(taskId, task.currentIteration)) {
      this.createCheckpoint(taskId);
    }
  }

  /**
   * Create a checkpoint for a task
   */
  private async createCheckpoint(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'running') return;

    const lifecycleManager = getTaskLifecycleManager();

    try {
      await lifecycleManager.createCheckpoint(taskId, {
        iteration: task.currentIteration,
        toolCallsCount: task.toolCallCount,
        conversationContext: [], // Would need agent.getConversationHistory()
        workspacePath: task.workspacePath,
        discoveries: task.discoveries,
        artifacts: task.artifacts
      });
    } catch (error) {
      logger.error(`Failed to create checkpoint for task ${taskId}:`, error);
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

    // PERSISTENCE: Create agent task record (user message already saved by Discord bot)
    if (this.pgDb) {
      // Use PostgreSQL (self-hosted)
      try {
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
    } else {
      // Fallback to SQLite (local dev only - when PostgreSQL is not available)
      try {
        const db = getSQLiteDatabase();

        // User message already saved by Discord bot, only create task record
        db.createAgentTask({
          agentId: taskId,
          guildId: task.context.guildId,
          channelId: task.context.channelId,
          userId: task.context.userId,
          taskDescription: description,
          status: 'pending',
          startedAt: new Date()
        });
        logger.info(`💾 Persisted task ${taskId} to SQLite database`);

        // Load context (recent history)
        const history = db.getConversationContext(task.context.guildId, task.context.channelId, 10);

        // Inject into task context
        task.context.conversationHistory = history;
        logger.info(`📜 Injected conversation history (${history.length} chars)`);
      } catch (error) {
        logger.error('Failed to persist message or load history:', error);
        // Continue without history if DB fails
      }
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

    // Create managed task with reliability tracking
    const managedTask: ManagedTask = {
      taskId,
      agent,
      task,
      status: 'pending',
      startedAt: new Date(),
      channelId: task.context.channelId,
      guildId: task.context.guildId,
      userId: task.context.userId,
      description,
      // Reliability tracking initialization
      currentIteration: 0,
      toolCallCount: 0,
      discoveries: [],
      artifacts: {
        files_created: [],
        urls_deployed: [],
        repos_created: []
      }
    };

    // NOTE: Trello is no longer used for automatic task tracking.
    // Agents use Trello only for long-term project management when explicitly needed.
    // See trello_create_project, trello_get_project, trello_update_project tools.

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
      } else {
        // SQLite fallback
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
      } else {
        // SQLite fallback
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
      } else {
        // SQLite fallback
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
   * Now supports resuming tasks from checkpoints!
   */
  async restoreTasks(): Promise<void> {
    const lifecycleManager = getTaskLifecycleManager();
    await lifecycleManager.initialize();

    // PostgreSQL: Check for resumable tasks
    if (this.pgDb) {
      try {
        const activeTasks = await this.pgDb.getAllActiveAgentTasks();

        if (activeTasks.length === 0) {
          logger.info('✅ No interrupted tasks found');
          return;
        }

        logger.info(`🔄 Found ${activeTasks.length} interrupted task(s) - checking for resume capability...`);

        for (const task of activeTasks) {
          const taskId = task.agent_id;

          // Check if this task can be resumed
          if (this.autoResumeEnabled) {
            const resumeCheck = await lifecycleManager.canResumeTask(taskId);

            if (resumeCheck.canResume && resumeCheck.checkpoint) {
              logger.info(`♻️ Task ${taskId} is resumable from checkpoint ${resumeCheck.checkpoint.checkpointNumber}`);

              // Attempt to resume
              const resumed = await this.resumeTask(taskId, resumeCheck.checkpoint, task);
              if (resumed) {
                continue; // Successfully resumed, don't mark as failed
              }
            } else {
              logger.info(`❌ Task ${taskId} cannot be resumed: ${resumeCheck.reason}`);
            }
          }

          // Cannot resume - mark as failed
          await this.pgDb.updateAgentTask(taskId, {
            status: 'failed',
            error: 'Task interrupted by system restart (not resumable)',
            completedAt: new Date()
          });

          // Notify user about interrupted task
          try {
            await this.notify(task.channel_id, `⚠️ **Task Interrupted**\nYour task was interrupted by a system restart and could not be resumed.\n\n**Task:** ${task.task_description?.substring(0, 100)}...\n**Reason:** ${this.autoResumeEnabled ? 'No valid checkpoint available' : 'Auto-resume disabled'}\n\nPlease restart the task if needed.`);
          } catch (e) {
            // Notification failure is non-critical
          }
        }

        logger.info('✅ Task restoration complete (PostgreSQL)');
        return;
      } catch (e) {
        logger.error('Failed to restore tasks from PostgreSQL:', e);
        return;
      }
    }

    // SQLite fallback (local dev only)
    try {
      const db = getSQLiteDatabase();
      const activeTasks = db.getAllActiveAgentTasks();

      if (activeTasks.length > 0) {
        logger.info(`🔄 Found ${activeTasks.length} interrupted tasks (SQLite)...`);

        for (const task of activeTasks) {
          // Mark as failed (SQLite doesn't support resume)
          db.updateAgentTask(task.agentId, {
            status: 'failed',
            completedAt: new Date(),
            error: 'System restart detected - Task interrupted'
          });

          logger.info(`⚠️ Marked task ${task.agentId} as interrupted (SQLite - no resume support)`);
        }
      }
    } catch (error) {
      logger.error('Failed to restore tasks:', error);
    }
  }

  /**
   * Resume a task from a checkpoint
   */
  private async resumeTask(
    taskId: string,
    checkpoint: TaskCheckpoint,
    dbTask: any
  ): Promise<boolean> {
    const lifecycleManager = getTaskLifecycleManager();

    try {
      logger.info(`🔄 Attempting to resume task ${taskId} from checkpoint ${checkpoint.checkpointNumber}...`);

      // Reconstruct task context
      const context = {
        userId: dbTask.user_id,
        guildId: dbTask.guild_id,
        channelId: dbTask.channel_id,
        // Serialize conversation context for the agent
        conversationHistory: checkpoint.conversationContext?.length
          ? JSON.stringify(checkpoint.conversationContext)
          : undefined
      };

      // Create a new agent
      const agent = new ToolBasedAgent(this.anthropicApiKey, this.trelloService);
      agent.setTaskContext(taskId, context.guildId, context.channelId);

      // Set up notification handler
      const notificationHandler = this.notificationHandlers.get('default');
      if (notificationHandler) {
        agent.setNotificationHandler(async (message: string) => {
          try {
            await notificationHandler(context.channelId, message);
          } catch (error) {
            logger.error(`Failed to send notification for resumed task ${taskId}`, error);
          }
        });
      }

      // Create managed task from checkpoint
      const managedTask: ManagedTask = {
        taskId,
        agent,
        task: {
          command: dbTask.task_description,
          context
        },
        status: 'running',
        startedAt: new Date(dbTask.started_at),
        channelId: context.channelId,
        guildId: context.guildId,
        userId: context.userId,
        description: dbTask.task_description,
        // Restore from checkpoint
        currentIteration: checkpoint.iteration,
        toolCallCount: checkpoint.toolCallsCount,
        workspacePath: checkpoint.workspacePath,
        discoveries: checkpoint.discoveries || [],
        artifacts: checkpoint.artifacts || {
          files_created: [],
          urls_deployed: [],
          repos_created: []
        }
      };

      this.tasks.set(taskId, managedTask);

      // Update database
      if (this.pgDb) {
        await this.pgDb.updateAgentTask(taskId, {
          status: 'running'
        });
      }

      // Notify user about resume
      await this.notify(context.channelId, `♻️ **Task Resumed**\nYour interrupted task is being resumed from checkpoint.\n\n**Progress restored:**\n• Iteration: ${checkpoint.iteration}\n• Tool calls: ${checkpoint.toolCallsCount}\n${checkpoint.discoveries?.length ? `• Discoveries: ${checkpoint.discoveries.length}` : ''}\n${checkpoint.workspacePath ? `• Workspace: ${checkpoint.workspacePath}` : ''}`);

      // Mark resume as attempted
      await lifecycleManager.markResumeAttempted(taskId, true);

      // Create resume prompt
      const resumePrompt = this.createResumePrompt(dbTask.task_description, checkpoint);

      // Execute the resumed task
      this.executeResumedTask(managedTask, resumePrompt);

      logger.info(`✅ Task ${taskId} resumed successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to resume task ${taskId}:`, error);
      await lifecycleManager.markResumeAttempted(taskId, false);
      return false;
    }
  }

  /**
   * Create a prompt that includes checkpoint context for resume
   */
  private createResumePrompt(originalTask: string, checkpoint: TaskCheckpoint): string {
    const resumeContext = [];

    resumeContext.push(`[RESUME FROM CHECKPOINT ${checkpoint.checkpointNumber}]`);
    resumeContext.push(`Original task: ${originalTask}`);
    resumeContext.push(`Progress: ${checkpoint.iteration} iterations, ${checkpoint.toolCallsCount} tool calls`);

    if (checkpoint.workspacePath) {
      resumeContext.push(`Workspace: ${checkpoint.workspacePath}`);
    }

    if (checkpoint.discoveries?.length) {
      resumeContext.push(`Discoveries so far:\n${checkpoint.discoveries.map(d => `• ${d}`).join('\n')}`);
    }

    if (checkpoint.artifacts) {
      const { files_created, urls_deployed, repos_created } = checkpoint.artifacts;
      if (files_created?.length) {
        resumeContext.push(`Files created: ${files_created.length}`);
      }
      if (urls_deployed?.length) {
        resumeContext.push(`URLs deployed: ${urls_deployed.join(', ')}`);
      }
      if (repos_created?.length) {
        resumeContext.push(`Repos created: ${repos_created.join(', ')}`);
      }
    }

    resumeContext.push(`\nContinue from where you left off. The task was interrupted but your progress has been saved.`);

    return resumeContext.join('\n');
  }

  /**
   * Execute a resumed task
   */
  private async executeResumedTask(managedTask: ManagedTask, resumePrompt: string): Promise<void> {
    const { taskId, agent, task } = managedTask;

    try {
      logger.info(`▶️ Resumed task ${taskId} starting execution...`);

      // Create modified task with resume prompt
      const resumedTask = {
        ...task,
        command: resumePrompt
      };

      const result = await agent.executeTask(resumedTask);

      managedTask.status = result.success ? 'completed' : 'failed';
      managedTask.completedAt = new Date();
      managedTask.result = result;

      if (!result.success) {
        managedTask.error = result.error;
      }

      // Update database
      if (this.pgDb) {
        await this.pgDb.updateAgentTask(taskId, {
          status: managedTask.status,
          result: result.message || (result.success ? 'Task completed (resumed)' : 'Task failed (resumed)'),
          error: managedTask.error,
          iterations: (managedTask.currentIteration || 0) + (result.iterations || 0),
          toolCalls: (managedTask.toolCallCount || 0) + (result.toolCalls || 0),
          completedAt: managedTask.completedAt
        });
      }

      // Clear lifecycle tracking
      getTaskLifecycleManager().clearTaskTracking(taskId);

      logger.info(`${result.success ? '✅' : '❌'} Resumed task ${taskId} ${managedTask.status}`);
    } catch (error) {
      managedTask.status = 'failed';
      managedTask.completedAt = new Date();
      managedTask.error = error instanceof Error ? error.message : 'Unknown error during resume';

      if (this.pgDb) {
        await this.pgDb.updateAgentTask(taskId, {
          status: 'failed',
          completedAt: managedTask.completedAt,
          error: managedTask.error
        });
      }

      logger.error(`❌ Resumed task ${taskId} failed with exception`, error);
    }
  }

  /**
   * Enable or disable automatic task resume on startup
   */
  setAutoResume(enabled: boolean): void {
    this.autoResumeEnabled = enabled;
    logger.info(`Auto-resume ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
