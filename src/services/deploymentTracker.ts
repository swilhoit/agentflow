import { Client, TextChannel, EmbedBuilder, Colors } from 'discord.js';
import axios, { AxiosInstance } from 'axios';
import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { VercelMonitor, VercelDeployment, DeploymentError } from './vercelMonitor';
import { VercelDatabaseService } from './vercelDatabase';

/**
 * GitHub Workflow Run Status
 */
export type GitHubWorkflowStatus = 
  | 'completed'
  | 'action_required'
  | 'cancelled'
  | 'failure'
  | 'neutral'
  | 'skipped'
  | 'stale'
  | 'success'
  | 'timed_out'
  | 'in_progress'
  | 'queued'
  | 'requested'
  | 'waiting'
  | 'pending';

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  run_number: number;
  event: string;
  status: string;
  conclusion: GitHubWorkflowStatus | null;
  workflow_id: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_started_at: string;
  actor: {
    login: string;
    avatar_url: string;
  };
  head_commit?: {
    message: string;
    author?: {
      name: string;
      email: string;
    };
  };
  repository: {
    name: string;
    full_name: string;
    html_url: string;
  };
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
}

export interface DeploymentTrackerConfig {
  enabled: boolean;
  channelId: string;
  
  // Vercel config
  vercelEnabled: boolean;
  vercelToken?: string;
  vercelTeamId?: string;
  vercelProjectFilter?: string[];
  vercelAlertOnCancel?: boolean;
  
  // GitHub config
  githubEnabled: boolean;
  githubToken?: string;
  githubRepos?: string[]; // Format: owner/repo
  githubWorkflowFilter?: string[]; // Only track specific workflows
  
  // Schedule
  checkInterval?: string; // Cron format, default "*/5 * * * *" (every 5 minutes)
}

/**
 * Deployment Tracker Service
 * Unified tracking for Vercel and GitHub deployments
 */
export class DeploymentTracker {
  private discordClient?: Client;
  private config: DeploymentTrackerConfig;
  private scheduledTask?: cron.ScheduledTask;
  
  // Vercel tracking
  private vercelMonitor?: VercelMonitor;
  private vercelDb?: VercelDatabaseService;
  private alertedVercelDeployments: Set<string> = new Set();
  private startupTime: number = Date.now();
  private isFirstCheck: boolean = true;

  // GitHub tracking
  private githubClient?: AxiosInstance;
  private alertedGitHubRuns: Set<number> = new Set();
  private lastGitHubCheck: number = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

  constructor(config: DeploymentTrackerConfig) {
    this.config = config;

    // Initialize Vercel tracking
    if (config.vercelEnabled && config.vercelToken) {
      this.vercelDb = new VercelDatabaseService();
      this.vercelMonitor = new VercelMonitor({
        token: config.vercelToken,
        teamId: config.vercelTeamId,
      });
      logger.info('✅ Deployment Tracker: Vercel monitoring enabled');
    }

    // Initialize GitHub tracking
    if (config.githubEnabled && config.githubToken) {
      this.githubClient = axios.create({
        baseURL: 'https://api.github.com',
        headers: {
          'Authorization': `Bearer ${config.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      logger.info('✅ Deployment Tracker: GitHub monitoring enabled');
    }

    logger.info('✅ Deployment Tracker initialized');
  }

  /**
   * Set Discord client for sending notifications
   */
  setDiscordClient(client: Client): void {
    this.discordClient = client;
    logger.info('✅ Discord client connected to Deployment Tracker');
  }

  /**
   * Start monitoring deployments
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('⏸️  Deployment tracking disabled in config');
      return;
    }

    const interval = this.config.checkInterval || '*/5 * * * *'; // Default: every 5 minutes

    this.scheduledTask = cron.schedule(interval, async () => {
      await this.checkDeployments();
    });

    logger.info(`🚀 Deployment tracking started (interval: ${interval})`);

    // Run initial check after 10 seconds
    setTimeout(() => this.checkDeployments(), 10000);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      logger.info('⏹️  Deployment tracking stopped');
    }
  }

  /**
   * Check all deployments (Vercel and GitHub)
   */
  async checkDeployments(): Promise<void> {
    logger.info('🔍 Checking deployments...');

    const results = await Promise.allSettled([
      this.checkVercelDeployments(),
      this.checkGitHubDeployments(),
    ]);

    // Log any errors
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const source = index === 0 ? 'Vercel' : 'GitHub';
        logger.error(`Failed to check ${source} deployments:`, result.reason);
      }
    });

    // After first check, enable notifications for subsequent checks
    if (this.isFirstCheck) {
      logger.info('✅ First deployment check complete - notifications enabled for future deployments');
      this.isFirstCheck = false;
    }
  }

  /**
   * Check Vercel deployments
   */
  private async checkVercelDeployments(): Promise<void> {
    if (!this.vercelMonitor || !this.config.vercelEnabled) {
      return;
    }

    try {
      const failures = await this.vercelMonitor.checkFailedDeployments();

      // Filter out already alerted deployments
      const newFailures = failures.filter(f => {
        if (this.alertedVercelDeployments.has(f.deployment.uid)) {
          return false;
        }
        if (f.deployment.state === 'CANCELED' && !this.config.vercelAlertOnCancel) {
          return false;
        }
        if (this.config.vercelProjectFilter?.length) {
          return this.config.vercelProjectFilter.includes(f.project.name);
        }
        return true;
      });

      // Also check for successful deployments to production
      const projects = await this.vercelMonitor.getProjects();
      for (const project of projects) {
        if (this.config.vercelProjectFilter?.length &&
            !this.config.vercelProjectFilter.includes(project.name)) {
          continue;
        }

        const deployments = await this.vercelMonitor.getDeployments(project.id, 5);
        for (const deployment of deployments) {
          if (this.alertedVercelDeployments.has(deployment.uid)) {
            continue;
          }

          // On first check after restart, just populate the set WITHOUT notifying
          // This prevents spamming about old deployments
          if (this.isFirstCheck) {
            this.alertedVercelDeployments.add(deployment.uid);
            continue;
          }

          // Alert on successful production deployments
          if (deployment.state === 'READY' && deployment.target === 'production') {
            await this.sendVercelSuccessNotification(deployment, project.name);
            this.alertedVercelDeployments.add(deployment.uid);
          }
        }
      }

      // Send failure notifications (skip on first check)
      if (!this.isFirstCheck) {
        for (const failure of newFailures) {
          await this.sendVercelFailureNotification(failure);
          this.alertedVercelDeployments.add(failure.deployment.uid);
        }
      } else {
        // Just add to the set without notifying
        for (const failure of newFailures) {
          this.alertedVercelDeployments.add(failure.deployment.uid);
        }
      }

      logger.info(`✅ Vercel check complete: ${newFailures.length} failures${this.isFirstCheck ? ' (first check - no notifications)' : ''}`);

    } catch (error: any) {
      logger.error('Failed to check Vercel deployments:', error.message);
    }
  }

  /**
   * Check GitHub workflow runs
   */
  private async checkGitHubDeployments(): Promise<void> {
    if (!this.githubClient || !this.config.githubEnabled) {
      return;
    }

    try {
      let repos = this.config.githubRepos || [];
      
      // If no repos specified, get user's repos
      if (repos.length === 0) {
        const response = await this.githubClient.get('/user/repos', {
          params: { sort: 'pushed', per_page: 10 },
        });
        repos = response.data.map((r: GitHubRepository) => r.full_name);
      }

      for (const repoFullName of repos) {
        await this.checkRepoWorkflows(repoFullName);
      }

      this.lastGitHubCheck = Date.now();
      logger.info(`✅ GitHub check complete for ${repos.length} repos`);

    } catch (error: any) {
      logger.error('Failed to check GitHub deployments:', error.message);
    }
  }

  /**
   * Check workflow runs for a specific repository
   */
  private async checkRepoWorkflows(repoFullName: string): Promise<void> {
    if (!this.githubClient) return;

    try {
      const response = await this.githubClient.get(`/repos/${repoFullName}/actions/runs`, {
        params: {
          per_page: 10,
          created: `>=${new Date(this.lastGitHubCheck).toISOString().split('T')[0]}`,
        },
      });

      const runs: GitHubWorkflowRun[] = response.data.workflow_runs || [];

      for (const run of runs) {
        // Skip if already alerted
        if (this.alertedGitHubRuns.has(run.id)) {
          continue;
        }

        // Skip if workflow filter is set and this workflow isn't in it
        if (this.config.githubWorkflowFilter?.length && 
            !this.config.githubWorkflowFilter.includes(run.name)) {
          continue;
        }

        // Skip in-progress runs
        if (run.status !== 'completed') {
          continue;
        }

        // On first check, just populate the set without notifying
        if (this.isFirstCheck) {
          this.alertedGitHubRuns.add(run.id);
          continue;
        }

        // Send notification based on conclusion
        if (run.conclusion === 'success') {
          await this.sendGitHubSuccessNotification(run);
        } else if (run.conclusion === 'failure' || run.conclusion === 'timed_out') {
          await this.sendGitHubFailureNotification(run);
        } else if (run.conclusion === 'cancelled') {
          // Optionally send cancelled notification
          await this.sendGitHubCancelledNotification(run);
        }

        this.alertedGitHubRuns.add(run.id);
      }

    } catch (error: any) {
      logger.error(`Failed to check workflows for ${repoFullName}:`, error.message);
    }
  }

  /**
   * Send Vercel success notification
   */
  private async sendVercelSuccessNotification(deployment: VercelDeployment, projectName: string): Promise<void> {
    if (!this.discordClient) return;

    try {
      const channel = await this.discordClient.channels.fetch(this.config.channelId) as TextChannel;
      if (!channel) {
        logger.error(`❌ Deployments channel not found: ${this.config.channelId}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`✅ Vercel Deploy: ${projectName}`)
        .setColor(Colors.Green)
        .setTimestamp(new Date(deployment.created))
        .setThumbnail('https://assets.vercel.com/image/upload/v1662130559/nextjs/Icon_dark.png')
        .addFields([
          {
            name: '🌐 URL',
            value: `https://${deployment.url}`,
            inline: false,
          },
          {
            name: '🎯 Environment',
            value: deployment.target?.toUpperCase() || 'Preview',
            inline: true,
          },
        ]);

      // Add commit info if available
      if (deployment.meta?.githubCommitSha) {
        const commitSha = deployment.meta.githubCommitSha.substring(0, 7);
        const commitMsg = deployment.meta.githubCommitMessage || 'No message';
        const author = deployment.meta.githubCommitAuthorName || 'Unknown';
        const branch = deployment.meta.githubCommitRef || 'unknown';
        
        embed.addFields([
          {
            name: '📝 Commit',
            value: `\`${commitSha}\` ${commitMsg.split('\n')[0].substring(0, 50)}`,
            inline: false,
          },
          {
            name: '🌿 Branch',
            value: branch,
            inline: true,
          },
          {
            name: '👤 Author',
            value: author,
            inline: true,
          },
        ]);
      }

      await channel.send({ embeds: [embed] });
      logger.info(`✅ Sent Vercel success notification for ${projectName}`);

    } catch (error: any) {
      logger.error('Failed to send Vercel success notification:', error.message);
    }
  }

  /**
   * Send Vercel failure notification
   */
  private async sendVercelFailureNotification(error: DeploymentError): Promise<void> {
    if (!this.discordClient) return;

    try {
      const channel = await this.discordClient.channels.fetch(this.config.channelId) as TextChannel;
      if (!channel) return;

      const { deployment, project, errorTime } = error;

      const embed = new EmbedBuilder()
        .setTitle(`❌ Vercel Deploy Failed: ${project.name}`)
        .setColor(Colors.Red)
        .setTimestamp(errorTime)
        .setThumbnail('https://assets.vercel.com/image/upload/v1662130559/nextjs/Icon_dark.png')
        .addFields([
          {
            name: '⚠️ Status',
            value: deployment.state,
            inline: true,
          },
          {
            name: '🎯 Environment',
            value: deployment.target?.toUpperCase() || 'Preview',
            inline: true,
          },
          {
            name: '🔗 Deployment ID',
            value: `\`${deployment.uid}\``,
            inline: false,
          },
        ]);

      // Add commit info if available
      if (deployment.meta?.githubCommitSha) {
        const commitSha = deployment.meta.githubCommitSha.substring(0, 7);
        const commitMsg = deployment.meta.githubCommitMessage || 'No message';
        
        embed.addFields([
          {
            name: '📝 Commit',
            value: `\`${commitSha}\` ${commitMsg.split('\n')[0].substring(0, 50)}`,
            inline: false,
          },
        ]);
      }

      // Add error details if available
      if (deployment.aliasError) {
        embed.addFields([
          {
            name: '❌ Error',
            value: `\`\`\`\n${deployment.aliasError.message.substring(0, 500)}\n\`\`\``,
            inline: false,
          },
        ]);
      }

      // Add dashboard link
      const dashboardUrl = `https://vercel.com/${project.accountId}/${project.name}/${deployment.uid}`;
      embed.addFields([
        {
          name: '🔍 View Details',
          value: `[Open Vercel Dashboard](${dashboardUrl})`,
          inline: false,
        },
      ]);

      await channel.send({ embeds: [embed] });
      logger.info(`✅ Sent Vercel failure notification for ${project.name}`);

    } catch (error: any) {
      logger.error('Failed to send Vercel failure notification:', error.message);
    }
  }

  /**
   * Send GitHub success notification
   */
  private async sendGitHubSuccessNotification(run: GitHubWorkflowRun): Promise<void> {
    if (!this.discordClient) return;

    try {
      const channel = await this.discordClient.channels.fetch(this.config.channelId) as TextChannel;
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle(`✅ GitHub: ${run.repository.name}/${run.name}`)
        .setColor(Colors.Green)
        .setTimestamp(new Date(run.updated_at))
        .setThumbnail('https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png')
        .addFields([
          {
            name: '🔢 Run',
            value: `#${run.run_number}`,
            inline: true,
          },
          {
            name: '🌿 Branch',
            value: run.head_branch,
            inline: true,
          },
          {
            name: '📋 Event',
            value: run.event,
            inline: true,
          },
        ]);

      // Add commit info
      if (run.head_commit) {
        const commitSha = run.head_sha.substring(0, 7);
        const commitMsg = run.head_commit.message?.split('\n')[0].substring(0, 50) || 'No message';
        const author = run.head_commit.author?.name || run.actor.login;
        
        embed.addFields([
          {
            name: '📝 Commit',
            value: `\`${commitSha}\` ${commitMsg}`,
            inline: false,
          },
          {
            name: '👤 Author',
            value: author,
            inline: true,
          },
        ]);
      }

      // Add link
      embed.addFields([
        {
          name: '🔍 View Details',
          value: `[Open GitHub Actions](${run.html_url})`,
          inline: false,
        },
      ]);

      await channel.send({ embeds: [embed] });
      logger.info(`✅ Sent GitHub success notification for ${run.repository.name}/${run.name}`);

    } catch (error: any) {
      logger.error('Failed to send GitHub success notification:', error.message);
    }
  }

  /**
   * Send GitHub failure notification
   */
  private async sendGitHubFailureNotification(run: GitHubWorkflowRun): Promise<void> {
    if (!this.discordClient) return;

    try {
      const channel = await this.discordClient.channels.fetch(this.config.channelId) as TextChannel;
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle(`❌ GitHub Failed: ${run.repository.name}/${run.name}`)
        .setColor(Colors.Red)
        .setTimestamp(new Date(run.updated_at))
        .setThumbnail('https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png')
        .addFields([
          {
            name: '🔢 Run',
            value: `#${run.run_number}`,
            inline: true,
          },
          {
            name: '🌿 Branch',
            value: run.head_branch,
            inline: true,
          },
          {
            name: '⚠️ Status',
            value: run.conclusion?.toUpperCase() || 'FAILED',
            inline: true,
          },
        ]);

      // Add commit info
      if (run.head_commit) {
        const commitSha = run.head_sha.substring(0, 7);
        const commitMsg = run.head_commit.message?.split('\n')[0].substring(0, 50) || 'No message';
        const author = run.head_commit.author?.name || run.actor.login;
        
        embed.addFields([
          {
            name: '📝 Commit',
            value: `\`${commitSha}\` ${commitMsg}`,
            inline: false,
          },
          {
            name: '👤 Author',
            value: author,
            inline: true,
          },
        ]);
      }

      // Add link
      embed.addFields([
        {
          name: '🔍 View Details',
          value: `[Open GitHub Actions](${run.html_url})`,
          inline: false,
        },
      ]);

      await channel.send({ embeds: [embed] });
      logger.info(`✅ Sent GitHub failure notification for ${run.repository.name}/${run.name}`);

    } catch (error: any) {
      logger.error('Failed to send GitHub failure notification:', error.message);
    }
  }

  /**
   * Send GitHub cancelled notification
   */
  private async sendGitHubCancelledNotification(run: GitHubWorkflowRun): Promise<void> {
    if (!this.discordClient) return;

    try {
      const channel = await this.discordClient.channels.fetch(this.config.channelId) as TextChannel;
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle(`⏹️ GitHub Cancelled: ${run.repository.name}/${run.name}`)
        .setColor(Colors.Yellow)
        .setTimestamp(new Date(run.updated_at))
        .setThumbnail('https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png')
        .addFields([
          {
            name: '🔢 Run',
            value: `#${run.run_number}`,
            inline: true,
          },
          {
            name: '🌿 Branch',
            value: run.head_branch,
            inline: true,
          },
          {
            name: '🔍 View',
            value: `[Open Run](${run.html_url})`,
            inline: true,
          },
        ]);

      await channel.send({ embeds: [embed] });

    } catch (error: any) {
      logger.error('Failed to send GitHub cancelled notification:', error.message);
    }
  }

  /**
   * Manually trigger a deployment check
   */
  async triggerCheck(): Promise<void> {
    logger.info('🔄 Manual deployment check triggered');
    await this.checkDeployments();
  }

  /**
   * Get tracking statistics
   */
  getStats(): {
    vercelEnabled: boolean;
    githubEnabled: boolean;
    vercelDeploymentsTracked: number;
    githubRunsTracked: number;
    isRunning: boolean;
  } {
    return {
      vercelEnabled: this.config.vercelEnabled && !!this.vercelMonitor,
      githubEnabled: this.config.githubEnabled && !!this.githubClient,
      vercelDeploymentsTracked: this.alertedVercelDeployments.size,
      githubRunsTracked: this.alertedGitHubRuns.size,
      isRunning: !!this.scheduledTask,
    };
  }

  /**
   * Send a deployment health summary
   */
  async sendHealthSummary(): Promise<void> {
    if (!this.discordClient) return;

    try {
      const channel = await this.discordClient.channels.fetch(this.config.channelId) as TextChannel;
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('📊 Deployment Health Summary')
        .setColor(Colors.Blue)
        .setTimestamp();

      // Vercel stats
      if (this.vercelMonitor && this.config.vercelEnabled) {
        try {
          const health = await this.vercelMonitor.getDeploymentHealth();
          embed.addFields([
            {
              name: '🔺 Vercel',
              value: `**Projects:** ${health.totalProjects}\n**Deployments (7d):** ${health.recentDeployments}\n**Success Rate:** ${health.successRate}%`,
              inline: true,
            },
          ]);
        } catch (error) {
          embed.addFields([
            {
              name: '🔺 Vercel',
              value: '⚠️ Unable to fetch stats',
              inline: true,
            },
          ]);
        }
      }

      // GitHub stats
      if (this.githubClient && this.config.githubEnabled) {
        embed.addFields([
          {
            name: '🐙 GitHub',
            value: `**Runs Tracked:** ${this.alertedGitHubRuns.size}\n**Repos Monitored:** ${this.config.githubRepos?.length || 'Auto'}`,
            inline: true,
          },
        ]);
      }

      // Overall status
      embed.addFields([
        {
          name: '📈 Tracking Status',
          value: `**Vercel:** ${this.config.vercelEnabled ? '✅ Active' : '⏸️ Disabled'}\n**GitHub:** ${this.config.githubEnabled ? '✅ Active' : '⏸️ Disabled'}`,
          inline: false,
        },
      ]);

      await channel.send({ embeds: [embed] });
      logger.info('✅ Sent deployment health summary');

    } catch (error: any) {
      logger.error('Failed to send health summary:', error.message);
    }
  }
}

/**
 * Create a DeploymentTracker from environment variables
 */
export function createDeploymentTrackerFromEnv(): DeploymentTracker | null {
  const channelId = process.env.DEPLOYMENTS_CHANNEL_ID;
  
  if (!channelId) {
    logger.info('DEPLOYMENTS_CHANNEL_ID not configured - deployment tracking disabled');
    return null;
  }

  const vercelToken = process.env.VERCEL_API_TOKEN;
  const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  
  // Parse GitHub repos from env
  const githubRepos = process.env.GITHUB_REPOS 
    ? process.env.GITHUB_REPOS.split(',').map(r => r.trim()).filter(r => r)
    : undefined;

  // Parse Vercel project filter
  const vercelProjectFilter = process.env.VERCEL_PROJECT_FILTER
    ? process.env.VERCEL_PROJECT_FILTER.split(',').map(p => p.trim()).filter(p => p)
    : undefined;

  // Parse GitHub workflow filter
  const githubWorkflowFilter = process.env.GITHUB_WORKFLOW_FILTER
    ? process.env.GITHUB_WORKFLOW_FILTER.split(',').map(w => w.trim()).filter(w => w)
    : undefined;

  const config: DeploymentTrackerConfig = {
    enabled: process.env.DEPLOYMENT_TRACKING_ENABLED !== 'false',
    channelId,
    
    // Vercel
    vercelEnabled: process.env.VERCEL_TRACKING_ENABLED !== 'false' && !!vercelToken,
    vercelToken,
    vercelTeamId: process.env.VERCEL_TEAM_ID,
    vercelProjectFilter,
    vercelAlertOnCancel: process.env.VERCEL_ALERT_ON_CANCEL === 'true',
    
    // GitHub
    githubEnabled: process.env.GITHUB_TRACKING_ENABLED !== 'false' && !!githubToken,
    githubToken,
    githubRepos,
    githubWorkflowFilter,
    
    // Schedule
    checkInterval: process.env.DEPLOYMENT_CHECK_INTERVAL || '*/5 * * * *',
  };

  return new DeploymentTracker(config);
}








