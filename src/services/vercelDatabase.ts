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
  commit_sha?: string;
  commit_ref?: string;
  commit_message?: string;
  commit_author?: string;
  commit_author_login?: string;
  git_repo?: string;
  creator_uid: string;
  creator_email?: string;
  creator_username?: string;
  alias_error_code?: string;
  alias_error_message?: string;
  duration_ms?: number;
  raw_data: string;
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
 * TODO: Migrate to PostgreSQL - currently returns empty/stub data
 */
export class VercelDatabaseService {
  constructor() {
    logger.warn('VercelDatabaseService: Disabled - needs PostgreSQL migration');
  }

  storeProject(_project: VercelProject): void {
    // Stub - needs PostgreSQL migration
  }

  storeDeployment(_deployment: VercelDeployment, _projectName: string): void {
    // Stub - needs PostgreSQL migration
  }

  getDeployment(_deploymentId: string): StoredDeployment | null {
    return null;
  }

  getProjectDeployments(_projectId: string, _limit: number = 10): StoredDeployment[] {
    return [];
  }

  getUnalertedFailures(_since?: Date): StoredDeployment[] {
    return [];
  }

  recordAlert(
    _deploymentId: string,
    _projectName: string,
    _state: DeploymentState,
    _errorDetails: string | null,
    _deploymentUrl: string,
    _discordMessageId?: string,
    _discordChannelId?: string
  ): void {
    // Stub - needs PostgreSQL migration
  }

  getProjectStats(_projectId: string, _daysBack: number = 7): DeploymentStats {
    return {
      totalDeployments: 0,
      successfulDeployments: 0,
      failedDeployments: 0,
      canceledDeployments: 0,
      buildingDeployments: 0,
      successRate: 100,
    };
  }

  getOverallStats(_daysBack: number = 7): DeploymentStats {
    return {
      totalDeployments: 0,
      successfulDeployments: 0,
      failedDeployments: 0,
      canceledDeployments: 0,
      buildingDeployments: 0,
      successRate: 100,
    };
  }

  getAllProjects(): StoredProject[] {
    return [];
  }

  getRecentFailures(_limit: number = 10): StoredDeployment[] {
    return [];
  }

  cleanupOldData(_daysToKeep: number = 90): { deploymentsDeleted: number; alertsDeleted: number } {
    return { deploymentsDeleted: 0, alertsDeleted: 0 };
  }
}
