import { getSQLiteDatabase } from './databaseFactory';
import { logger } from '../utils/logger';
import type { VercelDeployment, VercelProject, DeploymentState } from './vercelMonitor';

/**
 * Database schema for Vercel deployment tracking
 */

export interface StoredProject {
  id: number;
  project_id: string;
  name: string;
  account_id: string;
  framework?: string;
  git_repo?: string;
  git_type?: string;
  created_at: Date;
  updated_at: Date;
}

export interface StoredDeployment {
  id: number;
  deployment_id: string;
  project_id: string;
  project_name: string;
  url: string;
  state: DeploymentState;
  deployment_type: string;
  target?: string;
  created_at: Date;
  building_at?: Date;
  ready_at?: Date;
  
  // Git information
  commit_sha?: string;
  commit_ref?: string;
  commit_message?: string;
  commit_author?: string;
  commit_author_login?: string;
  git_repo?: string;
  
  // Creator info
  creator_uid: string;
  creator_email?: string;
  creator_username?: string;
  
  // Error details
  alias_error_code?: string;
  alias_error_message?: string;
  
  // Metadata
  duration_ms?: number;
  raw_data: string; // JSON of full deployment object
  
  // Tracking
  first_seen_at: Date;
  last_checked_at: Date;
  updated_at: Date;
}

export interface StoredDeploymentAlert {
  id: number;
  deployment_id: string;
  project_name: string;
  deployment_state: DeploymentState;
  alerted_at: Date;
  error_details?: string;
  deployment_url: string;
  discord_message_id?: string;
  discord_channel_id?: string;
}

export interface DeploymentStats {
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  canceledDeployments: number;
  buildingDeployments: number;
  averageDuration?: number;
  successRate: number;
  lastDeploymentAt?: Date;
}

/**
 * Vercel Database Service
 * Manages all database operations for Vercel deployment tracking
 */
export class VercelDatabaseService {
  constructor() {
    this.initializeDatabase();
  }

  /**
   * Initialize database schema
   */
  private initializeDatabase(): void {
    const db = getSQLiteDatabase().getRawDatabase();

    // Projects table
    db.exec(`
      CREATE TABLE IF NOT EXISTS vercel_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        account_id TEXT NOT NULL,
        framework TEXT,
        git_repo TEXT,
        git_type TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_vercel_projects_project_id ON vercel_projects(project_id);
      CREATE INDEX IF NOT EXISTS idx_vercel_projects_name ON vercel_projects(name);
    `);

    // Deployments table - comprehensive storage of all deployment data
    db.exec(`
      CREATE TABLE IF NOT EXISTS vercel_deployments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deployment_id TEXT UNIQUE NOT NULL,
        project_id TEXT NOT NULL,
        project_name TEXT NOT NULL,
        url TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('BUILDING', 'ERROR', 'INITIALIZING', 'QUEUED', 'READY', 'CANCELED')),
        deployment_type TEXT NOT NULL,
        target TEXT,
        created_at DATETIME NOT NULL,
        building_at DATETIME,
        ready_at DATETIME,
        
        -- Git information
        commit_sha TEXT,
        commit_ref TEXT,
        commit_message TEXT,
        commit_author TEXT,
        commit_author_login TEXT,
        git_repo TEXT,
        
        -- Creator info
        creator_uid TEXT NOT NULL,
        creator_email TEXT,
        creator_username TEXT,
        
        -- Error details
        alias_error_code TEXT,
        alias_error_message TEXT,
        
        -- Metadata
        duration_ms INTEGER,
        raw_data TEXT NOT NULL,
        
        -- Tracking
        first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (project_id) REFERENCES vercel_projects(project_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_vercel_deployments_deployment_id ON vercel_deployments(deployment_id);
      CREATE INDEX IF NOT EXISTS idx_vercel_deployments_project_id ON vercel_deployments(project_id);
      CREATE INDEX IF NOT EXISTS idx_vercel_deployments_state ON vercel_deployments(state);
      CREATE INDEX IF NOT EXISTS idx_vercel_deployments_created_at ON vercel_deployments(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_vercel_deployments_project_state ON vercel_deployments(project_id, state);
    `);

    // Deployment alerts table - tracks which deployments we've alerted on
    db.exec(`
      CREATE TABLE IF NOT EXISTS vercel_deployment_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deployment_id TEXT UNIQUE NOT NULL,
        project_name TEXT NOT NULL,
        deployment_state TEXT NOT NULL,
        alerted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        error_details TEXT,
        deployment_url TEXT NOT NULL,
        discord_message_id TEXT,
        discord_channel_id TEXT,
        
        FOREIGN KEY (deployment_id) REFERENCES vercel_deployments(deployment_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_vercel_alerts_deployment_id ON vercel_deployment_alerts(deployment_id);
      CREATE INDEX IF NOT EXISTS idx_vercel_alerts_alerted_at ON vercel_deployment_alerts(alerted_at DESC);
    `);

    logger.info('✅ Vercel database schema initialized');
  }

  /**
   * Store or update a project
   */
  storeProject(project: VercelProject): void {
    const db = getSQLiteDatabase().getRawDatabase();

    const stmt = db.prepare(`
      INSERT INTO vercel_projects (project_id, name, account_id, framework, git_repo, git_type, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(project_id) DO UPDATE SET
        name = excluded.name,
        framework = excluded.framework,
        git_repo = excluded.git_repo,
        git_type = excluded.git_type,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      project.id,
      project.name,
      project.accountId,
      project.framework || null,
      project.gitRepository?.repo || null,
      project.gitRepository?.type || null
    );
  }

  /**
   * Store or update a deployment (DATABASE FIRST!)
   */
  storeDeployment(deployment: VercelDeployment, projectName: string): void {
    const db = getSQLiteDatabase().getRawDatabase();

    const duration = deployment.ready && deployment.buildingAt
      ? deployment.ready - deployment.buildingAt
      : deployment.buildingAt
        ? Date.now() - deployment.buildingAt
        : null;

    const stmt = db.prepare(`
      INSERT INTO vercel_deployments (
        deployment_id, project_id, project_name, url, state, deployment_type, target,
        created_at, building_at, ready_at,
        commit_sha, commit_ref, commit_message, commit_author, commit_author_login, git_repo,
        creator_uid, creator_email, creator_username,
        alias_error_code, alias_error_message,
        duration_ms, raw_data, last_checked_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(deployment_id) DO UPDATE SET
        state = excluded.state,
        url = excluded.url,
        building_at = COALESCE(excluded.building_at, building_at),
        ready_at = COALESCE(excluded.ready_at, ready_at),
        alias_error_code = COALESCE(excluded.alias_error_code, alias_error_code),
        alias_error_message = COALESCE(excluded.alias_error_message, alias_error_message),
        duration_ms = COALESCE(excluded.duration_ms, duration_ms),
        raw_data = excluded.raw_data,
        last_checked_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      deployment.uid,
      deployment.name, // This is actually the project ID in Vercel API
      projectName,
      deployment.url,
      deployment.state,
      deployment.type,
      deployment.target || null,
      new Date(deployment.created).toISOString(),
      deployment.buildingAt ? new Date(deployment.buildingAt).toISOString() : null,
      deployment.ready ? new Date(deployment.ready).toISOString() : null,
      deployment.meta?.githubCommitSha || null,
      deployment.meta?.githubCommitRef || null,
      deployment.meta?.githubCommitMessage || null,
      deployment.meta?.githubCommitAuthorName || null,
      deployment.meta?.githubCommitAuthorLogin || null,
      deployment.meta?.githubRepo || null,
      deployment.creator.uid,
      deployment.creator.email || null,
      deployment.creator.username || null,
      deployment.aliasError?.code || null,
      deployment.aliasError?.message || null,
      duration,
      JSON.stringify(deployment)
    );
  }

  /**
   * Get deployment by ID from database
   */
  getDeployment(deploymentId: string): StoredDeployment | null {
    const db = getSQLiteDatabase().getRawDatabase();
    
    const stmt = db.prepare(`
      SELECT * FROM vercel_deployments WHERE deployment_id = ?
    `);
    
    const row = stmt.get(deploymentId) as any;
    
    if (!row) return null;
    
    return this.mapRowToDeployment(row);
  }

  /**
   * Get recent deployments for a project
   */
  getProjectDeployments(projectId: string, limit: number = 10): StoredDeployment[] {
    const db = getSQLiteDatabase().getRawDatabase();
    
    const stmt = db.prepare(`
      SELECT * FROM vercel_deployments 
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    
    const rows = stmt.all(projectId, limit) as any[];
    return rows.map(row => this.mapRowToDeployment(row));
  }

  /**
   * Get failed deployments that haven't been alerted on yet
   */
  getUnalertedFailures(since?: Date): StoredDeployment[] {
    const db = getSQLiteDatabase().getRawDatabase();
    
    let query = `
      SELECT d.* FROM vercel_deployments d
      LEFT JOIN vercel_deployment_alerts a ON d.deployment_id = a.deployment_id
      WHERE (d.state = 'ERROR' OR d.state = 'CANCELED')
      AND a.id IS NULL
    `;
    
    const params: any[] = [];
    
    if (since) {
      query += ` AND d.created_at > ?`;
      params.push(since.toISOString());
    }
    
    query += ` ORDER BY d.created_at DESC`;
    
    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as any[];
    
    return rows.map(row => this.mapRowToDeployment(row));
  }

  /**
   * Record that we've alerted on a deployment
   */
  recordAlert(
    deploymentId: string,
    projectName: string,
    state: DeploymentState,
    errorDetails: string | null,
    deploymentUrl: string,
    discordMessageId?: string,
    discordChannelId?: string
  ): void {
    const db = getSQLiteDatabase().getRawDatabase();
    
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO vercel_deployment_alerts 
        (deployment_id, project_name, deployment_state, error_details, deployment_url, discord_message_id, discord_channel_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      deploymentId,
      projectName,
      state,
      errorDetails,
      deploymentUrl,
      discordMessageId || null,
      discordChannelId || null
    );
  }

  /**
   * Get deployment statistics for a project
   */
  getProjectStats(projectId: string, daysBack: number = 7): DeploymentStats {
    const db = getSQLiteDatabase().getRawDatabase();
    
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN state = 'READY' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN state = 'ERROR' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN state = 'CANCELED' THEN 1 ELSE 0 END) as canceled,
        SUM(CASE WHEN state = 'BUILDING' THEN 1 ELSE 0 END) as building,
        AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms ELSE NULL END) as avg_duration,
        MAX(created_at) as last_deployment
      FROM vercel_deployments
      WHERE project_id = ? AND created_at > ?
    `);
    
    const row = stmt.get(projectId, cutoffDate) as any;
    
    const total = row.total || 0;
    const successful = row.successful || 0;
    const successRate = total > 0 ? (successful / total) * 100 : 100;
    
    return {
      totalDeployments: total,
      successfulDeployments: successful,
      failedDeployments: row.failed || 0,
      canceledDeployments: row.canceled || 0,
      buildingDeployments: row.building || 0,
      averageDuration: row.avg_duration || undefined,
      successRate: Math.round(successRate * 100) / 100,
      lastDeploymentAt: row.last_deployment ? new Date(row.last_deployment) : undefined,
    };
  }

  /**
   * Get overall statistics across all projects
   */
  getOverallStats(daysBack: number = 7): DeploymentStats {
    const db = getSQLiteDatabase().getRawDatabase();
    
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN state = 'READY' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN state = 'ERROR' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN state = 'CANCELED' THEN 1 ELSE 0 END) as canceled,
        SUM(CASE WHEN state = 'BUILDING' THEN 1 ELSE 0 END) as building,
        AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms ELSE NULL END) as avg_duration,
        MAX(created_at) as last_deployment
      FROM vercel_deployments
      WHERE created_at > ?
    `);
    
    const row = stmt.get(cutoffDate) as any;
    
    const total = row.total || 0;
    const successful = row.successful || 0;
    const successRate = total > 0 ? (successful / total) * 100 : 100;
    
    return {
      totalDeployments: total,
      successfulDeployments: successful,
      failedDeployments: row.failed || 0,
      canceledDeployments: row.canceled || 0,
      buildingDeployments: row.building || 0,
      averageDuration: row.avg_duration || undefined,
      successRate: Math.round(successRate * 100) / 100,
      lastDeploymentAt: row.last_deployment ? new Date(row.last_deployment) : undefined,
    };
  }

  /**
   * Get list of all projects from database
   */
  getAllProjects(): StoredProject[] {
    const db = getSQLiteDatabase().getRawDatabase();
    
    const stmt = db.prepare(`
      SELECT * FROM vercel_projects ORDER BY updated_at DESC
    `);
    
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      id: row.id,
      project_id: row.project_id,
      name: row.name,
      account_id: row.account_id,
      framework: row.framework,
      git_repo: row.git_repo,
      git_type: row.git_type,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    }));
  }

  /**
   * Get recent failed deployments
   */
  getRecentFailures(limit: number = 10): StoredDeployment[] {
    const db = getSQLiteDatabase().getRawDatabase();
    
    const stmt = db.prepare(`
      SELECT * FROM vercel_deployments 
      WHERE state IN ('ERROR', 'CANCELED')
      ORDER BY created_at DESC
      LIMIT ?
    `);
    
    const rows = stmt.all(limit) as any[];
    return rows.map(row => this.mapRowToDeployment(row));
  }

  /**
   * Clean up old deployment data
   */
  cleanupOldData(daysToKeep: number = 90): { deploymentsDeleted: number; alertsDeleted: number } {
    const db = getSQLiteDatabase().getRawDatabase();
    
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();
    
    // Delete old alerts first (due to foreign key)
    const alertStmt = db.prepare(`
      DELETE FROM vercel_deployment_alerts WHERE alerted_at < ?
    `);
    const alertResult = alertStmt.run(cutoffDate);
    
    // Delete old deployments
    const deploymentStmt = db.prepare(`
      DELETE FROM vercel_deployments WHERE created_at < ?
    `);
    const deploymentResult = deploymentStmt.run(cutoffDate);
    
    logger.info(`🧹 Cleaned up old Vercel data: ${deploymentResult.changes} deployments, ${alertResult.changes} alerts`);
    
    return {
      deploymentsDeleted: deploymentResult.changes,
      alertsDeleted: alertResult.changes,
    };
  }

  /**
   * Helper: Map database row to StoredDeployment
   */
  private mapRowToDeployment(row: any): StoredDeployment {
    return {
      id: row.id,
      deployment_id: row.deployment_id,
      project_id: row.project_id,
      project_name: row.project_name,
      url: row.url,
      state: row.state,
      deployment_type: row.deployment_type,
      target: row.target,
      created_at: new Date(row.created_at),
      building_at: row.building_at ? new Date(row.building_at) : undefined,
      ready_at: row.ready_at ? new Date(row.ready_at) : undefined,
      commit_sha: row.commit_sha,
      commit_ref: row.commit_ref,
      commit_message: row.commit_message,
      commit_author: row.commit_author,
      commit_author_login: row.commit_author_login,
      git_repo: row.git_repo,
      creator_uid: row.creator_uid,
      creator_email: row.creator_email,
      creator_username: row.creator_username,
      alias_error_code: row.alias_error_code,
      alias_error_message: row.alias_error_message,
      duration_ms: row.duration_ms,
      raw_data: row.raw_data,
      first_seen_at: new Date(row.first_seen_at),
      last_checked_at: new Date(row.last_checked_at),
      updated_at: new Date(row.updated_at),
    };
  }
}

