import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { VercelDatabaseService } from './vercelDatabase';

/**
 * Vercel Deployment Status
 */
export type DeploymentState = 
  | 'BUILDING'
  | 'ERROR'
  | 'INITIALIZING'
  | 'QUEUED'
  | 'READY'
  | 'CANCELED';

export interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  created: number;
  state: DeploymentState;
  type: 'LAMBDAS';
  creator: {
    uid: string;
    email?: string;
    username?: string;
  };
  meta?: {
    githubCommitRef?: string;
    githubCommitSha?: string;
    githubCommitMessage?: string;
    githubCommitAuthorName?: string;
    githubCommitAuthorLogin?: string;
    githubRepo?: string;
  };
  target?: 'production' | 'preview' | null;
  aliasError?: {
    code: string;
    message: string;
  } | null;
  buildingAt?: number;
  ready?: number;
}

export interface VercelProject {
  id: string;
  name: string;
  accountId: string;
  createdAt: number;
  framework?: string;
  gitRepository?: {
    repo: string;
    type: string;
  };
}

export interface DeploymentError {
  deployment: VercelDeployment;
  project: VercelProject;
  errorTime: Date;
  duration?: number;
}

/**
 * Vercel Monitor Service
 * Monitors Vercel deployments and tracks failures
 */
export class VercelMonitor {
  private client: AxiosInstance;
  private token: string;
  private teamId?: string;
  private lastCheckedTimestamp: number;
  private db: VercelDatabaseService;

  constructor(config: {
    token: string;
    teamId?: string;
  }) {
    this.token = config.token;
    this.teamId = config.teamId;
    this.lastCheckedTimestamp = Date.now() - (24 * 60 * 60 * 1000); // Start from 24 hours ago

    this.client = axios.create({
      baseURL: 'https://api.vercel.com',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });

    // Initialize database service (DATABASE FIRST!)
    this.db = new VercelDatabaseService();

    logger.info('✅ Vercel Monitor initialized with database-first storage');
  }

  /**
   * Get all projects (and store in database first!)
   */
  async getProjects(): Promise<VercelProject[]> {
    try {
      const params: any = {};
      if (this.teamId) {
        params.teamId = this.teamId;
      }

      const response = await this.client.get('/v9/projects', { params });
      const projects = response.data.projects || [];
      
      // DATABASE FIRST: Store all projects before returning
      for (const project of projects) {
        try {
          this.db.storeProject(project);
        } catch (error: any) {
          logger.error(`Failed to store project ${project.name} in database:`, error.message);
        }
      }
      
      return projects;
    } catch (error: any) {
      logger.error('Failed to fetch Vercel projects:', error.message);
      throw error;
    }
  }

  /**
   * Get deployments for a specific project (and store in database first!)
   */
  async getDeployments(projectId: string, limit: number = 10): Promise<VercelDeployment[]> {
    try {
      const params: any = { limit };
      if (this.teamId) {
        params.teamId = this.teamId;
      }

      const response = await this.client.get(`/v6/deployments`, {
        params: {
          ...params,
          projectId,
        },
      });

      const deployments = response.data.deployments || [];
      
      // DATABASE FIRST: Store all deployments before returning
      // We need the project name, so we'll fetch it if we don't have it
      const projects = await this.getProjectsFromCache();
      const project = projects.find(p => p.id === projectId);
      const projectName = project?.name || projectId;
      
      for (const deployment of deployments) {
        try {
          this.db.storeDeployment(deployment, projectName);
        } catch (error: any) {
          logger.error(`Failed to store deployment ${deployment.uid} in database:`, error.message);
        }
      }

      return deployments;
    } catch (error: any) {
      logger.error(`Failed to fetch deployments for project ${projectId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get projects from cache (to avoid repeated API calls)
   */
  private projectsCache: VercelProject[] = [];
  private projectsCacheTime: number = 0;
  private async getProjectsFromCache(): Promise<VercelProject[]> {
    // Cache for 5 minutes
    if (this.projectsCache.length > 0 && Date.now() - this.projectsCacheTime < 5 * 60 * 1000) {
      return this.projectsCache;
    }
    
    this.projectsCache = await this.getProjects();
    this.projectsCacheTime = Date.now();
    return this.projectsCache;
  }

  /**
   * Get a specific deployment by ID
   */
  async getDeployment(deploymentId: string): Promise<VercelDeployment> {
    try {
      const params: any = {};
      if (this.teamId) {
        params.teamId = this.teamId;
      }

      const response = await this.client.get(`/v13/deployments/${deploymentId}`, { params });
      return response.data;
    } catch (error: any) {
      logger.error(`Failed to fetch deployment ${deploymentId}:`, error.message);
      throw error;
    }
  }

  /**
   * Check for failed deployments across all projects
   * DATABASE FIRST: All data stored before checking for failures
   */
  async checkFailedDeployments(): Promise<DeploymentError[]> {
    const failures: DeploymentError[] = [];

    try {
      const projects = await this.getProjects();
      logger.info(`📊 Checking ${projects.length} Vercel projects for failed deployments...`);

      for (const project of projects) {
        try {
          // This will store all deployments in the database
          const deployments = await this.getDeployments(project.id, 20);

          // Filter deployments created after last check
          const recentDeployments = deployments.filter(
            d => d.created > this.lastCheckedTimestamp
          );

          // Find failed deployments
          const failed = recentDeployments.filter(
            d => d.state === 'ERROR' || d.state === 'CANCELED'
          );

          for (const deployment of failed) {
            const duration = deployment.ready 
              ? deployment.ready - deployment.created 
              : deployment.buildingAt 
                ? Date.now() - deployment.buildingAt 
                : undefined;

            failures.push({
              deployment,
              project,
              errorTime: new Date(deployment.created),
              duration,
            });

            logger.warn(
              `❌ Failed deployment detected (stored in DB): ${project.name} - ${deployment.uid} (${deployment.state})`
            );
          }
        } catch (error: any) {
          logger.error(`Failed to check deployments for project ${project.name}:`, error.message);
        }
      }

      // Update last checked timestamp
      if (failures.length > 0 || projects.length > 0) {
        this.lastCheckedTimestamp = Date.now();
      }

      logger.info(`✅ Deployment check complete. Found ${failures.length} failures (all stored in database).`);
      return failures;

    } catch (error: any) {
      logger.error('Failed to check Vercel deployments:', error.message);
      throw error;
    }
  }

  /**
   * Get deployment logs (for detailed error information)
   */
  async getDeploymentLogs(deploymentId: string): Promise<string[]> {
    try {
      const params: any = {};
      if (this.teamId) {
        params.teamId = this.teamId;
      }

      const response = await this.client.get(`/v2/deployments/${deploymentId}/events`, { params });
      
      // Extract text from log events
      const logs = response.data.map((event: any) => event.text || event.payload?.text).filter(Boolean);
      return logs;
    } catch (error: any) {
      logger.error(`Failed to fetch logs for deployment ${deploymentId}:`, error.message);
      return [];
    }
  }

  /**
   * Get summary of deployment health
   */
  async getDeploymentHealth(): Promise<{
    totalProjects: number;
    recentDeployments: number;
    failedDeployments: number;
    successRate: number;
    projects: Array<{
      name: string;
      lastDeployment?: {
        state: DeploymentState;
        created: Date;
        url: string;
      };
    }>;
  }> {
    const projects = await this.getProjects();
    let totalDeployments = 0;
    let failedCount = 0;

    const projectsSummary = await Promise.all(
      projects.map(async (project) => {
        try {
          const deployments = await this.getDeployments(project.id, 5);
          const recent = deployments.filter(d => d.created > Date.now() - (7 * 24 * 60 * 60 * 1000));
          
          totalDeployments += recent.length;
          failedCount += recent.filter(d => d.state === 'ERROR').length;

          const lastDeployment = deployments[0];

          return {
            name: project.name,
            lastDeployment: lastDeployment ? {
              state: lastDeployment.state,
              created: new Date(lastDeployment.created),
              url: lastDeployment.url,
            } : undefined,
          };
        } catch (error) {
          return {
            name: project.name,
            lastDeployment: undefined,
          };
        }
      })
    );

    const successRate = totalDeployments > 0 
      ? ((totalDeployments - failedCount) / totalDeployments) * 100 
      : 100;

    return {
      totalProjects: projects.length,
      recentDeployments: totalDeployments,
      failedDeployments: failedCount,
      successRate: Math.round(successRate * 100) / 100,
      projects: projectsSummary,
    };
  }

  /**
   * Reset the last checked timestamp (useful for testing)
   */
  resetLastChecked(hoursAgo: number = 24): void {
    this.lastCheckedTimestamp = Date.now() - (hoursAgo * 60 * 60 * 1000);
    logger.info(`🔄 Reset last checked timestamp to ${hoursAgo} hours ago`);
  }
}

