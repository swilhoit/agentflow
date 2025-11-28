import { logger } from '../utils/logger';
import { PostgresDatabaseService } from './postgresDatabaseService';
import { getAgentFlowDatabase, isUsingPostgres } from './databaseFactory';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Task checkpoint data structure
 */
export interface TaskCheckpoint {
  id?: number;
  taskId: string;
  checkpointNumber: number;
  phaseId?: string;
  phaseName?: string;
  iteration: number;
  toolCallsCount: number;
  conversationContext: any[];
  workspacePath?: string;
  discoveries: string[];
  artifacts: {
    files_created: string[];
    urls_deployed: string[];
    repos_created: string[];
  };
  memoryState?: {
    toolCallHistory: any[];
    failedAttempts: any[];
    pivots: any[];
    completedPhases: string[];
  };
  createdAt: Date;
}

/**
 * Resume check result
 */
export interface ResumeCheckResult {
  canResume: boolean;
  checkpoint?: TaskCheckpoint;
  reason?: string;
}

/**
 * Task interruption record
 */
export interface TaskInterruption {
  taskId: string;
  interruptReason: string;
  interruptSignal?: string;
  checkpointId?: number;
  isResumable: boolean;
}

/**
 * Configuration for TaskLifecycleManager
 */
export interface TaskLifecycleConfig {
  checkpointIntervalIterations: number;  // How often to checkpoint
  maxCheckpointAge: number;              // Max age in ms for valid checkpoint
  maxCheckpointsPerTask: number;         // Keep last N checkpoints
  autoCheckpointOnToolCall: boolean;     // Checkpoint after significant tool calls
}

const DEFAULT_CONFIG: TaskLifecycleConfig = {
  checkpointIntervalIterations: parseInt(process.env.CHECKPOINT_INTERVAL_ITERATIONS || '10'),
  maxCheckpointAge: parseInt(process.env.MAX_CHECKPOINT_AGE_MS || '3600000'),  // 1 hour
  maxCheckpointsPerTask: 5,
  autoCheckpointOnToolCall: true
};

/**
 * TaskLifecycleManager - Manages task checkpointing and recovery
 *
 * Provides:
 * - Periodic checkpointing of task state
 * - Recovery from checkpoints after restart
 * - Interruption tracking and resume capability
 */
export class TaskLifecycleManager {
  private db: PostgresDatabaseService | null = null;
  private config: TaskLifecycleConfig;
  private activeCheckpoints: Map<string, TaskCheckpoint> = new Map();
  private lastCheckpointIteration: Map<string, number> = new Map();

  constructor(config: Partial<TaskLifecycleConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (isUsingPostgres()) {
      this.db = getAgentFlowDatabase();
    }
  }

  /**
   * Initialize database tables if needed
   */
  async initialize(): Promise<void> {
    if (!this.db) {
      logger.warn('TaskLifecycleManager: PostgreSQL not available, checkpointing disabled');
      return;
    }

    try {
      // Run migration
      const migrationPath = path.join(__dirname, '../migrations/001_reliability_tables.sql');
      if (fs.existsSync(migrationPath)) {
        const migration = fs.readFileSync(migrationPath, 'utf-8');
        await this.db.query(migration);
        logger.info('✅ TaskLifecycleManager: Database tables initialized');
      }
    } catch (error) {
      logger.error('TaskLifecycleManager: Failed to initialize tables:', error);
    }
  }

  /**
   * Check if it's time to create a checkpoint
   */
  shouldCheckpoint(taskId: string, currentIteration: number): boolean {
    const lastCheckpoint = this.lastCheckpointIteration.get(taskId) || 0;
    return (currentIteration - lastCheckpoint) >= this.config.checkpointIntervalIterations;
  }

  /**
   * Create a checkpoint for a task
   */
  async createCheckpoint(taskId: string, state: {
    phaseId?: string;
    phaseName?: string;
    iteration: number;
    toolCallsCount: number;
    conversationContext: any[];
    workspacePath?: string;
    discoveries: string[];
    artifacts: {
      files_created: string[];
      urls_deployed: string[];
      repos_created: string[];
    };
    memoryState?: {
      toolCallHistory: any[];
      failedAttempts: any[];
      pivots: any[];
      completedPhases: string[];
    };
  }): Promise<number | null> {
    if (!this.db) {
      logger.debug('TaskLifecycleManager: Skipping checkpoint (no DB)');
      return null;
    }

    try {
      const checkpointNumber = await this.getNextCheckpointNumber(taskId);

      const result = await this.db.query(`
        INSERT INTO task_checkpoints
          (task_id, checkpoint_number, phase_id, phase_name, iteration,
           tool_calls_count, conversation_context, workspace_path,
           discoveries, artifacts, memory_state)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `, [
        taskId,
        checkpointNumber,
        state.phaseId || null,
        state.phaseName || null,
        state.iteration,
        state.toolCallsCount,
        JSON.stringify(this.truncateConversationContext(state.conversationContext)),
        state.workspacePath || null,
        state.discoveries,
        JSON.stringify(state.artifacts),
        state.memoryState ? JSON.stringify(state.memoryState) : null
      ]);

      const checkpointId = result.rows[0]?.id;

      // Update tracking
      this.lastCheckpointIteration.set(taskId, state.iteration);

      // Cache the checkpoint
      const checkpoint: TaskCheckpoint = {
        id: checkpointId,
        taskId,
        checkpointNumber,
        ...state,
        createdAt: new Date()
      };
      this.activeCheckpoints.set(taskId, checkpoint);

      // Update agent_tasks with checkpoint reference
      await this.db.query(`
        UPDATE agent_tasks
        SET last_checkpoint_id = $1, workspace_path = $2, artifacts = $3
        WHERE agent_id = $4
      `, [checkpointId, state.workspacePath, JSON.stringify(state.artifacts), taskId]);

      logger.info(`💾 Checkpoint ${checkpointNumber} created for task ${taskId} (iteration ${state.iteration})`);

      // Cleanup old checkpoints
      await this.cleanupOldCheckpoints(taskId);

      return checkpointId;
    } catch (error) {
      logger.error(`Failed to create checkpoint for task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Truncate conversation context to prevent huge checkpoints
   */
  private truncateConversationContext(context: any[]): any[] {
    if (!context || context.length === 0) return [];

    // Keep first message (system prompt) and last 20 messages
    const maxMessages = 20;
    if (context.length <= maxMessages + 1) {
      return context;
    }

    const truncated = [
      context[0],  // Keep system prompt
      {
        role: 'user',
        content: `[CHECKPOINT: ${context.length - maxMessages - 1} messages truncated]`
      },
      ...context.slice(-maxMessages)
    ];

    return truncated;
  }

  /**
   * Get the next checkpoint number for a task
   */
  private async getNextCheckpointNumber(taskId: string): Promise<number> {
    if (!this.db) return 1;

    const result = await this.db.query(`
      SELECT COALESCE(MAX(checkpoint_number), 0) + 1 as next_num
      FROM task_checkpoints
      WHERE task_id = $1
    `, [taskId]);

    return result.rows[0]?.next_num || 1;
  }

  /**
   * Cleanup old checkpoints, keeping only the last N
   */
  private async cleanupOldCheckpoints(taskId: string): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.query(`
        DELETE FROM task_checkpoints
        WHERE task_id = $1
        AND checkpoint_number NOT IN (
          SELECT checkpoint_number FROM task_checkpoints
          WHERE task_id = $1
          ORDER BY checkpoint_number DESC
          LIMIT $2
        )
      `, [taskId, this.config.maxCheckpointsPerTask]);
    } catch (error) {
      logger.error(`Failed to cleanup old checkpoints for ${taskId}:`, error);
    }
  }

  /**
   * Get the latest checkpoint for a task
   */
  async getLatestCheckpoint(taskId: string): Promise<TaskCheckpoint | null> {
    // Check cache first
    const cached = this.activeCheckpoints.get(taskId);
    if (cached) return cached;

    if (!this.db) return null;

    try {
      const result = await this.db.query(`
        SELECT * FROM task_checkpoints
        WHERE task_id = $1
        ORDER BY checkpoint_number DESC
        LIMIT 1
      `, [taskId]);

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        taskId: row.task_id,
        checkpointNumber: row.checkpoint_number,
        phaseId: row.phase_id,
        phaseName: row.phase_name,
        iteration: row.iteration,
        toolCallsCount: row.tool_calls_count,
        conversationContext: row.conversation_context || [],
        workspacePath: row.workspace_path,
        discoveries: row.discoveries || [],
        artifacts: row.artifacts || { files_created: [], urls_deployed: [], repos_created: [] },
        memoryState: row.memory_state,
        createdAt: new Date(row.created_at)
      };
    } catch (error) {
      logger.error(`Failed to get checkpoint for task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Check if a task can be resumed from checkpoint
   */
  async canResumeTask(taskId: string): Promise<ResumeCheckResult> {
    const checkpoint = await this.getLatestCheckpoint(taskId);

    if (!checkpoint) {
      return { canResume: false, reason: 'No checkpoint found' };
    }

    // Check checkpoint age
    const ageMs = Date.now() - checkpoint.createdAt.getTime();
    if (ageMs > this.config.maxCheckpointAge) {
      return {
        canResume: false,
        reason: `Checkpoint too old (${Math.round(ageMs / 60000)} minutes)`,
        checkpoint
      };
    }

    // Check if workspace still exists
    if (checkpoint.workspacePath) {
      const workspaceExists = await this.checkWorkspaceExists(checkpoint.workspacePath);
      if (!workspaceExists) {
        return {
          canResume: false,
          reason: 'Workspace no longer exists',
          checkpoint
        };
      }
    }

    // Check if we have meaningful progress to resume
    if (checkpoint.iteration < 3 && checkpoint.toolCallsCount < 2) {
      return {
        canResume: false,
        reason: 'Insufficient progress to resume (better to restart)',
        checkpoint
      };
    }

    return { canResume: true, checkpoint };
  }

  /**
   * Check if a workspace path exists (on Hetzner VPS or locally)
   */
  private async checkWorkspaceExists(workspacePath: string): Promise<boolean> {
    try {
      // For local paths
      if (fs.existsSync(workspacePath)) {
        return true;
      }

      // For remote paths (Hetzner), we assume they exist if path starts with /opt/agentflow
      if (workspacePath.startsWith('/opt/agentflow/workspaces/')) {
        // TODO: SSH check to Hetzner if needed
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Record a task interruption
   */
  async recordInterruption(interruption: TaskInterruption): Promise<void> {
    if (!this.db) return;

    try {
      // Get latest checkpoint ID
      const checkpoint = await this.getLatestCheckpoint(interruption.taskId);

      await this.db.query(`
        INSERT INTO task_interruptions
          (task_id, interrupt_reason, interrupt_signal, checkpoint_id, is_resumable)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        interruption.taskId,
        interruption.interruptReason,
        interruption.interruptSignal || null,
        checkpoint?.id || null,
        interruption.isResumable
      ]);

      // Update agent_tasks
      await this.db.query(`
        UPDATE agent_tasks
        SET is_resumable = $1
        WHERE agent_id = $2
      `, [interruption.isResumable, interruption.taskId]);

      logger.info(`📝 Recorded interruption for task ${interruption.taskId} (resumable: ${interruption.isResumable})`);
    } catch (error) {
      logger.error(`Failed to record interruption for ${interruption.taskId}:`, error);
    }
  }

  /**
   * Mark a task resume as attempted
   */
  async markResumeAttempted(taskId: string, succeeded: boolean): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.query(`
        UPDATE task_interruptions
        SET resume_attempted = true, resume_succeeded = $1, resumed_at = NOW()
        WHERE task_id = $2
        AND id = (SELECT MAX(id) FROM task_interruptions WHERE task_id = $2)
      `, [succeeded, taskId]);
    } catch (error) {
      logger.error(`Failed to mark resume attempt for ${taskId}:`, error);
    }
  }

  /**
   * Get all resumable interrupted tasks
   */
  async getResumableTasks(): Promise<Array<{
    taskId: string;
    checkpoint: TaskCheckpoint;
    interruptReason: string;
  }>> {
    if (!this.db) return [];

    try {
      const result = await this.db.query(`
        SELECT DISTINCT ON (at.agent_id)
          at.agent_id as task_id,
          at.task_description,
          ti.interrupt_reason,
          ti.created_at as interrupted_at
        FROM agent_tasks at
        JOIN task_interruptions ti ON at.agent_id = ti.task_id
        WHERE at.is_resumable = true
          AND at.status IN ('failed', 'running')
          AND ti.resume_attempted = false
        ORDER BY at.agent_id, ti.created_at DESC
      `);

      const resumableTasks = [];
      for (const row of result.rows) {
        const checkpoint = await this.getLatestCheckpoint(row.task_id);
        if (checkpoint) {
          const canResume = await this.canResumeTask(row.task_id);
          if (canResume.canResume) {
            resumableTasks.push({
              taskId: row.task_id,
              checkpoint,
              interruptReason: row.interrupt_reason
            });
          }
        }
      }

      return resumableTasks;
    } catch (error) {
      logger.error('Failed to get resumable tasks:', error);
      return [];
    }
  }

  /**
   * Clear checkpoint tracking for a completed task
   */
  clearTaskTracking(taskId: string): void {
    this.activeCheckpoints.delete(taskId);
    this.lastCheckpointIteration.delete(taskId);
  }

  /**
   * Get active checkpoint for a task (from cache)
   */
  getActiveCheckpoint(taskId: string): TaskCheckpoint | undefined {
    return this.activeCheckpoints.get(taskId);
  }
}

// Singleton instance
let lifecycleManagerInstance: TaskLifecycleManager | null = null;

export function getTaskLifecycleManager(): TaskLifecycleManager {
  if (!lifecycleManagerInstance) {
    lifecycleManagerInstance = new TaskLifecycleManager();
  }
  return lifecycleManagerInstance;
}

export function initializeTaskLifecycleManager(config?: Partial<TaskLifecycleConfig>): TaskLifecycleManager {
  lifecycleManagerInstance = new TaskLifecycleManager(config);
  return lifecycleManagerInstance;
}
