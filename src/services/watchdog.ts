/**
 * Watchdog Service
 *
 * Monitors bot health and triggers alerts/recovery actions when issues are detected.
 * Runs as part of the main bot to monitor itself and other bots.
 *
 * Features:
 * - Periodic health checks
 * - Memory leak detection (trending analysis)
 * - Discord connection monitoring
 * - Auto-restart recommendations
 * - Discord webhook alerts for critical issues
 */

import { logger } from '../utils/logger';
import { performHealthCheck, HealthStatus } from '../utils/healthCheck';
import { circuitBreakers } from '../utils/circuitBreaker';

export interface WatchdogConfig {
  checkIntervalMs?: number;       // How often to check health (default: 60000 - 1 min)
  memoryTrendWindowMs?: number;   // Window for memory trend analysis (default: 300000 - 5 min)
  memoryGrowthThreshold?: number; // % growth that triggers warning (default: 20)
  alertWebhookUrl?: string;       // Discord webhook for critical alerts
  discordClient?: any;            // Discord client to monitor
  alertChannelId?: string;        // Discord channel for in-app alerts
  botName?: string;               // Name for identification in alerts
  onCritical?: (reason: string) => Promise<void>;  // Callback for critical issues
}

interface HealthSnapshot {
  timestamp: Date;
  memoryMB: number;
  heapPercent: number;
  status: HealthStatus['status'];
}

const DEFAULT_CONFIG: Required<Omit<WatchdogConfig, 'alertWebhookUrl' | 'discordClient' | 'alertChannelId' | 'onCritical'>> = {
  checkIntervalMs: 60000,
  memoryTrendWindowMs: 300000,
  memoryGrowthThreshold: 20,
  botName: 'AgentFlow',
};

export class WatchdogService {
  private config: WatchdogConfig & typeof DEFAULT_CONFIG;
  private checkInterval?: NodeJS.Timeout;
  private healthHistory: HealthSnapshot[] = [];
  private lastAlertTime: number = 0;
  private alertCooldownMs = 5 * 60 * 1000; // 5 minutes between alerts
  private running = false;
  private discordClient?: any;

  constructor(config: WatchdogConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.discordClient = config.discordClient;
  }

  /**
   * Set Discord client for monitoring
   */
  setDiscordClient(client: any): void {
    this.discordClient = client;
  }

  /**
   * Start the watchdog service
   */
  start(): void {
    if (this.running) {
      logger.warn('[Watchdog] Already running');
      return;
    }

    this.running = true;
    logger.info(`[Watchdog] Starting health monitoring (interval: ${this.config.checkIntervalMs}ms)`);

    // Run initial check
    this.runHealthCheck();

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.runHealthCheck();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop the watchdog service
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    this.running = false;
    logger.info('[Watchdog] Stopped');
  }

  /**
   * Run a health check and analyze results
   */
  private async runHealthCheck(): Promise<void> {
    try {
      const health = await performHealthCheck(
        { memoryThresholdPercent: 85, checkDatabase: true },
        this.discordClient,
        []
      );

      // Record snapshot
      const snapshot: HealthSnapshot = {
        timestamp: new Date(),
        memoryMB: health.memory.heapUsed,
        heapPercent: health.memory.percentUsed,
        status: health.status,
      };
      this.healthHistory.push(snapshot);

      // Trim old history
      const cutoff = Date.now() - this.config.memoryTrendWindowMs;
      this.healthHistory = this.healthHistory.filter(
        s => s.timestamp.getTime() > cutoff
      );

      // Analyze and alert
      await this.analyzeHealth(health);

    } catch (error) {
      logger.error('[Watchdog] Health check failed:', error);
      await this.sendAlert('Health Check Failed', `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Analyze health and trigger alerts if needed
   */
  private async analyzeHealth(health: HealthStatus): Promise<void> {
    const issues: string[] = [];
    let severity: 'warning' | 'critical' = 'warning';

    // Check overall status
    if (health.status === 'unhealthy') {
      issues.push(`Status: UNHEALTHY`);
      severity = 'critical';
    }

    // Check memory
    if (health.memory.percentUsed > 90) {
      issues.push(`Memory critically high: ${health.memory.percentUsed}%`);
      severity = 'critical';
    } else if (health.memory.percentUsed > 80) {
      issues.push(`Memory high: ${health.memory.percentUsed}%`);
    }

    // Check memory trend (leak detection)
    const memoryTrend = this.analyzeMemoryTrend();
    if (memoryTrend.isLeaking) {
      issues.push(`Possible memory leak: ${memoryTrend.growthPercent.toFixed(1)}% growth in ${Math.round(this.config.memoryTrendWindowMs / 60000)} min`);
      if (memoryTrend.growthPercent > 50) {
        severity = 'critical';
      }
    }

    // Check database
    if (!health.database.connected) {
      issues.push(`Database disconnected: ${health.database.error || 'Unknown error'}`);
      severity = 'critical';
    } else if (health.database.latencyMs && health.database.latencyMs > 1000) {
      issues.push(`Database slow: ${health.database.latencyMs}ms latency`);
    }

    // Check Discord
    if (health.discord && !health.discord.connected) {
      issues.push('Discord disconnected');
      severity = 'critical';
    } else if (health.discord?.ping && health.discord.ping > 1000) {
      issues.push(`Discord slow: ${health.discord.ping}ms ping`);
    }

    // Check circuit breakers
    const circuitStatuses = circuitBreakers.getAllStatuses();
    const openCircuits = Object.entries(circuitStatuses)
      .filter(([_, status]) => status.state === 'OPEN')
      .map(([name]) => name);

    if (openCircuits.length > 0) {
      issues.push(`Open circuit breakers: ${openCircuits.join(', ')}`);
    }

    // Check warnings from health check
    if (health.warnings.length > 0) {
      issues.push(...health.warnings);
    }

    // Log and alert
    if (issues.length > 0) {
      const message = issues.join('\n- ');
      if (severity === 'critical') {
        logger.error(`[Watchdog] CRITICAL issues detected:\n- ${message}`);
        await this.sendAlert('Critical Health Issues', message);

        // Call critical callback if provided
        if (this.config.onCritical) {
          await this.config.onCritical(message);
        }
      } else {
        logger.warn(`[Watchdog] Health warnings:\n- ${message}`);
      }
    } else {
      logger.debug('[Watchdog] Health check passed');
    }
  }

  /**
   * Analyze memory trend to detect leaks
   */
  private analyzeMemoryTrend(): { isLeaking: boolean; growthPercent: number } {
    if (this.healthHistory.length < 3) {
      return { isLeaking: false, growthPercent: 0 };
    }

    const oldest = this.healthHistory[0];
    const newest = this.healthHistory[this.healthHistory.length - 1];
    const growthPercent = ((newest.memoryMB - oldest.memoryMB) / oldest.memoryMB) * 100;

    return {
      isLeaking: growthPercent > this.config.memoryGrowthThreshold,
      growthPercent,
    };
  }

  /**
   * Send alert via webhook and/or Discord channel
   */
  private async sendAlert(title: string, message: string): Promise<void> {
    // Respect cooldown
    if (Date.now() - this.lastAlertTime < this.alertCooldownMs) {
      logger.debug('[Watchdog] Alert cooldown active, skipping');
      return;
    }
    this.lastAlertTime = Date.now();

    const fullMessage = `🚨 **${this.config.botName} Watchdog Alert**\n\n**${title}**\n\`\`\`\n${message}\n\`\`\`\n\n_Time: ${new Date().toISOString()}_`;

    // Send to Discord channel if available
    if (this.discordClient && this.config.alertChannelId) {
      try {
        const channel = await this.discordClient.channels.fetch(this.config.alertChannelId);
        if (channel?.isTextBased?.()) {
          await channel.send(fullMessage);
        }
      } catch (error) {
        logger.error('[Watchdog] Failed to send Discord alert:', error);
      }
    }

    // Send to webhook if configured
    if (this.config.alertWebhookUrl) {
      try {
        const response = await fetch(this.config.alertWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: fullMessage,
            username: `${this.config.botName} Watchdog`,
          }),
        });
        if (!response.ok) {
          logger.error(`[Watchdog] Webhook failed: ${response.status}`);
        }
      } catch (error) {
        logger.error('[Watchdog] Failed to send webhook alert:', error);
      }
    }
  }

  /**
   * Get current health status
   */
  async getStatus(): Promise<{
    running: boolean;
    lastCheck: Date | null;
    memoryTrend: { isLeaking: boolean; growthPercent: number };
    historySize: number;
  }> {
    return {
      running: this.running,
      lastCheck: this.healthHistory.length > 0
        ? this.healthHistory[this.healthHistory.length - 1].timestamp
        : null,
      memoryTrend: this.analyzeMemoryTrend(),
      historySize: this.healthHistory.length,
    };
  }

  /**
   * Force an immediate health check
   */
  async forceCheck(): Promise<HealthStatus> {
    const health = await performHealthCheck(
      { memoryThresholdPercent: 85, checkDatabase: true },
      this.discordClient,
      []
    );
    await this.analyzeHealth(health);
    return health;
  }

  /**
   * Manually trigger a garbage collection hint
   * Note: Only works if Node.js is started with --expose-gc flag
   */
  triggerGC(): boolean {
    if (global.gc) {
      logger.info('[Watchdog] Triggering garbage collection...');
      global.gc();
      return true;
    }
    logger.warn('[Watchdog] GC not exposed. Start with --expose-gc to enable');
    return false;
  }
}

// Singleton instance
let watchdogInstance: WatchdogService | null = null;

export function getWatchdog(config?: WatchdogConfig): WatchdogService {
  if (!watchdogInstance) {
    watchdogInstance = new WatchdogService(config);
  }
  return watchdogInstance;
}

export function stopWatchdog(): void {
  if (watchdogInstance) {
    watchdogInstance.stop();
    watchdogInstance = null;
  }
}
