import { logger } from '../utils/logger';
import { PostgresDatabaseService } from './postgresDatabaseService';
import { getAgentFlowDatabase, isUsingPostgres } from './databaseFactory';
import { execSync } from 'child_process';
import * as path from 'path';

/**
 * Workspace information
 */
export interface WorkspaceInfo {
  id?: number;
  taskId: string;
  path: string;
  name: string;
  githubRepoUrl?: string;
  githubRepoName?: string;
  isPrimary: boolean;
  status: 'active' | 'archived' | 'deleted';
  isNew: boolean;  // True if just created
  createdAt?: Date;
}

/**
 * Workspace creation options
 */
export interface WorkspaceCreateOptions {
  preferredName?: string;
  createGitHubRepo?: boolean;
  repoVisibility?: 'public' | 'private';
  forceNew?: boolean;  // Create new even if one exists
}

/**
 * Workspace Registry Configuration
 */
export interface WorkspaceRegistryConfig {
  basePath: string;              // Base path for workspaces
  orphanCleanupHours: number;    // Hours after which orphaned workspaces are cleaned
  maxWorkspacesPerTask: number;  // Max workspaces allowed per task
  hetznerServerIp?: string;      // For remote workspace management
}

const DEFAULT_CONFIG: WorkspaceRegistryConfig = {
  basePath: process.env.WORKSPACE_BASE_PATH || '/opt/agentflow/workspaces',
  orphanCleanupHours: parseInt(process.env.ORPHAN_WORKSPACE_CLEANUP_HOURS || '24'),
  maxWorkspacesPerTask: 3,
  hetznerServerIp: process.env.HETZNER_SERVER_IP || '178.156.198.233'
};

/**
 * WorkspaceRegistry - Manages workspace assignments per task
 *
 * Prevents:
 * - Multiple workspaces created for same task
 * - Workspace name collisions
 * - Orphaned workspaces piling up
 *
 * Provides:
 * - One primary workspace per task
 * - Workspace reuse within same task
 * - Workspace cleanup for failed tasks
 */
export class WorkspaceRegistry {
  private db: PostgresDatabaseService | null = null;
  private config: WorkspaceRegistryConfig;
  private workspaceCache: Map<string, WorkspaceInfo> = new Map();

  constructor(config: Partial<WorkspaceRegistryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (isUsingPostgres()) {
      this.db = getAgentFlowDatabase();
    }
  }

  /**
   * Get or create a workspace for a task
   * Returns existing workspace if one exists, otherwise creates new
   */
  async getOrCreateWorkspace(taskId: string, options: WorkspaceCreateOptions = {}): Promise<WorkspaceInfo> {
    // Check cache first
    const cacheKey = `${taskId}:primary`;
    const cached = this.workspaceCache.get(cacheKey);
    if (cached && !options.forceNew) {
      logger.info(`♻️ Reusing cached workspace for task ${taskId}: ${cached.path}`);
      return { ...cached, isNew: false };
    }

    // Check database for existing workspace
    if (this.db && !options.forceNew) {
      const existing = await this.getTaskWorkspace(taskId);
      if (existing) {
        this.workspaceCache.set(cacheKey, existing);
        logger.info(`♻️ Reusing existing workspace for task ${taskId}: ${existing.path}`);
        return { ...existing, isNew: false };
      }
    }

    // Generate workspace name
    const name = this.generateWorkspaceName(taskId, options.preferredName);
    const workspacePath = path.join(this.config.basePath, name);

    // Check max workspaces limit
    if (this.db) {
      const workspaceCount = await this.getTaskWorkspaceCount(taskId);
      if (workspaceCount >= this.config.maxWorkspacesPerTask) {
        logger.warn(`⚠️ Task ${taskId} has reached max workspaces (${this.config.maxWorkspacesPerTask})`);
        // Return existing primary instead of creating new
        const existing = await this.getTaskWorkspace(taskId);
        if (existing) {
          return { ...existing, isNew: false };
        }
      }
    }

    // Register workspace in database
    const workspace: WorkspaceInfo = {
      taskId,
      path: workspacePath,
      name,
      isPrimary: true,
      status: 'active',
      isNew: true,
      createdAt: new Date()
    };

    if (this.db) {
      try {
        // Mark any existing workspaces as non-primary
        await this.db.query(`
          UPDATE task_workspaces
          SET is_primary = false
          WHERE task_id = $1 AND is_primary = true
        `, [taskId]);

        // Insert new workspace
        const result = await this.db.query(`
          INSERT INTO task_workspaces
            (task_id, workspace_path, workspace_name, is_primary, status)
          VALUES ($1, $2, $3, true, 'active')
          RETURNING id
        `, [taskId, workspacePath, name]);

        workspace.id = result.rows[0]?.id;
      } catch (error) {
        logger.error(`Failed to register workspace in database:`, error);
      }
    }

    // Cache the workspace
    this.workspaceCache.set(cacheKey, workspace);

    logger.info(`📁 Registered new workspace for task ${taskId}: ${workspacePath}`);
    return workspace;
  }

  /**
   * Get existing workspace for a task
   */
  async getTaskWorkspace(taskId: string, primaryOnly: boolean = true): Promise<WorkspaceInfo | null> {
    if (!this.db) return null;

    try {
      const result = await this.db.query(`
        SELECT * FROM task_workspaces
        WHERE task_id = $1 ${primaryOnly ? 'AND is_primary = true' : ''}
        AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `, [taskId]);

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        taskId: row.task_id,
        path: row.workspace_path,
        name: row.workspace_name,
        githubRepoUrl: row.github_repo_url,
        githubRepoName: row.github_repo_name,
        isPrimary: row.is_primary,
        status: row.status,
        isNew: false,
        createdAt: new Date(row.created_at)
      };
    } catch (error) {
      logger.error(`Failed to get workspace for task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Get count of workspaces for a task
   */
  private async getTaskWorkspaceCount(taskId: string): Promise<number> {
    if (!this.db) return 0;

    try {
      const result = await this.db.query(`
        SELECT COUNT(*) as count FROM task_workspaces
        WHERE task_id = $1 AND status = 'active'
      `, [taskId]);
      return parseInt(result.rows[0]?.count || '0');
    } catch {
      return 0;
    }
  }

  /**
   * Generate a unique workspace name
   */
  private generateWorkspaceName(taskId: string, preferredName?: string): string {
    const timestamp = Date.now().toString(36);
    const taskShort = taskId.substring(0, 8);

    if (preferredName) {
      // Sanitize preferred name
      const sanitized = preferredName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);
      return `${sanitized}-${taskShort}`;
    }

    return `workspace-${taskShort}-${timestamp}`;
  }

  /**
   * Register GitHub repo for a workspace
   */
  async registerGitHubRepo(taskId: string, repoUrl: string, repoName?: string): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.query(`
        UPDATE task_workspaces
        SET github_repo_url = $1, github_repo_name = $2, updated_at = NOW()
        WHERE task_id = $3 AND is_primary = true
      `, [repoUrl, repoName || null, taskId]);

      // Update cache
      const cacheKey = `${taskId}:primary`;
      const cached = this.workspaceCache.get(cacheKey);
      if (cached) {
        cached.githubRepoUrl = repoUrl;
        cached.githubRepoName = repoName;
      }

      logger.info(`📝 Registered GitHub repo for task ${taskId}: ${repoUrl}`);
    } catch (error) {
      logger.error(`Failed to register GitHub repo:`, error);
    }
  }

  /**
   * Archive workspace (mark as archived, don't delete)
   */
  async archiveWorkspace(taskId: string, workspacePath?: string): Promise<void> {
    if (!this.db) return;

    try {
      const query = workspacePath
        ? `UPDATE task_workspaces SET status = 'archived', updated_at = NOW() WHERE task_id = $1 AND workspace_path = $2`
        : `UPDATE task_workspaces SET status = 'archived', updated_at = NOW() WHERE task_id = $1`;

      const params = workspacePath ? [taskId, workspacePath] : [taskId];
      await this.db.query(query, params);

      // Clear cache
      this.workspaceCache.delete(`${taskId}:primary`);

      logger.info(`📦 Archived workspace(s) for task ${taskId}`);
    } catch (error) {
      logger.error(`Failed to archive workspace:`, error);
    }
  }

  /**
   * Get all orphaned workspaces (failed tasks > N hours old)
   */
  async getOrphanedWorkspaces(): Promise<WorkspaceInfo[]> {
    if (!this.db) return [];

    try {
      const result = await this.db.query(`
        SELECT tw.* FROM task_workspaces tw
        LEFT JOIN agent_tasks at ON tw.task_id = at.agent_id
        WHERE at.status = 'failed'
          AND at.completed_at < NOW() - INTERVAL '${this.config.orphanCleanupHours} hours'
          AND tw.status = 'active'
      `);

      return result.rows.map((row: Record<string, any>) => ({
        id: row.id,
        taskId: row.task_id,
        path: row.workspace_path,
        name: row.workspace_name,
        githubRepoUrl: row.github_repo_url,
        githubRepoName: row.github_repo_name,
        isPrimary: row.is_primary,
        status: row.status,
        isNew: false,
        createdAt: new Date(row.created_at)
      }));
    } catch (error) {
      logger.error('Failed to get orphaned workspaces:', error);
      return [];
    }
  }

  /**
   * Cleanup orphaned workspaces
   */
  async cleanupOrphanedWorkspaces(): Promise<{ cleaned: number; errors: number }> {
    const orphaned = await this.getOrphanedWorkspaces();
    let cleaned = 0;
    let errors = 0;

    for (const workspace of orphaned) {
      try {
        // Delete workspace directory on Hetzner
        await this.deleteWorkspaceDirectory(workspace.path);

        // Mark as deleted in database
        if (this.db) {
          await this.db.query(`
            UPDATE task_workspaces SET status = 'deleted', updated_at = NOW()
            WHERE id = $1
          `, [workspace.id]);
        }

        cleaned++;
        logger.info(`🗑️ Cleaned up orphaned workspace: ${workspace.path}`);
      } catch (error) {
        errors++;
        logger.error(`Failed to cleanup workspace ${workspace.path}:`, error);
      }
    }

    logger.info(`🧹 Workspace cleanup complete: ${cleaned} cleaned, ${errors} errors`);
    return { cleaned, errors };
  }

  /**
   * Delete workspace directory (on Hetzner VPS)
   */
  private async deleteWorkspaceDirectory(workspacePath: string): Promise<void> {
    // Safety check: only delete from expected base path
    if (!workspacePath.startsWith(this.config.basePath)) {
      throw new Error(`Refusing to delete workspace outside base path: ${workspacePath}`);
    }

    try {
      // For remote workspaces on Hetzner
      if (this.config.hetznerServerIp) {
        const cmd = `ssh root@${this.config.hetznerServerIp} "rm -rf '${workspacePath}'"`;
        execSync(cmd, { timeout: 30000 });
      } else {
        // For local workspaces
        const { rmSync } = await import('fs');
        rmSync(workspacePath, { recursive: true, force: true });
      }
    } catch (error) {
      logger.error(`Failed to delete workspace directory ${workspacePath}:`, error);
      throw error;
    }
  }

  /**
   * Get all workspaces for a task
   */
  async getAllTaskWorkspaces(taskId: string): Promise<WorkspaceInfo[]> {
    if (!this.db) return [];

    try {
      const result = await this.db.query(`
        SELECT * FROM task_workspaces
        WHERE task_id = $1
        ORDER BY is_primary DESC, created_at DESC
      `, [taskId]);

      return result.rows.map((row: Record<string, any>) => ({
        id: row.id,
        taskId: row.task_id,
        path: row.workspace_path,
        name: row.workspace_name,
        githubRepoUrl: row.github_repo_url,
        githubRepoName: row.github_repo_name,
        isPrimary: row.is_primary,
        status: row.status,
        isNew: false,
        createdAt: new Date(row.created_at)
      }));
    } catch (error) {
      logger.error(`Failed to get workspaces for task ${taskId}:`, error);
      return [];
    }
  }

  /**
   * Clear workspace cache for a task
   */
  clearCache(taskId?: string): void {
    if (taskId) {
      this.workspaceCache.delete(`${taskId}:primary`);
    } else {
      this.workspaceCache.clear();
    }
  }

  /**
   * Check if workspace exists on filesystem
   */
  async workspaceExists(workspacePath: string): Promise<boolean> {
    try {
      if (this.config.hetznerServerIp) {
        const cmd = `ssh root@${this.config.hetznerServerIp} "test -d '${workspacePath}' && echo 'exists'"`;
        const result = execSync(cmd, { timeout: 10000, encoding: 'utf-8' });
        return result.trim() === 'exists';
      } else {
        const { existsSync } = await import('fs');
        return existsSync(workspacePath);
      }
    } catch {
      return false;
    }
  }
}

// Singleton instance
let workspaceRegistryInstance: WorkspaceRegistry | null = null;

export function getWorkspaceRegistry(): WorkspaceRegistry {
  if (!workspaceRegistryInstance) {
    workspaceRegistryInstance = new WorkspaceRegistry();
  }
  return workspaceRegistryInstance;
}

export function initializeWorkspaceRegistry(config?: Partial<WorkspaceRegistryConfig>): WorkspaceRegistry {
  workspaceRegistryInstance = new WorkspaceRegistry(config);
  return workspaceRegistryInstance;
}
