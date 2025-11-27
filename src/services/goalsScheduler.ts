import * as cron from 'node-cron';
import { Client, TextChannel, EmbedBuilder, Colors, Message } from 'discord.js';
import { logger } from '../utils/logger';
import { getAgentFlowDatabase } from './databaseFactory';
import { PostgresDatabaseService } from './postgresDatabaseService';

export interface GoalsSchedulerConfig {
  goalsChannelId: string; // The channel ID where goals reminders should be sent
  targetUserId: string; // The user ID to tag
  timezone?: string; // Timezone for scheduling (default: 'America/Los_Angeles')
  cronExpression?: string; // Custom cron expression (default: '0 8 * * *' for 8:00 AM)
}

export class GoalsScheduler {
  private client: Client;
  private db: PostgresDatabaseService | null = null;
  private scheduledTasks: Map<string, any> = new Map();
  private pendingGoals: Map<string, { date: string; guildId: string; channelId: string }> = new Map();

  constructor(client: Client) {
    this.client = client;
    this.db = getAgentFlowDatabase();
    if (!this.db) {
      logger.warn('GoalsScheduler: PostgreSQL database not available');
    }
    this.setupMessageListener();
  }

  /**
   * Setup message listener to capture goal responses
   */
  private setupMessageListener(): void {
    this.client.on('messageCreate', async (message: Message) => {
      // Ignore bot messages
      if (message.author.bot) return;

      // Check if this user has a pending goal prompt
      const pendingKey = `${message.author.id}`;
      const pending = this.pendingGoals.get(pendingKey);

      if (pending && message.channelId === pending.channelId) {
        // Goals feature temporarily disabled - needs PostgreSQL migration
        if (!this.db) {
          logger.warn('GoalsScheduler: Goals feature not available - needs PostgreSQL migration');
          return;
        }

        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];

        // TODO: Implement PostgreSQL-based goals storage
        logger.warn('GoalsScheduler: Goals storage not yet migrated to PostgreSQL');

        // Save the goal (placeholder - needs migration)
        try {
          // Placeholder until PostgreSQL migration is complete
          logger.info(`Would save goal for user ${message.author.username} on ${today}: ${message.content.slice(0, 50)}...`);

          // Send confirmation
          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('✅ Goals Recorded')
            .setDescription(`Your goals for **${today}** have been saved!`)
            .addFields({
              name: 'Your Goals',
              value: message.content.length > 1000 ? message.content.slice(0, 1000) + '...' : message.content
            })
            .setTimestamp()
            .setFooter({ text: 'AgentFlow Goals Tracker' });

          await message.reply({ embeds: [embed] });

          // Remove from pending after first response
          this.pendingGoals.delete(pendingKey);

          logger.info(`Saved daily goals for user ${message.author.username} (${message.author.id})`);
        } catch (error) {
          logger.error('Failed to save daily goal', error);
          await message.reply('❌ Failed to save your goals. Please try again.');
        }
      }
    });
  }

  /**
   * Schedule daily goals reminder for a specific user
   */
  scheduleGoalsReminder(guildId: string, config: GoalsSchedulerConfig): void {
    const taskKey = `${guildId}_${config.targetUserId}`;

    // Cancel existing task if any
    if (this.scheduledTasks.has(taskKey)) {
      this.scheduledTasks.get(taskKey)?.stop();
      this.scheduledTasks.delete(taskKey);
    }

    // Default to 8:00 AM PST (which is 8:00 in America/Los_Angeles timezone)
    const cronExpression = config.cronExpression || '0 8 * * *';
    const timezone = config.timezone || 'America/Los_Angeles';

    logger.info(`Scheduling goals reminder for user ${config.targetUserId} in guild ${guildId}`);
    logger.info(`Cron expression: ${cronExpression}, Timezone: ${timezone}`);

    // Schedule the task
    const task = cron.schedule(
      cronExpression,
      async () => {
        await this.sendGoalsReminder(guildId, config.goalsChannelId, config.targetUserId);
      },
      {
        timezone: timezone as any
      }
    );

    this.scheduledTasks.set(taskKey, task);
    logger.info(`✅ Goals reminder scheduled successfully for user ${config.targetUserId}`);
  }

  /**
   * Send the daily goals reminder
   */
  private async sendGoalsReminder(
    guildId: string,
    channelId: string,
    userId: string
  ): Promise<void> {
    // Skip if no database
    if (!this.db) {
      logger.warn('GoalsScheduler: sendGoalsReminder skipped - no database');
      return;
    }

    try {
      const guild = await this.client.guilds.fetch(guildId);
      if (!guild) {
        logger.warn(`Guild not found: ${guildId}`);
        return;
      }

      const channel = await guild.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        logger.warn(`Text channel not found: ${channelId}`);
        return;
      }

      const textChannel = channel as TextChannel;

      // Get today's date
      const today = new Date().toISOString().split('T')[0];
      const formattedDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // TODO: Implement PostgreSQL goals check
      // Goals feature disabled until PostgreSQL migration
      {
        // Send the daily prompt
        const embed = new EmbedBuilder()
          .setColor(Colors.Gold)
          .setTitle('🎯 Daily Goals Check-In')
          .setDescription(`Good morning <@${userId}>! ☀️\n\n**What are your goals for today?**\n\n${formattedDate}`)
          .addFields({
            name: '💡 Tip',
            value: 'Reply to this message with your goals for today. Be specific and actionable!'
          })
          .setTimestamp()
          .setFooter({ text: 'AgentFlow Goals Tracker' });

        await textChannel.send({ embeds: [embed] });

        // Mark this user as having a pending goal response
        this.pendingGoals.set(userId, { date: today, guildId, channelId });

        logger.info(`Sent daily goals reminder to user ${userId} in channel ${channelId}`);
      }
    } catch (error) {
      logger.error('Failed to send goals reminder', error);
    }
  }

  /**
   * Manually trigger a goals reminder (for testing)
   */
  async triggerGoalsReminder(
    guildId: string,
    channelId: string,
    userId: string
  ): Promise<void> {
    await this.sendGoalsReminder(guildId, channelId, userId);
  }

  /**
   * Get user's goals history
   * TODO: Implement PostgreSQL-based goals retrieval
   */
  async getUserGoals(userId: string, limit: number = 30): Promise<any[]> {
    logger.warn('GoalsScheduler: getUserGoals not yet migrated to PostgreSQL');
    return [];
  }

  /**
   * Get all goals for a specific date in a guild
   * TODO: Implement PostgreSQL-based goals retrieval
   */
  async getGuildGoalsForDate(guildId: string, date: string): Promise<any[]> {
    logger.warn('GoalsScheduler: getGuildGoalsForDate not yet migrated to PostgreSQL');
    return [];
  }

  /**
   * Cancel scheduled reminder for a user
   */
  cancelScheduledReminder(guildId: string, userId: string): void {
    const taskKey = `${guildId}_${userId}`;
    const task = this.scheduledTasks.get(taskKey);
    
    if (task) {
      task.stop();
      this.scheduledTasks.delete(taskKey);
      logger.info(`Cancelled goals reminder for user ${userId} in guild ${guildId}`);
    }
  }

  /**
   * Get all scheduled reminders
   */
  getScheduledReminders(): string[] {
    return Array.from(this.scheduledTasks.keys());
  }

  /**
   * Stop all scheduled tasks
   */
  stopAll(): void {
    this.scheduledTasks.forEach((task, key) => {
      task.stop();
      logger.info(`Stopped goals reminder: ${key}`);
    });
    this.scheduledTasks.clear();
    this.pendingGoals.clear();
  }
}

