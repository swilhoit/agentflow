import { Client, TextChannel } from 'discord.js';
import { logger } from './logger';

/**
 * Discord Logger - Sends important events and errors to Discord
 * So the user can see what's happening in real-time
 */
export class DiscordLogger {
  private client: Client;
  private defaultChannelId: string | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  setDefaultChannel(channelId: string) {
    this.defaultChannelId = channelId;
  }

  /**
   * Send any message to Discord
   */
  async send(channelId: string, message: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel && channel.isTextBased() && 'send' in channel) {
        // Chunk if needed (Discord 2000 char limit)
        if (message.length <= 2000) {
          await (channel as TextChannel).send(message);
        } else {
          const chunks = this.chunkMessage(message, 1900);
          for (const chunk of chunks) {
            await (channel as TextChannel).send(chunk);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to send Discord message', error);
    }
  }

  /**
   * Send to default channel if set
   */
  async sendToDefault(message: string): Promise<void> {
    if (this.defaultChannelId) {
      await this.send(this.defaultChannelId, message);
    }
  }

  /**
   * Log an error to Discord
   */
  async error(channelId: string, error: any, context?: string): Promise<void> {
    const errorMsg = context 
      ? `❌ **Error: ${context}**\n\`\`\`\n${error instanceof Error ? error.message : JSON.stringify(error)}\n\`\`\``
      : `❌ **Error**\n\`\`\`\n${error instanceof Error ? error.message : JSON.stringify(error)}\n\`\`\``;
    
    await this.send(channelId, errorMsg);
  }

  /**
   * Log a warning to Discord
   */
  async warn(channelId: string, message: string): Promise<void> {
    await this.send(channelId, `⚠️ **Warning**\n${message}`);
  }

  /**
   * Log info to Discord
   */
  async info(channelId: string, message: string): Promise<void> {
    await this.send(channelId, `ℹ️ ${message}`);
  }

  /**
   * Log success to Discord
   */
  async success(channelId: string, message: string): Promise<void> {
    await this.send(channelId, `✅ ${message}`);
  }

  /**
   * Log a status update
   */
  async status(channelId: string, message: string): Promise<void> {
    await this.send(channelId, `📊 **Status Update**\n${message}`);
  }

  /**
   * Log function call to Discord for transparency
   */
  async functionCall(channelId: string, functionName: string, params: any): Promise<void> {
    const paramsStr = JSON.stringify(params, null, 2);
    const message = `🔧 **Function Called: ${functionName}**\n\`\`\`json\n${paramsStr.substring(0, 1500)}\n\`\`\``;
    await this.send(channelId, message);
  }

  /**
   * Log voice session events
   */
  async voiceEvent(channelId: string, event: string, details?: string): Promise<void> {
    const message = details 
      ? `🎤 **Voice: ${event}**\n${details}`
      : `🎤 **Voice: ${event}**`;
    await this.send(channelId, message);
  }

  /**
   * Chunk messages into Discord-safe sizes
   */
  private chunkMessage(message: string, maxLength: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < message.length; i += maxLength) {
      chunks.push(message.substring(i, i + maxLength));
    }
    return chunks;
  }

  /**
   * Send a progress indicator
   */
  async progress(channelId: string, message: string, percentage?: number): Promise<void> {
    const progressBar = percentage !== undefined 
      ? this.createProgressBar(percentage)
      : '';
    
    const fullMessage = percentage !== undefined
      ? `⏳ **${message}**\n${progressBar} ${percentage}%`
      : `⏳ **${message}**`;
    
    await this.send(channelId, fullMessage);
  }

  /**
   * Create a simple progress bar
   */
  private createProgressBar(percentage: number): string {
    const filled = Math.floor(percentage / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Send a debug message (only if enabled)
   */
  async debug(channelId: string, message: string, data?: any): Promise<void> {
    if (process.env.DEBUG_TO_DISCORD === 'true') {
      const debugMsg = data
        ? `🐛 **Debug: ${message}**\n\`\`\`json\n${JSON.stringify(data, null, 2).substring(0, 1500)}\n\`\`\``
        : `🐛 **Debug:** ${message}`;
      await this.send(channelId, debugMsg);
    }
  }
}

