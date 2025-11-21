import { Client, TextChannel } from 'discord.js';
import { getDatabase } from './databaseFactory';
import { logger } from '../utils/logger';
import { TrelloService } from './trello';
import * as cron from 'node-cron';
import { BotConfig } from '../types';

/**
 * SupervisorService - The "Chief of Staff" for the Agentic Framework.
 * 
 * Responsibilities:
 * 1. Monitor task health (stalled/failed tasks).
 * 2. Provide daily briefings.
 * 3. Nudge the user about forgotten Trello cards.
 */
export class SupervisorService {
  private client: Client;
  private config: BotConfig;
  private trelloService?: TrelloService;
  private jobs: cron.ScheduledTask[] = [];

  constructor(client: Client, config: BotConfig, trelloService?: TrelloService) {
    this.client = client;
    this.config = config;
    this.trelloService = trelloService;
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

    // Hourly Health Check
    this.jobs.push(cron.schedule('0 * * * *', () => {
      this.checkTaskHealth();
    }));

    logger.info(`✅ Supervisor scheduled: Morning (9am), Evening (6pm), and Hourly checks.`);
  }

  stop(): void {
    this.jobs.forEach(job => job.stop());
    logger.info('Supervisor Service stopped');
  }

  /**
   * Run a health check on tasks and report critical issues immediately
   */
  private async checkTaskHealth(): Promise<void> {
    const db = getDatabase();
    const failedTasks = db.getFailedTasks(1); // Last 1 hour

    if (failedTasks.length > 0) {
      const channelId = this.config.systemNotificationChannelId;
      if (!channelId) return;

      const message = `🚨 **Supervisor Alert**\n${failedTasks.length} task(s) failed in the last hour. Please review using \`!tasks failed\`.`;
      await this.sendToChannel(channelId, message);
    }
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
      const db = getDatabase();
      const activeTasks = db.getAllActiveAgentTasks();
      const failedTasks = db.getFailedTasks(24); // Last 24h
      
      // Build the report
      let report = `📊 **${title}**\n\n`;

      // 1. Active Agent Tasks
      if (activeTasks.length > 0) {
        report += `**🏃 Active Agents (${activeTasks.length})**\n`;
        activeTasks.forEach((t: any) => {
          const duration = Math.round((Date.now() - t.startedAt.getTime()) / 1000 / 60); // minutes
          report += `• \`${t.agentId}\`: ${t.taskDescription.substring(0, 50)}... (${duration}m ago)\n`;
        });
        report += '\n';
      } else {
        report += `**🏃 Active Agents:** None\n\n`;
      }

      // 2. Failed/Interrupted Tasks
      if (failedTasks.length > 0) {
        report += `**⚠️ Issues Needs Attention (${failedTasks.length})**\n`;
        failedTasks.forEach((t: any) => {
          report += `• \`${t.agentId}\`: ${t.error || 'Unknown error'}\n`;
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

