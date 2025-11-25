import { Client, TextChannel, EmbedBuilder, Colors, Message } from 'discord.js';
import { logger } from '../utils/logger';
import { VercelMonitor, DeploymentError } from './vercelMonitor';
import { VercelDatabaseService } from './vercelDatabase';
import * as cron from 'node-cron';

/**
 * Vercel Alert Configuration
 */
export interface VercelAlertConfig {
  enabled: boolean;
  channelId: string;
  vercelToken: string;
  vercelTeamId?: string;
  checkInterval?: string; // Cron format, default "*/10 * * * *" (every 10 minutes)
  alertOnCancel?: boolean; // Alert on canceled deployments (default: false)
  projectFilter?: string[]; // Only monitor specific projects (empty = all)
}

/**
 * Vercel Alert Service
 * Monitors Vercel deployments and sends Discord alerts for failures
 */
export class VercelAlertService {
  private discordClient?: Client;
  private monitor: VercelMonitor;
  private db: VercelDatabaseService;
  private config: VercelAlertConfig;
  private scheduledTask?: cron.ScheduledTask;
  private alertedDeployments: Set<string> = new Set(); // Track deployments we've already alerted on

  constructor(config: VercelAlertConfig) {
    this.config = config;
    
    // Initialize database service FIRST
    this.db = new VercelDatabaseService();
    
    // Then initialize monitor (which will use the database)
    this.monitor = new VercelMonitor({
      token: config.vercelToken,
      teamId: config.vercelTeamId,
    });

    this.loadAlertHistory();

    logger.info('✅ Vercel Alert Service initialized with database-first approach');
  }

  /**
   * Load alert history from database
   */
  private loadAlertHistory(): void {
    // Load recent alerts (last 7 days) to avoid duplicate notifications
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const failures = this.db.getUnalertedFailures(cutoffDate);
    
    // Mark all existing failures as already seen
    failures.forEach(f => this.alertedDeployments.add(f.deployment_id));

    logger.info(`📊 Loaded deployment alert history from database`);
  }

  /**
   * Record that we've alerted on a deployment (DATABASE FIRST!)
   */
  private async recordAlert(error: DeploymentError, discordMessage?: Message): Promise<void> {
    this.db.recordAlert(
      error.deployment.uid,
      error.project.name,
      error.deployment.state,
      error.deployment.aliasError?.message || null,
      error.deployment.url,
      discordMessage?.id,
      discordMessage?.channelId
    );

    this.alertedDeployments.add(error.deployment.uid);
    
    logger.info(`📝 Alert recorded in database for deployment ${error.deployment.uid}`);
  }

  /**
   * Set Discord client
   */
  setDiscordClient(client: Client): void {
    this.discordClient = client;
    logger.info('✅ Discord client connected to Vercel Alert Service');
  }

  /**
   * Start monitoring for failed deployments
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('⏸️  Vercel monitoring disabled in config');
      return;
    }

    const interval = this.config.checkInterval || '*/10 * * * *'; // Default: every 10 minutes

    this.scheduledTask = cron.schedule(interval, async () => {
      await this.checkDeployments();
    });

    logger.info(`🚀 Vercel deployment monitoring started (interval: ${interval})`);

    // Run initial check
    setTimeout(() => this.checkDeployments(), 5000);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      logger.info('⏹️  Vercel deployment monitoring stopped');
    }
  }

  /**
   * Check for failed deployments and send alerts
   */
  async checkDeployments(): Promise<void> {
    try {
      logger.info('🔍 Checking Vercel deployments...');

      const failures = await this.monitor.checkFailedDeployments();

      // Filter based on config
      let filteredFailures = failures.filter(f => {
        // Skip if already alerted
        if (this.alertedDeployments.has(f.deployment.uid)) {
          return false;
        }

        // Skip canceled deployments if not configured to alert on them
        if (f.deployment.state === 'CANCELED' && !this.config.alertOnCancel) {
          return false;
        }

        // Filter by project if specified
        if (this.config.projectFilter && this.config.projectFilter.length > 0) {
          return this.config.projectFilter.includes(f.project.name);
        }

        return true;
      });

      if (filteredFailures.length > 0) {
        logger.warn(`⚠️  Found ${filteredFailures.length} new deployment failures`);
        
        for (const failure of filteredFailures) {
          const discordMessage = await this.sendAlert(failure);
          await this.recordAlert(failure, discordMessage);
        }
      } else {
        logger.info('✅ No new deployment failures detected');
      }

    } catch (error: any) {
      logger.error('Failed to check Vercel deployments:', error.message);
    }
  }

  /**
   * Send Discord alert for a failed deployment
   * Returns the Discord message for tracking
   */
  private async sendAlert(error: DeploymentError): Promise<Message | undefined> {
    if (!this.discordClient) {
      logger.warn('⚠️  Cannot send alert: Discord client not connected');
      return;
    }

    try {
      const channel = await this.discordClient.channels.fetch(
        this.config.channelId
      ) as TextChannel;

      if (!channel) {
        logger.error(`❌ Could not find Discord channel: ${this.config.channelId}`);
        return;
      }

      const { deployment, project, errorTime, duration } = error;

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`🚨 Deployment Failed: ${project.name}`)
        .setColor(deployment.state === 'ERROR' ? Colors.Red : Colors.Orange)
        .setTimestamp(errorTime)
        .addFields([
          {
            name: '📦 Project',
            value: project.name,
            inline: true,
          },
          {
            name: '🔗 Deployment ID',
            value: `\`${deployment.uid}\``,
            inline: true,
          },
          {
            name: '⚠️ Status',
            value: deployment.state,
            inline: true,
          },
          {
            name: '🌐 URL',
            value: `https://${deployment.url}`,
            inline: false,
          },
        ]);

      // Add commit info if available
      if (deployment.meta?.githubCommitSha) {
        const commitMsg = deployment.meta.githubCommitMessage || 'No message';
        const commitAuthor = deployment.meta.githubCommitAuthorName || 'Unknown';
        const commitSha = deployment.meta.githubCommitSha.substring(0, 7);
        
        embed.addFields([
          {
            name: '📝 Commit',
            value: `\`${commitSha}\` by ${commitAuthor}\n${commitMsg}`,
            inline: false,
          },
        ]);
      }

      // Add branch info
      if (deployment.meta?.githubCommitRef) {
        embed.addFields([
          {
            name: '🌿 Branch',
            value: deployment.meta.githubCommitRef,
            inline: true,
          },
        ]);
      }

      // Add target environment
      if (deployment.target) {
        embed.addFields([
          {
            name: '🎯 Environment',
            value: deployment.target.toUpperCase(),
            inline: true,
          },
        ]);
      }

      // Add duration if available
      if (duration) {
        const durationStr = this.formatDuration(duration);
        embed.addFields([
          {
            name: '⏱️ Duration',
            value: durationStr,
            inline: true,
          },
        ]);
      }

      // Add error details if available
      if (deployment.aliasError) {
        embed.addFields([
          {
            name: '❌ Error Details',
            value: `\`\`\`\n${deployment.aliasError.message}\n\`\`\``,
            inline: false,
          },
        ]);
      }

      // Add Vercel dashboard link
      const dashboardUrl = `https://vercel.com/${project.accountId}/${project.name}/${deployment.uid}`;
      embed.addFields([
        {
          name: '🔍 View in Vercel',
          value: `[Open Dashboard](${dashboardUrl})`,
          inline: false,
        },
      ]);

      const message = await channel.send({ embeds: [embed] });

      logger.info(`✅ Sent deployment failure alert for ${project.name} - ${deployment.uid} (Discord message: ${message.id})`);
      
      return message;

    } catch (error: any) {
      logger.error('Failed to send Vercel deployment alert:', error.message);
      return undefined;
    }
  }

  /**
   * Send deployment health summary to Discord
   */
  async sendHealthSummary(): Promise<void> {
    if (!this.discordClient) {
      logger.warn('⚠️  Cannot send health summary: Discord client not connected');
      return;
    }

    try {
      const health = await this.monitor.getDeploymentHealth();

      const channel = await this.discordClient.channels.fetch(
        this.config.channelId
      ) as TextChannel;

      if (!channel) {
        logger.error(`❌ Could not find Discord channel: ${this.config.channelId}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📊 Vercel Deployment Health Summary')
        .setColor(health.successRate >= 95 ? Colors.Green : health.successRate >= 80 ? Colors.Yellow : Colors.Red)
        .setTimestamp()
        .addFields([
          {
            name: '📦 Total Projects',
            value: health.totalProjects.toString(),
            inline: true,
          },
          {
            name: '🚀 Recent Deployments (7d)',
            value: health.recentDeployments.toString(),
            inline: true,
          },
          {
            name: '❌ Failed Deployments',
            value: health.failedDeployments.toString(),
            inline: true,
          },
          {
            name: '✅ Success Rate',
            value: `${health.successRate}%`,
            inline: true,
          },
        ]);

      // Add project status
      const projectsStatus = health.projects
        .filter(p => p.lastDeployment)
        .slice(0, 10) // Show max 10 projects
        .map(p => {
          const emoji = p.lastDeployment!.state === 'READY' ? '✅' 
                      : p.lastDeployment!.state === 'ERROR' ? '❌'
                      : p.lastDeployment!.state === 'BUILDING' ? '🔄'
                      : '⏸️';
          return `${emoji} **${p.name}** - ${p.lastDeployment!.state}`;
        })
        .join('\n');

      if (projectsStatus) {
        embed.addFields([
          {
            name: '📋 Recent Project Status',
            value: projectsStatus,
            inline: false,
          },
        ]);
      }

      await channel.send({ embeds: [embed] });

      logger.info('✅ Sent Vercel deployment health summary');

    } catch (error: any) {
      logger.error('Failed to send Vercel health summary:', error.message);
    }
  }

  /**
   * Format duration in milliseconds to human-readable string
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Manual trigger to check deployments immediately
   */
  async triggerCheck(): Promise<void> {
    logger.info('🔄 Manual deployment check triggered');
    await this.checkDeployments();
  }

  /**
   * Get alert statistics (from database)
   */
  getStats(): {
    totalAlerts: number;
    recentAlerts: number;
    totalDeployments: number;
    isRunning: boolean;
  } {
    // Get overall deployment stats
    const overallStats = this.db.getOverallStats(7);
    
    // Count alerts
    const recentFailures = this.db.getRecentFailures(100);
    const recentAlerts = recentFailures.filter(f => 
      this.alertedDeployments.has(f.deployment_id)
    ).length;

    return {
      totalAlerts: this.alertedDeployments.size,
      recentAlerts,
      totalDeployments: overallStats.totalDeployments,
      isRunning: this.scheduledTask !== undefined,
    };
  }
}

