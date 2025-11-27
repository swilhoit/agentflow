import { Client, TextChannel, EmbedBuilder, Colors } from 'discord.js';
import { getAgentFlowDatabase } from './databaseFactory';
import { logger } from '../utils/logger';
import { TrelloService } from './trello';
import { getStartupLogger } from './startupLogger';
import * as cron from 'node-cron';
import { BotConfig } from '../types';

/**
 * SupervisorService - The "Chief of Staff" for the Agentic Framework.
 * 
 * Responsibilities:
 * 1. Monitor task health (stalled/failed tasks).
 * 2. Provide daily briefings.
 * 3. Nudge the user about forgotten Trello cards.
 * 4. Post hourly health check reports to Discord.
 */
export class SupervisorService {
  private client: Client;
  private config: BotConfig;
  private trelloService?: TrelloService;
  private jobs: cron.ScheduledTask[] = [];
  private startTime: Date;

  constructor(client: Client, config: BotConfig, trelloService?: TrelloService) {
    this.client = client;
    this.config = config;
    this.trelloService = trelloService;
    this.startTime = new Date();
  }

  start(): void {
    logger.info('👔 Supervisor Service starting...');

    // Morning Briefing (9:00 AM)
    this.jobs.push(cron.schedule('0 9 * * *', () => {
      this.runDailyBriefing('Morning Kickoff');
    }));

    // Evening Wrap-up (6:00 PM)
    this.jobs.push(cron.schedule('0 18 * * *', () => {
      this.runDailyBriefing('Evening Wrap-up');
    }));

    // Hourly Health Check - ALWAYS posts to Discord
    this.jobs.push(cron.schedule('0 * * * *', () => {
      this.runHourlyHealthCheck();
    }));

    logger.info(`✅ Supervisor scheduled: Morning (9am), Evening (6pm), and Hourly health reports.`);
  }

  stop(): void {
    this.jobs.forEach(job => job.stop());
    logger.info('Supervisor Service stopped');
  }

  /**
   * Run hourly health check and ALWAYS post to Discord
   */
  private async runHourlyHealthCheck(): Promise<void> {
    const channelId = this.config.systemNotificationChannelId;
    if (!channelId) {
      logger.warn('Cannot run health check: SYSTEM_NOTIFICATION_CHANNEL_ID not set');
      return;
    }

    try {
      const db = getAgentFlowDatabase();
      if (!db) {
        logger.warn('Cannot run health check: Database not initialized');
        return;
      }
      const failedTasks = await db.getFailedTasks(1); // Last 1 hour
      const failedTasks24h = await db.getFailedTasks(24); // Last 24 hours
      const activeTasks = await db.getAllActiveAgentTasks();
      
      // Calculate uptime
      const uptimeMs = Date.now() - this.startTime.getTime();
      const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
      const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
      
      // Get scheduled task stats
      let scheduledStats = { totalRuns: 0, successfulRuns: 0, failedRuns: 0 };
      try {
        const rawDb = (db as any).db || (db as any).getOriginal?.()?.getRawDatabase?.();
        if (rawDb) {
          const stats = rawDb.prepare(`
            SELECT 
              SUM(total_runs) as total_runs,
              SUM(successful_runs) as successful_runs,
              SUM(failed_runs) as failed_runs
            FROM recurring_tasks
          `).get();
          if (stats) {
            scheduledStats = {
              totalRuns: stats.total_runs || 0,
              successfulRuns: stats.successful_runs || 0,
              failedRuns: stats.failed_runs || 0
            };
          }
        }
      } catch (e) {
        // Ignore if we can't get scheduled stats
      }
      
      // Memory usage
      const memUsage = process.memoryUsage();
      const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      // Determine health status
      const isHealthy = failedTasks.length === 0;
      const statusEmoji = isHealthy ? '✅' : '⚠️';
      const statusText = isHealthy ? 'All Systems Operational' : `${failedTasks.length} Issue(s) Detected`;
      
      // Build embed
      const embed = new EmbedBuilder()
        .setTitle(`💓 Hourly Health Report`)
        .setDescription(`${statusEmoji} **${statusText}**`)
        .setColor(isHealthy ? Colors.Green : Colors.Yellow)
        .setTimestamp()
        .addFields([
          {
            name: '⏱️ Uptime',
            value: `${uptimeHours}h ${uptimeMinutes}m`,
            inline: true
          },
          {
            name: '🤖 Active Agents',
            value: activeTasks.length.toString(),
            inline: true
          },
          {
            name: '💾 Memory',
            value: `${memMB} MB`,
            inline: true
          },
          {
            name: '📅 Scheduled Tasks',
            value: `✅ ${scheduledStats.successfulRuns} | ❌ ${scheduledStats.failedRuns}`,
            inline: true
          },
          {
            name: '❌ Failed (1h)',
            value: failedTasks.length.toString(),
            inline: true
          },
          {
            name: '❌ Failed (24h)',
            value: failedTasks24h.length.toString(),
            inline: true
          }
        ])
        .setFooter({ text: 'AgentFlow Supervisor • Next check in 1 hour' });

      // Add failed task details if any
      if (failedTasks.length > 0) {
        const failedList = failedTasks
          .slice(0, 5)
          .map((t: any) => `• \`${t.agentId}\`: ${(t.error || 'Unknown').substring(0, 50)}`)
          .join('\n');
        embed.addFields({
          name: '🚨 Recent Failures',
          value: failedList || 'None',
          inline: false
        });
      }

      // Send to Discord
      const channel = await this.client.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        await (channel as TextChannel).send({ embeds: [embed] });
      }

      // Also log to StartupLogger for persistence
      const startupLogger = getStartupLogger();
      await startupLogger.logHealthCheck({
        healthy: isHealthy,
        uptime: uptimeMs / 1000,
        activeAgents: activeTasks.length,
        pendingTasks: 0,
        failedTasks24h: failedTasks24h.length,
        scheduledTasksRun: scheduledStats.successfulRuns,
        scheduledTasksFailed: scheduledStats.failedRuns,
        memoryUsage: memMB
      });

      logger.info(`✅ Hourly health check posted to Discord (healthy: ${isHealthy})`);

    } catch (error) {
      logger.error('Failed to run hourly health check', error);
      
      // Try to send error notification
      try {
        const startupLogger = getStartupLogger();
        await startupLogger.logServiceError('Supervisor', error as Error);
      } catch (e) {
        // Ignore
      }
    }
  }

  /**
   * Legacy health check method (kept for backwards compatibility)
   */
  private async checkTaskHealth(): Promise<void> {
    await this.runHourlyHealthCheck();
  }

  /**
   * Generate and send the Daily Briefing
   */
  async runDailyBriefing(title: string): Promise<void> {
    const channelId = this.config.systemNotificationChannelId;
    if (!channelId) {
      logger.warn('Cannot run daily briefing: SYSTEM_NOTIFICATION_CHANNEL_ID not set');
      return;
    }

    logger.info(`📋 Generating ${title}...`);

    try {
      const db = getAgentFlowDatabase();
      if (!db) {
        logger.warn('Cannot generate briefing: Database not initialized');
        return;
      }
      const activeTasks = await db.getAllActiveAgentTasks();
      const failedTasks = await db.getFailedTasks(24); // Last 24h
      
      // Build the report
      let report = `📊 **${title}**\n\n`;

      // 1. Active Agent Tasks
      if (activeTasks.length > 0) {
        report += `**🏃 Active Agents (${activeTasks.length})**\n`;
        activeTasks.forEach((t: any) => {
          const startedAt = t.started_at ? new Date(t.started_at) : new Date();
          const duration = Math.round((Date.now() - startedAt.getTime()) / 1000 / 60); // minutes
          const taskDesc = t.task_description || t.taskDescription || 'No description';
          report += `• \`${t.agent_id || t.agentId}\`: ${taskDesc.substring(0, 50)}... (${duration}m ago)\n`;
        });
        report += '\n';
      } else {
        report += `**🏃 Active Agents:** None\n\n`;
      }

      // 2. Failed/Interrupted Tasks
      if (failedTasks.length > 0) {
        report += `**⚠️ Issues Needs Attention (${failedTasks.length})**\n`;
        failedTasks.forEach((t: any) => {
          report += `• \`${t.agent_id || t.agentId}\`: ${t.error || 'Unknown error'}\n`;
        });
        report += '\n';
      }

      // 3. Trello Overview (if available)
      if (this.trelloService) {
        try {
            // This is a simple check - ideally we'd look for "Due Soon" or specific lists
            // For now, let's just list boards to show connection is alive
            const boards = await this.trelloService.getBoards();
            report += `**📋 Project Boards (${boards.length})**\n`;
            report += `Connected to Trello. Use agent commands to manage cards.\n`;
        } catch (e) {
            report += `**📋 Trello Status:** Error connecting\n`;
        }
      }

      report += `\n_To start a new task, just speak or type your command._`;

      await this.sendToChannel(channelId, report);
      logger.info(`✅ ${title} sent to channel ${channelId}`);

    } catch (error) {
      logger.error('Failed to generate daily briefing', error);
    }
  }

  private async sendToChannel(channelId: string, message: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        await (channel as TextChannel).send(message);
      }
    } catch (error) {
      logger.error(`Failed to send supervisor message to ${channelId}`, error);
    }
  }
}

