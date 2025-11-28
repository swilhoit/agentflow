import { logger } from '../utils/logger';
import { getTaskLifecycleManager, TaskCheckpoint } from './taskLifecycleManager';
import { EventEmitter } from 'events';

/**
 * Running task information for shutdown handling
 */
export interface RunningTask {
  taskId: string;
  channelId: string;
  guildId?: string;
  currentPhase?: string;
  currentIteration: number;
  toolCallCount: number;
  workspacePath?: string;
  discoveries: string[];
  artifacts: {
    files_created: string[];
    urls_deployed: string[];
    repos_created: string[];
  };
  conversationHistory: any[];
  memoryState?: any;
}

/**
 * Task provider interface - TaskManager must implement this
 */
export interface TaskProvider {
  getRunningTasks(): RunningTask[];
  markTaskInterrupted(taskId: string, reason: string, resumable: boolean): Promise<void>;
  markTaskFailed(taskId: string, error: string): Promise<void>;
  notify(channelId: string, message: string): Promise<void>;
}

/**
 * Shutdown handler configuration
 */
export interface ShutdownConfig {
  timeoutMs: number;          // Max time to wait for checkpointing
  notifyUsers: boolean;       // Send Discord notifications about interrupted tasks
  forceKillAfterTimeout: boolean;  // Kill process after timeout even if tasks still running
}

const DEFAULT_CONFIG: ShutdownConfig = {
  timeoutMs: parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '30000'),  // 30 seconds
  notifyUsers: true,
  forceKillAfterTimeout: true
};

/**
 * GracefulShutdownHandler - Properly checkpoints tasks before shutdown
 *
 * When a shutdown signal is received:
 * 1. Stop accepting new tasks
 * 2. Checkpoint all running tasks
 * 3. Mark tasks as interrupted (but resumable)
 * 4. Notify users via Discord
 * 5. Allow dependent services to stop
 * 6. Exit process
 */
export class GracefulShutdownHandler extends EventEmitter {
  private shutdownInProgress = false;
  private taskProvider: TaskProvider | null = null;
  private config: ShutdownConfig;
  private shutdownCallbacks: Array<() => Promise<void>> = [];

  constructor(config: Partial<ShutdownConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set the task provider (TaskManager)
   */
  setTaskProvider(provider: TaskProvider): void {
    this.taskProvider = provider;
  }

  /**
   * Register a callback to run during shutdown (for cleanup)
   */
  onShutdown(callback: () => Promise<void>): void {
    this.shutdownCallbacks.push(callback);
  }

  /**
   * Check if shutdown is in progress
   */
  isShuttingDown(): boolean {
    return this.shutdownInProgress;
  }

  /**
   * Initiate graceful shutdown
   */
  async initiateShutdown(signal: string): Promise<void> {
    if (this.shutdownInProgress) {
      logger.warn('Shutdown already in progress, ignoring duplicate signal');
      return;
    }
    this.shutdownInProgress = true;

    logger.info(`\n${'═'.repeat(60)}`);
    logger.info(`🛑 GRACEFUL SHUTDOWN INITIATED (${signal})`);
    logger.info(`${'═'.repeat(60)}`);

    this.emit('shutdown:started', signal);

    // Get all running tasks
    const runningTasks = this.taskProvider?.getRunningTasks() || [];

    if (runningTasks.length === 0) {
      logger.info('✅ No running tasks - proceeding with immediate shutdown');
      await this.executeShutdownCallbacks();
      this.emit('shutdown:complete');
      return;
    }

    logger.info(`⏳ Found ${runningTasks.length} running task(s) - creating checkpoints...`);

    // Set up timeout
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        logger.warn(`⚠️ Shutdown timeout reached (${this.config.timeoutMs}ms)`);
        resolve();
      }, this.config.timeoutMs);
    });

    // Checkpoint all tasks
    const checkpointPromise = this.checkpointAllTasks(runningTasks, signal);

    // Wait for checkpoints or timeout
    await Promise.race([checkpointPromise, timeoutPromise]);

    // Execute shutdown callbacks
    await this.executeShutdownCallbacks();

    logger.info('✅ Graceful shutdown complete');
    this.emit('shutdown:complete');
  }

  /**
   * Checkpoint all running tasks
   */
  private async checkpointAllTasks(tasks: RunningTask[], signal: string): Promise<void> {
    const lifecycleManager = getTaskLifecycleManager();
    const results: Array<{ taskId: string; success: boolean; error?: string }> = [];

    await Promise.all(tasks.map(async (task) => {
      try {
        // Create checkpoint
        const checkpointId = await lifecycleManager.createCheckpoint(task.taskId, {
          phaseId: task.currentPhase,
          iteration: task.currentIteration,
          toolCallsCount: task.toolCallCount,
          conversationContext: task.conversationHistory,
          workspacePath: task.workspacePath,
          discoveries: task.discoveries,
          artifacts: task.artifacts,
          memoryState: task.memoryState
        });

        // Record interruption
        await lifecycleManager.recordInterruption({
          taskId: task.taskId,
          interruptReason: `Shutdown signal: ${signal}`,
          interruptSignal: signal,
          checkpointId: checkpointId || undefined,
          isResumable: checkpointId !== null
        });

        // Mark task as interrupted in TaskManager
        if (this.taskProvider) {
          await this.taskProvider.markTaskInterrupted(
            task.taskId,
            `Shutdown signal: ${signal}`,
            checkpointId !== null
          );
        }

        results.push({ taskId: task.taskId, success: true });
        logger.info(`✅ Checkpointed task ${task.taskId}`);

        // Notify user
        if (this.config.notifyUsers && this.taskProvider) {
          await this.notifyTaskInterrupted(task, signal, checkpointId !== null);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.push({ taskId: task.taskId, success: false, error: errorMsg });
        logger.error(`❌ Failed to checkpoint task ${task.taskId}: ${errorMsg}`);

        // Mark as failed if checkpoint fails
        if (this.taskProvider) {
          await this.taskProvider.markTaskFailed(
            task.taskId,
            `Failed to checkpoint during shutdown: ${errorMsg}`
          );
        }
      }
    }));

    // Log summary
    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    logger.info(`📊 Checkpoint summary: ${succeeded} succeeded, ${failed} failed`);
  }

  /**
   * Notify user about interrupted task
   */
  private async notifyTaskInterrupted(task: RunningTask, signal: string, resumable: boolean): Promise<void> {
    if (!this.taskProvider) return;

    const message = resumable
      ? `⏸️ **Task Paused**
Your task was interrupted due to system maintenance.

**Task ID:** \`${task.taskId}\`
**Progress:** ${task.currentIteration} iterations, ${task.toolCallCount} tool calls
**Status:** ✅ **Resumable** - The system will attempt to resume when it restarts.

${task.discoveries.length > 0 ? `**Discoveries so far:**\n${task.discoveries.slice(-3).map(d => `• ${d}`).join('\n')}` : ''}
${task.artifacts.files_created.length > 0 ? `**Files created:** ${task.artifacts.files_created.length}` : ''}`
      : `⏹️ **Task Stopped**
Your task was interrupted and cannot be resumed.

**Task ID:** \`${task.taskId}\`
**Reason:** ${signal}

Please restart the task manually when the system is back online.`;

    try {
      await this.taskProvider.notify(task.channelId, message);
    } catch (error) {
      logger.error(`Failed to notify user about interrupted task ${task.taskId}:`, error);
    }
  }

  /**
   * Execute all registered shutdown callbacks
   */
  private async executeShutdownCallbacks(): Promise<void> {
    logger.info(`🔄 Executing ${this.shutdownCallbacks.length} shutdown callbacks...`);

    for (const callback of this.shutdownCallbacks) {
      try {
        await callback();
      } catch (error) {
        logger.error('Shutdown callback failed:', error);
      }
    }
  }
}

// Singleton instance
let shutdownHandlerInstance: GracefulShutdownHandler | null = null;

export function getGracefulShutdownHandler(): GracefulShutdownHandler {
  if (!shutdownHandlerInstance) {
    shutdownHandlerInstance = new GracefulShutdownHandler();
  }
  return shutdownHandlerInstance;
}

export function initializeGracefulShutdown(config?: Partial<ShutdownConfig>): GracefulShutdownHandler {
  shutdownHandlerInstance = new GracefulShutdownHandler(config);
  return shutdownHandlerInstance;
}

/**
 * Install shutdown handlers for SIGINT and SIGTERM
 */
export function installShutdownHandlers(
  handler: GracefulShutdownHandler,
  exitProcess: boolean = true
): void {
  const handleSignal = async (signal: string) => {
    await handler.initiateShutdown(signal);
    if (exitProcess) {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));

  logger.info('✅ Graceful shutdown handlers installed');
}
