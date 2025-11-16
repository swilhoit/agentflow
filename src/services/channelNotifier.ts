import { Client, TextChannel, EmbedBuilder, Colors } from 'discord.js';
import { logger } from '../utils/logger';
import { getDatabase } from './database';

export interface ProgressUpdate {
  agentId: string;
  step: number;
  totalSteps: number;
  action: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface LogUpdate {
  agentId: string;
  logType: 'info' | 'warning' | 'error' | 'success' | 'step';
  message: string;
  details?: string;
}

export class ChannelNotifier {
  private client: Client;
  private db = getDatabase();

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Post agent start notification
   */
  async notifyAgentStart(
    guildId: string,
    channelId: string,
    agentId: string,
    taskDescription: string,
    userId: string
  ): Promise<void> {
    try {
      const channel = await this.getTextChannel(guildId, channelId);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle('🤖 Autonomous Agent Spawned')
        .setDescription(taskDescription)
        .addFields(
          { name: 'Agent ID', value: `\`${agentId}\``, inline: true },
          { name: 'Started By', value: `<@${userId}>`, inline: true },
          { name: 'Status', value: '🔄 Initializing...', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'AgentFlow - YOLO Mode Active' });

      await channel.send({ embeds: [embed] });

      // Log to database
      this.db.logAgentActivity({
        agentId,
        taskId: agentId,
        guildId,
        channelId,
        logType: 'info',
        message: `Agent spawned: ${taskDescription}`,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to notify agent start', error);
    }
  }

  /**
   * Post agent progress update
   */
  async notifyAgentProgress(
    guildId: string,
    channelId: string,
    update: ProgressUpdate
  ): Promise<void> {
    try {
      const channel = await this.getTextChannel(guildId, channelId);
      if (!channel) return;

      const progressBar = this.createProgressBar(update.step, update.totalSteps);
      const statusEmoji = {
        pending: '⏳',
        running: '🔄',
        completed: '✅',
        failed: '❌'
      }[update.status];

      const embed = new EmbedBuilder()
        .setColor(update.status === 'completed' ? Colors.Green : Colors.Yellow)
        .setTitle(`${statusEmoji} Agent Progress Update`)
        .setDescription(`**Step ${update.step}/${update.totalSteps}:** ${update.action}`)
        .addFields({
          name: 'Progress',
          value: progressBar
        })
        .setTimestamp()
        .setFooter({ text: `Agent ID: ${update.agentId}` });

      await channel.send({ embeds: [embed] });

      // Log to database
      this.db.logAgentActivity({
        agentId: update.agentId,
        taskId: update.agentId,
        guildId,
        channelId,
        logType: 'step',
        message: `Step ${update.step}: ${update.action}`,
        details: JSON.stringify({ step: update.step, totalSteps: update.totalSteps, status: update.status }),
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to notify agent progress', error);
    }
  }

  /**
   * Post agent log
   */
  async notifyAgentLog(
    guildId: string,
    channelId: string,
    log: LogUpdate
  ): Promise<void> {
    try {
      const channel = await this.getTextChannel(guildId, channelId);
      if (!channel) return;

      // Skip posting every single log - only post important ones
      if (log.logType !== 'error' && log.logType !== 'success' && log.logType !== 'warning') {
        // Still log to database
        this.db.logAgentActivity({
          agentId: log.agentId,
          taskId: log.agentId,
          guildId,
          channelId,
          logType: log.logType,
          message: log.message,
          details: log.details,
          timestamp: new Date()
        });
        return;
      }

      const colors = {
        info: Colors.Blue,
        warning: Colors.Yellow,
        error: Colors.Red,
        success: Colors.Green,
        step: Colors.Blue
      };

      const emojis = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '❌',
        success: '✅',
        step: '📝'
      };

      const embed = new EmbedBuilder()
        .setColor(colors[log.logType])
        .setTitle(`${emojis[log.logType]} Agent ${log.logType.toUpperCase()}`)
        .setDescription(log.message)
        .setTimestamp()
        .setFooter({ text: `Agent ID: ${log.agentId}` });

      if (log.details) {
        embed.addFields({ name: 'Details', value: `\`\`\`\n${log.details.slice(0, 1000)}\n\`\`\`` });
      }

      await channel.send({ embeds: [embed] });

      // Log to database
      this.db.logAgentActivity({
        agentId: log.agentId,
        taskId: log.agentId,
        guildId,
        channelId,
        logType: log.logType,
        message: log.message,
        details: log.details,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to notify agent log', error);
    }
  }

  /**
   * Post agent completion notification
   */
  async notifyAgentComplete(
    guildId: string,
    channelId: string,
    agentId: string,
    success: boolean,
    summary: string,
    details?: any
  ): Promise<void> {
    try {
      const channel = await this.getTextChannel(guildId, channelId);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(success ? Colors.Green : Colors.Red)
        .setTitle(success ? '✅ Agent Task Completed' : '❌ Agent Task Failed')
        .setDescription(summary)
        .setTimestamp()
        .setFooter({ text: `Agent ID: ${agentId}` });

      if (details) {
        if (details.duration) {
          embed.addFields({
            name: 'Duration',
            value: `${(details.duration / 1000).toFixed(2)}s`,
            inline: true
          });
        }
        if (details.steps) {
          embed.addFields({
            name: 'Steps Executed',
            value: `${details.steps}`,
            inline: true
          });
        }
        if (details.testResults) {
          const passed = details.testResults.filter((t: any) => t.passed).length;
          const total = details.testResults.length;
          embed.addFields({
            name: 'Tests',
            value: `${passed}/${total} passed`,
            inline: true
          });
        }
      }

      await channel.send({ embeds: [embed] });

      // Log to database
      this.db.logAgentActivity({
        agentId,
        taskId: agentId,
        guildId,
        channelId,
        logType: success ? 'success' : 'error',
        message: summary,
        details: details ? JSON.stringify(details) : undefined,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to notify agent complete', error);
    }
  }

  /**
   * Post a simple message to a channel
   */
  async sendMessage(
    guildId: string,
    channelId: string,
    message: string,
    asEmbed: boolean = false
  ): Promise<void> {
    try {
      const channel = await this.getTextChannel(guildId, channelId);
      if (!channel) return;

      if (asEmbed) {
        const embed = new EmbedBuilder()
          .setColor(Colors.Blue)
          .setDescription(message)
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      } else {
        await channel.send(message);
      }
    } catch (error) {
      logger.error('Failed to send message', error);
    }
  }

  /**
   * Post code block
   */
  async sendCodeBlock(
    guildId: string,
    channelId: string,
    code: string,
    language: string = '',
    title?: string
  ): Promise<void> {
    try {
      const channel = await this.getTextChannel(guildId, channelId);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setDescription(`\`\`\`${language}\n${code.slice(0, 4000)}\n\`\`\``)
        .setTimestamp();

      if (title) {
        embed.setTitle(title);
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Failed to send code block', error);
    }
  }

  /**
   * Create progress bar
   */
  private createProgressBar(current: number, total: number, length: number = 20): string {
    const percentage = Math.min(100, Math.max(0, (current / total) * 100));
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `${bar} ${percentage.toFixed(0)}%`;
  }

  /**
   * Get text channel
   */
  private async getTextChannel(guildId: string, channelId: string): Promise<TextChannel | null> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      if (!guild) {
        logger.warn(`Guild not found: ${guildId}`);
        return null;
      }

      const channel = await guild.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        logger.warn(`Text channel not found: ${channelId}`);
        return null;
      }

      return channel as TextChannel;
    } catch (error) {
      logger.error(`Failed to get text channel: ${channelId}`, error);
      return null;
    }
  }
}
