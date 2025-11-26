import { Client, TextChannel, EmbedBuilder, Colors } from 'discord.js';
import { logger } from '../utils/logger';
import * as https from 'https';
import * as http from 'http';

/**
 * Startup event types
 */
export type StartupEventType = 
  | 'startup_begin'
  | 'startup_success' 
  | 'startup_failure'
  | 'shutdown'
  | 'crash'
  | 'health_check'
  | 'service_error';

/**
 * Startup event record
 */
export interface StartupEvent {
  id?: number;
  eventType: StartupEventType;
  message: string;
  details?: string;
  stackTrace?: string;
  timestamp: Date;
}

/**
 * StartupLogger - Robust logging for startup, shutdown, and critical errors
 * 
 * Features:
 * - Logs to SQLite database (persists across restarts)
 * - Sends critical errors to Discord webhook (works even without Discord client)
 * - Posts startup/shutdown notifications to Discord channel
 */
export class StartupLogger {
  private static instance: StartupLogger;
  private discordClient?: Client;
  private webhookUrl?: string;
  private notificationChannelId?: string;
  private dbPath: string;
  private db: any; // better-sqlite3 instance
  
  private constructor() {
    this.webhookUrl = process.env.DISCORD_ERROR_WEBHOOK_URL;
    this.notificationChannelId = process.env.SYSTEM_NOTIFICATION_CHANNEL_ID;
    this.dbPath = process.env.DATABASE_PATH || './data/agentflow.db';
    
    this.initializeDatabase();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): StartupLogger {
    if (!StartupLogger.instance) {
      StartupLogger.instance = new StartupLogger();
    }
    return StartupLogger.instance;
  }

  /**
   * Set Discord client for rich notifications
   */
  setDiscordClient(client: Client): void {
    this.discordClient = client;
  }

  /**
   * Initialize the startup_logs table
   */
  private initializeDatabase(): void {
    try {
      // Use better-sqlite3 directly to avoid circular dependency with databaseFactory
      const Database = require('better-sqlite3');
      const path = require('path');
      const fs = require('fs');
      
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      this.db = new Database(this.dbPath);
      
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS startup_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type TEXT NOT NULL,
          message TEXT NOT NULL,
          details TEXT,
          stack_trace TEXT,
          timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_startup_logs_type ON startup_logs(event_type, timestamp DESC)`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_startup_logs_time ON startup_logs(timestamp DESC)`);
      
    } catch (error) {
      // Can't use logger here as it might not be initialized
      console.error('[StartupLogger] Failed to initialize database:', error);
    }
  }

  /**
   * Log an event to the database
   */
  private logToDatabase(event: StartupEvent): void {
    try {
      if (!this.db) return;
      
      const stmt = this.db.prepare(`
        INSERT INTO startup_logs (event_type, message, details, stack_trace, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        event.eventType,
        event.message,
        event.details || null,
        event.stackTrace || null,
        event.timestamp.toISOString()
      );
    } catch (error) {
      console.error('[StartupLogger] Failed to log to database:', error);
    }
  }

  /**
   * Send critical error to Discord webhook (works without Discord client)
   */
  private async sendToWebhook(event: StartupEvent): Promise<void> {
    if (!this.webhookUrl) return;

    try {
      const payload = JSON.stringify({
        embeds: [{
          title: this.getEventEmoji(event.eventType) + ' ' + this.getEventTitle(event.eventType),
          description: event.message,
          color: this.getEventColor(event.eventType),
          fields: [
            ...(event.details ? [{ name: 'Details', value: event.details.substring(0, 1024) }] : []),
            ...(event.stackTrace ? [{ name: 'Stack Trace', value: '```\n' + event.stackTrace.substring(0, 900) + '\n```' }] : []),
          ],
          timestamp: event.timestamp.toISOString(),
          footer: { text: 'AgentFlow Startup Logger' }
        }]
      });

      const url = new URL(this.webhookUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const httpModule = url.protocol === 'https:' ? https : http;
      
      await new Promise<void>((resolve, reject) => {
        const req = httpModule.request(options, (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`Webhook returned ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
      });
      
    } catch (error) {
      console.error('[StartupLogger] Failed to send webhook:', error);
    }
  }

  /**
   * Send to Discord channel via client
   */
  private async sendToChannel(event: StartupEvent): Promise<void> {
    if (!this.discordClient || !this.notificationChannelId) return;

    try {
      const channel = await this.discordClient.channels.fetch(this.notificationChannelId);
      if (!channel || !channel.isTextBased()) return;

      const embed = new EmbedBuilder()
        .setTitle(this.getEventEmoji(event.eventType) + ' ' + this.getEventTitle(event.eventType))
        .setDescription(event.message)
        .setColor(this.getEventColor(event.eventType))
        .setTimestamp(event.timestamp)
        .setFooter({ text: 'AgentFlow System' });

      if (event.details) {
        embed.addFields({ name: 'Details', value: event.details.substring(0, 1024) });
      }

      await (channel as TextChannel).send({ embeds: [embed] });
    } catch (error) {
      console.error('[StartupLogger] Failed to send to channel:', error);
    }
  }

  private getEventEmoji(type: StartupEventType): string {
    switch (type) {
      case 'startup_begin': return '🚀';
      case 'startup_success': return '✅';
      case 'startup_failure': return '❌';
      case 'shutdown': return '🛑';
      case 'crash': return '💥';
      case 'health_check': return '💓';
      case 'service_error': return '⚠️';
      default: return '📋';
    }
  }

  private getEventTitle(type: StartupEventType): string {
    switch (type) {
      case 'startup_begin': return 'AgentFlow Starting';
      case 'startup_success': return 'AgentFlow Online';
      case 'startup_failure': return 'Startup Failed';
      case 'shutdown': return 'AgentFlow Shutting Down';
      case 'crash': return 'CRITICAL: AgentFlow Crashed';
      case 'health_check': return 'System Health Check';
      case 'service_error': return 'Service Error';
      default: return 'System Event';
    }
  }

  private getEventColor(type: StartupEventType): number {
    switch (type) {
      case 'startup_begin': return Colors.Blue;
      case 'startup_success': return Colors.Green;
      case 'startup_failure': return Colors.Red;
      case 'shutdown': return Colors.Orange;
      case 'crash': return Colors.DarkRed;
      case 'health_check': return Colors.Aqua;
      case 'service_error': return Colors.Yellow;
      default: return Colors.Grey;
    }
  }

  /**
   * Log startup beginning
   */
  async logStartupBegin(): Promise<void> {
    const event: StartupEvent = {
      eventType: 'startup_begin',
      message: 'AgentFlow is starting up...',
      details: `PID: ${process.pid}\nNode: ${process.version}\nPlatform: ${process.platform}`,
      timestamp: new Date()
    };
    
    this.logToDatabase(event);
    // Don't send to webhook/channel on begin - wait for success/failure
  }

  /**
   * Log successful startup
   */
  async logStartupSuccess(services: string[]): Promise<void> {
    const event: StartupEvent = {
      eventType: 'startup_success',
      message: 'AgentFlow started successfully!',
      details: `Services initialized:\n${services.map(s => '• ' + s).join('\n')}`,
      timestamp: new Date()
    };
    
    this.logToDatabase(event);
    await this.sendToChannel(event);
  }

  /**
   * Log startup failure - ALWAYS sends to webhook
   */
  async logStartupFailure(error: Error): Promise<void> {
    const event: StartupEvent = {
      eventType: 'startup_failure',
      message: `Failed to start AgentFlow: ${error.message}`,
      details: 'The bot failed to initialize. Check the error details below.',
      stackTrace: error.stack,
      timestamp: new Date()
    };
    
    this.logToDatabase(event);
    await this.sendToWebhook(event); // Always send to webhook for failures
  }

  /**
   * Log graceful shutdown
   */
  async logShutdown(reason: string = 'User requested'): Promise<void> {
    const event: StartupEvent = {
      eventType: 'shutdown',
      message: `AgentFlow shutting down: ${reason}`,
      timestamp: new Date()
    };
    
    this.logToDatabase(event);
    await this.sendToChannel(event);
  }

  /**
   * Log crash/unhandled error - ALWAYS sends to webhook
   */
  async logCrash(error: Error): Promise<void> {
    const event: StartupEvent = {
      eventType: 'crash',
      message: `AgentFlow crashed: ${error.message}`,
      details: 'An unhandled error caused the bot to crash.',
      stackTrace: error.stack,
      timestamp: new Date()
    };
    
    this.logToDatabase(event);
    await this.sendToWebhook(event); // Always send to webhook for crashes
  }

  /**
   * Log hourly health check with detailed status
   */
  async logHealthCheck(status: {
    healthy: boolean;
    uptime: number;
    activeAgents: number;
    pendingTasks: number;
    failedTasks24h: number;
    scheduledTasksRun: number;
    scheduledTasksFailed: number;
    memoryUsage: number;
  }): Promise<void> {
    const uptimeHours = Math.floor(status.uptime / 3600);
    const uptimeMinutes = Math.floor((status.uptime % 3600) / 60);
    
    const event: StartupEvent = {
      eventType: 'health_check',
      message: status.healthy 
        ? `✅ All systems operational`
        : `⚠️ Issues detected - check details`,
      details: [
        `**Uptime:** ${uptimeHours}h ${uptimeMinutes}m`,
        `**Active Agents:** ${status.activeAgents}`,
        `**Pending Tasks:** ${status.pendingTasks}`,
        `**Failed Tasks (24h):** ${status.failedTasks24h}`,
        `**Scheduled Tasks Run:** ${status.scheduledTasksRun}`,
        `**Scheduled Tasks Failed:** ${status.scheduledTasksFailed}`,
        `**Memory:** ${Math.round(status.memoryUsage)}MB`
      ].join('\n'),
      timestamp: new Date()
    };
    
    this.logToDatabase(event);
    await this.sendToChannel(event);
    
    // Also send to webhook if unhealthy
    if (!status.healthy) {
      await this.sendToWebhook(event);
    }
  }

  /**
   * Log a service error
   */
  async logServiceError(service: string, error: Error): Promise<void> {
    const event: StartupEvent = {
      eventType: 'service_error',
      message: `Error in ${service}: ${error.message}`,
      stackTrace: error.stack,
      timestamp: new Date()
    };
    
    this.logToDatabase(event);
    await this.sendToWebhook(event);
  }

  /**
   * Get recent startup logs
   */
  getRecentLogs(limit: number = 50): StartupEvent[] {
    if (!this.db) return [];
    
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM startup_logs 
        ORDER BY timestamp DESC 
        LIMIT ?
      `);
      
      const rows = stmt.all(limit);
      return rows.map((row: any) => ({
        id: row.id,
        eventType: row.event_type as StartupEventType,
        message: row.message,
        details: row.details,
        stackTrace: row.stack_trace,
        timestamp: new Date(row.timestamp)
      }));
    } catch (error) {
      console.error('[StartupLogger] Failed to get logs:', error);
      return [];
    }
  }
}

// Export singleton getter
export const getStartupLogger = () => StartupLogger.getInstance();



