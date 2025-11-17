import { Client } from 'discord.js';
import { DiscordChannelAwareness, MessageType } from './discordChannelAwareness';
import { ChannelNotifier } from './channelNotifier';
import { logger } from '../utils/logger';

/**
 * Intelligent Channel Notifier
 * Combines ChannelAwareness with ChannelNotifier for smart message routing
 */
export class IntelligentChannelNotifier extends ChannelNotifier {
  private channelAwareness: DiscordChannelAwareness;

  constructor(client: Client, systemNotificationChannelId?: string) {
    super(client, systemNotificationChannelId);
    this.channelAwareness = new DiscordChannelAwareness(client);
  }

  /**
   * Send a message with automatic channel routing
   */
  async sendIntelligentMessage(
    guildId: string,
    message: string,
    messageType: MessageType = 'general',
    options?: {
      projectName?: string;
      asEmbed?: boolean;
      fallbackChannelId?: string;
    }
  ): Promise<void> {
    try {
      // Find best channel for this message type
      const channelId = await this.channelAwareness.findBestChannel(
        guildId,
        messageType,
        message,
        options?.projectName
      );

      if (!channelId) {
        if (options?.fallbackChannelId) {
          logger.warn(`Using fallback channel ${options.fallbackChannelId}`);
          await this.sendMessage(guildId, options.fallbackChannelId, message, options?.asEmbed);
        } else {
          logger.error(`No appropriate channel found for message type: ${messageType}`);
        }
        return;
      }

      // Send to the intelligently selected channel
      await this.sendMessage(guildId, channelId, message, options?.asEmbed);
    } catch (error) {
      logger.error('Failed to send intelligent message', error);
    }
  }

  /**
   * Send agent notification with intelligent routing
   */
  async notifyAgent(
    guildId: string,
    message: string,
    messageType: MessageType = 'agent_update',
    projectName?: string
  ): Promise<void> {
    await this.sendIntelligentMessage(guildId, message, messageType, { projectName });
  }

  /**
   * Send project update to appropriate channel
   */
  async notifyProjectUpdate(
    guildId: string,
    projectName: string,
    message: string
  ): Promise<void> {
    await this.sendIntelligentMessage(guildId, message, 'project_update', { projectName });
  }

  /**
   * Send error to appropriate error channel
   */
  async notifyError(guildId: string, error: string): Promise<void> {
    await this.sendIntelligentMessage(guildId, `❌ **Error**\n\`\`\`\n${error}\n\`\`\``, 'error');
  }

  /**
   * Send success message
   */
  async notifySuccess(guildId: string, message: string): Promise<void> {
    await this.sendIntelligentMessage(guildId, `✅ **Success**\n${message}`, 'success');
  }

  /**
   * Send deployment notification with intelligent routing
   */
  async notifyDeploymentSmart(guildId: string, service: string, status: string): Promise<void> {
    await this.sendIntelligentMessage(
      guildId,
      `🚀 **Deployment: ${service}**\n${status}`,
      'deployment'
    );
  }

  /**
   * Send financial alert
   */
  async notifyFinance(guildId: string, alert: string): Promise<void> {
    await this.sendIntelligentMessage(guildId, `💰 **Finance**\n${alert}`, 'finance');
  }

  /**
   * Send goal update
   */
  async notifyGoal(guildId: string, goal: string): Promise<void> {
    await this.sendIntelligentMessage(guildId, `🎯 **Goal Update**\n${goal}`, 'goal');
  }

  /**
   * Send crypto alert
   */
  async notifyCrypto(guildId: string, alert: string): Promise<void> {
    await this.sendIntelligentMessage(guildId, `₿ **Crypto Alert**\n${alert}`, 'crypto');
  }

  /**
   * Send code snippet to appropriate channel
   */
  async sendCodeToChannel(
    guildId: string,
    code: string,
    language: string = '',
    title?: string
  ): Promise<void> {
    const channelId = await this.channelAwareness.findBestChannel(guildId, 'code', code);
    
    if (channelId) {
      await this.sendCodeBlock(guildId, channelId, code, language, title);
    }
  }

  /**
   * Get server awareness instance
   */
  getChannelAwareness(): DiscordChannelAwareness {
    return this.channelAwareness;
  }

  /**
   * Discover and display server structure
   */
  async discoverAndDisplayServer(guildId: string): Promise<void> {
    const summary = await this.channelAwareness.getGuildSummary(guildId);
    logger.info(`\n${summary}`);
  }
}

