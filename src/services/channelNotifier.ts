import { Client, TextChannel, EmbedBuilder, Colors } from 'discord.js';
import { logger } from '../utils/logger';
import { isUsingSupabase, isUsingPostgres, getSQLiteDatabase, getAgentFlowDatabase } from './databaseFactory';
import { DatabaseService } from './database';
import { PostgresDatabaseService } from './postgresDatabaseService';

export interface ProgressUpdate {
  agentId: string;
  step: number;
  totalSteps: number;
  action: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface LogUpdate {
  agentId: string;
  logType: 'info' | 'warning' | 'error' | 'success' | 'step' | 'thinking' | 'action' | 'command' | 'reading' | 'writing';
  message: string;
  details?: string;
}

export interface ThinkingUpdate {
  agentId: string;
  thought: string;
  context?: string;
}

export interface ActionUpdate {
  agentId: string;
  action: string;
  target?: string;
  status: 'starting' | 'in_progress' | 'completed';
}

export class ChannelNotifier {
  private client: Client;
  private db: DatabaseService | null = null;
  private pgDb: PostgresDatabaseService | null = null;
  private systemNotificationChannelId?: string;

  constructor(client: Client, systemNotificationChannelId?: string) {
    this.client = client;
    this.systemNotificationChannelId = systemNotificationChannelId;
    
    // Initialize database based on configuration
    if (isUsingPostgres()) {
      this.pgDb = getAgentFlowDatabase();
    } else if (!isUsingSupabase()) {
      try {
        this.db = getSQLiteDatabase();
      } catch (e) {
        logger.warn('ChannelNotifier: SQLite not available');
      }
    }
  }

  setSystemNotificationChannelId(channelId: string): void {
    this.systemNotificationChannelId = channelId;
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
      // Use system notification channel if configured, otherwise use conversation channel
      const targetChannelId = this.systemNotificationChannelId || channelId;
      const channel = await this.getTextChannel(guildId, targetChannelId);
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
      this.db?.logAgentActivity({
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
      // Use system notification channel if configured, otherwise use conversation channel
      const targetChannelId = this.systemNotificationChannelId || channelId;
      const channel = await this.getTextChannel(guildId, targetChannelId);
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
      this.db?.logAgentActivity({
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
      // Use system notification channel if configured, otherwise use conversation channel
      const targetChannelId = this.systemNotificationChannelId || channelId;
      const channel = await this.getTextChannel(guildId, targetChannelId);
      if (!channel) return;

      // Skip posting every single log - only post important ones (but include new granular types)
      const shouldPost = ['error', 'success', 'warning', 'thinking', 'action', 'command', 'reading', 'writing'].includes(log.logType);
      
      // Map new log types to database-compatible types
      const dbLogType: 'info' | 'warning' | 'error' | 'success' | 'step' = 
        log.logType === 'error' ? 'error' :
        log.logType === 'warning' ? 'warning' :
        log.logType === 'success' ? 'success' :
        log.logType === 'step' ? 'step' :
        'info'; // Default for thinking, action, command, reading, writing
      
      // Still log to database
      this.db?.logAgentActivity({
        agentId: log.agentId,
        taskId: log.agentId,
        guildId,
        channelId,
        logType: dbLogType,
        message: log.message,
        details: log.details,
        timestamp: new Date()
      });
      
      if (!shouldPost) {
        return;
      }

      const colors: Record<string, any> = {
        info: Colors.Blue,
        warning: Colors.Yellow,
        error: Colors.Red,
        success: Colors.Green,
        step: Colors.Blue,
        thinking: Colors.Purple,
        action: Colors.Orange,
        command: Colors.Yellow,
        reading: Colors.Blue,
        writing: Colors.Green
      };

      const emojis: Record<string, string> = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '❌',
        success: '✅',
        step: '📝',
        thinking: '🤔',
        action: '⚡',
        command: '🔧',
        reading: '📖',
        writing: '✍️'
      };

      const embed = new EmbedBuilder()
        .setColor(colors[log.logType] || Colors.Blue)
        .setTitle(`${emojis[log.logType] || 'ℹ️'} ${log.logType.toUpperCase()}`)
        .setDescription(log.message)
        .setTimestamp()
        .setFooter({ text: `Agent ID: ${log.agentId}` });

      if (log.details) {
        embed.addFields({ name: 'Details', value: `\`\`\`\n${log.details.slice(0, 1000)}\n\`\`\`` });
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Failed to notify agent log', error);
    }
  }

  /**
   * Post agent thinking update (brief, non-intrusive)
   */
  async notifyAgentThinking(
    guildId: string,
    channelId: string,
    update: ThinkingUpdate
  ): Promise<void> {
    try {
      const targetChannelId = this.systemNotificationChannelId || channelId;
      const channel = await this.getTextChannel(guildId, targetChannelId);
      if (!channel) return;

      // Use simple message format for thinking updates to avoid Discord spam
      const message = `🤔 **Thinking:** ${update.thought}${update.context ? ` (${update.context})` : ''}`;
      await channel.send(message);

      // Log to database
      this.db?.logAgentActivity({
        agentId: update.agentId,
        taskId: update.agentId,
        guildId,
        channelId,
        logType: 'info',
        message: update.thought,
        details: update.context,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to notify agent thinking', error);
    }
  }

  /**
   * Post agent action update
   */
  async notifyAgentAction(
    guildId: string,
    channelId: string,
    update: ActionUpdate
  ): Promise<void> {
    try {
      const targetChannelId = this.systemNotificationChannelId || channelId;
      const channel = await this.getTextChannel(guildId, targetChannelId);
      if (!channel) return;

      const statusEmoji = {
        starting: '▶️',
        in_progress: '⏳',
        completed: '✅'
      }[update.status];

      const message = `${statusEmoji} **${update.action}**${update.target ? `: \`${update.target}\`` : ''}`;
      await channel.send(message);

      // Log to database
      this.db?.logAgentActivity({
        agentId: update.agentId,
        taskId: update.agentId,
        guildId,
        channelId,
        logType: 'info',
        message: `${update.action}: ${update.target || 'N/A'}`,
        details: update.status,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to notify agent action', error);
    }
  }

  /**
   * Post command execution update (real-time)
   */
  async notifyCommandExecution(
    guildId: string,
    channelId: string,
    agentId: string,
    command: string,
    status: 'starting' | 'running' | 'completed' | 'failed',
    output?: string
  ): Promise<void> {
    try {
      const targetChannelId = this.systemNotificationChannelId || channelId;
      const channel = await this.getTextChannel(guildId, targetChannelId);
      if (!channel) return;

      const statusEmoji = {
        starting: '▶️',
        running: '⏳',
        completed: '✅',
        failed: '❌'
      }[status];

      let message = `${statusEmoji} **Command ${status}**\n\`\`\`bash\n${command.slice(0, 200)}\n\`\`\``;
      
      if (output && status === 'completed') {
        const truncatedOutput = output.length > 500 ? output.slice(0, 500) + '\n...(truncated)' : output;
        message += `\n**Output:**\n\`\`\`\n${truncatedOutput}\n\`\`\``;
      } else if (output && status === 'failed') {
        message += `\n**Error:**\n\`\`\`\n${output.slice(0, 500)}\n\`\`\``;
      }

      await channel.send(message);

      // Log to database
      this.db?.logAgentActivity({
        agentId,
        taskId: agentId,
        guildId,
        channelId,
        logType: status === 'failed' ? 'error' : 'info',
        message: `Command ${status}: ${command}`,
        details: output,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to notify command execution', error);
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
      // Use system notification channel if configured, otherwise use conversation channel
      const targetChannelId = this.systemNotificationChannelId || channelId;
      const channel = await this.getTextChannel(guildId, targetChannelId);
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
      this.db?.logAgentActivity({
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
   * Post cloud deployment event
   */
  async notifyDeployment(
    guildId: string,
    channelId: string,
    event: {
      type: 'started' | 'progress' | 'completed' | 'failed';
      serviceName: string;
      message: string;
      details?: string;
      url?: string;
    }
  ): Promise<void> {
    try {
      const channel = await this.getTextChannel(guildId, channelId);
      if (!channel) return;

      const colors = {
        started: Colors.Blue,
        progress: Colors.Yellow,
        completed: Colors.Green,
        failed: Colors.Red
      };

      const emojis = {
        started: '🚀',
        progress: '⚙️',
        completed: '✅',
        failed: '❌'
      };

      const embed = new EmbedBuilder()
        .setColor(colors[event.type])
        .setTitle(`${emojis[event.type]} Cloud Deployment - ${event.serviceName}`)
        .setDescription(event.message)
        .setTimestamp()
        .setFooter({ text: 'AgentFlow Cloud Deployment' });

      if (event.details) {
        embed.addFields({ name: 'Details', value: event.details });
      }

      if (event.url) {
        embed.addFields({ name: 'Service URL', value: event.url });
      }

      await channel.send({ embeds: [embed] });

      // Log to database
      this.db?.logAgentActivity({
        agentId: 'system',
        taskId: `deployment_${Date.now()}`,
        guildId,
        channelId,
        logType: event.type === 'failed' ? 'error' : 'info',
        message: `[Deployment] ${event.serviceName}: ${event.message}`,
        details: event.details,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to notify deployment', error);
    }
  }

  /**
   * Post system health/monitoring event
   */
  async notifySystemEvent(
    guildId: string,
    channelId: string,
    event: {
      type: 'startup' | 'shutdown' | 'error' | 'warning' | 'info';
      component: string;
      message: string;
      details?: string;
      metrics?: Record<string, string | number>;
    }
  ): Promise<void> {
    try {
      const channel = await this.getTextChannel(guildId, channelId);
      if (!channel) return;

      const colors = {
        startup: Colors.Green,
        shutdown: Colors.Yellow,
        error: Colors.Red,
        warning: Colors.Yellow,
        info: Colors.Blue
      };

      const emojis = {
        startup: '🟢',
        shutdown: '🔴',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
      };

      const embed = new EmbedBuilder()
        .setColor(colors[event.type])
        .setTitle(`${emojis[event.type]} System Event - ${event.component}`)
        .setDescription(event.message)
        .setTimestamp()
        .setFooter({ text: 'AgentFlow System Monitor' });

      if (event.details) {
        embed.addFields({ name: 'Details', value: `\`\`\`\n${event.details.slice(0, 1000)}\n\`\`\`` });
      }

      if (event.metrics) {
        const metricsText = Object.entries(event.metrics)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');
        embed.addFields({ name: 'Metrics', value: metricsText, inline: false });
      }

      await channel.send({ embeds: [embed] });

      // Log to database
      this.db?.logAgentActivity({
        agentId: 'system',
        taskId: `system_${Date.now()}`,
        guildId,
        channelId,
        logType: event.type === 'error' ? 'error' : event.type === 'warning' ? 'warning' : 'info',
        message: `[${event.component}] ${event.message}`,
        details: event.details,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to notify system event', error);
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
