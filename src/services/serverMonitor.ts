import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';

const execAsync = promisify(exec);

/**
 * Server health metrics
 */
export interface ServerHealth {
  timestamp: Date;
  disk: {
    totalGb: number;
    usedGb: number;
    availableGb: number;
    usedPercent: number;
  };
  memory: {
    totalGb: number;
    usedGb: number;
    availableGb: number;
    usedPercent: number;
  };
  cpu: {
    loadAvg1m: number;
    loadAvg5m: number;
    loadAvg15m: number;
    cores: number;
  };
  docker: {
    runningContainers: number;
    totalImages: number;
    imageSizeGb: number;
    buildCacheGb: number;
    reclaimableGb: number;
  };
  containers: ContainerHealth[];
}

export interface ContainerHealth {
  name: string;
  status: string;
  uptime: string;
  health: 'healthy' | 'unhealthy' | 'unknown';
  cpuPercent?: number;
  memoryMb?: number;
  memoryPercent?: number;
  restartCount: number;
}

export interface MonitorAlert {
  level: 'info' | 'warning' | 'critical';
  category: 'disk' | 'memory' | 'cpu' | 'docker' | 'container' | 'error';
  title: string;
  message: string;
  metric?: number;
  threshold?: number;
  action?: string;
  timestamp: Date;
}

export interface MonitorConfig {
  serverIp: string;
  sshUser: string;
  checkIntervalMs: number;
  thresholds: {
    diskWarningPercent: number;
    diskCriticalPercent: number;
    memoryWarningPercent: number;
    memoryCriticalPercent: number;
    cpuLoadWarning: number;  // Per core
    cpuLoadCritical: number;
    dockerCacheWarningGb: number;
    containerMemoryWarningMb: number;
    containerRestartWarning: number;
    containerUptimeMinWarning: number;  // Alert if container up less than this
  };
  autoCleanup: {
    enabled: boolean;
    diskThresholdPercent: number;
    dockerCacheThresholdGb: number;
  };
  discordChannelId?: string;
}

const DEFAULT_CONFIG: MonitorConfig = {
  serverIp: process.env.HETZNER_SERVER_IP || '178.156.198.233',
  sshUser: process.env.HETZNER_SSH_USER || 'root',
  checkIntervalMs: 5 * 60 * 1000, // 5 minutes
  thresholds: {
    diskWarningPercent: 70,
    diskCriticalPercent: 85,
    memoryWarningPercent: 80,
    memoryCriticalPercent: 90,
    cpuLoadWarning: 0.8,   // 80% per core
    cpuLoadCritical: 0.95, // 95% per core
    dockerCacheWarningGb: 10,
    containerMemoryWarningMb: 1024, // 1GB per container
    containerRestartWarning: 3,
    containerUptimeMinWarning: 5,
  },
  autoCleanup: {
    enabled: true,
    diskThresholdPercent: 80,
    dockerCacheThresholdGb: 15,
  },
};

/**
 * ServerMonitorService - Monitors Hetzner VPS health and performance
 *
 * Features:
 * - Periodic health checks (disk, RAM, CPU, Docker)
 * - Auto-cleanup when thresholds exceeded
 * - Runaway container detection
 * - Error log monitoring
 * - Discord alerts
 */
export class ServerMonitorService extends EventEmitter {
  private config: MonitorConfig;
  private discordClient: Client | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastHealth: ServerHealth | null = null;
  private alertHistory: MonitorAlert[] = [];
  private errorPatterns: RegExp[] = [
    /error/i,
    /exception/i,
    /fatal/i,
    /crashed/i,
    /out of memory/i,
    /oom/i,
    /killed/i,
    /segmentation fault/i,
  ];

  constructor(config: Partial<MonitorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Merge nested objects
    if (config.thresholds) {
      this.config.thresholds = { ...DEFAULT_CONFIG.thresholds, ...config.thresholds };
    }
    if (config.autoCleanup) {
      this.config.autoCleanup = { ...DEFAULT_CONFIG.autoCleanup, ...config.autoCleanup };
    }
  }

  /**
   * Set Discord client for notifications
   */
  setDiscordClient(client: Client): void {
    this.discordClient = client;
  }

  /**
   * Set the Discord channel for alerts
   */
  setAlertChannel(channelId: string): void {
    this.config.discordChannelId = channelId;
  }

  /**
   * Execute SSH command on server
   */
  private async sshExec(command: string, timeout: number = 30000): Promise<string> {
    // Use specific key for container-to-host SSH monitoring
    const sshKeyPath = process.env.SSH_MONITOR_KEY_PATH || '/root/.ssh/monitor_key';
    // Use single quotes to prevent shell interpretation of $ variables
    // Escape any single quotes in the command by ending quote, adding escaped quote, starting new quote
    const escapedCommand = command.replace(/'/g, "'\\''");
    const sshCommand = `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -i ${sshKeyPath} ${this.config.sshUser}@${this.config.serverIp} '${escapedCommand}'`;
    const { stdout } = await execAsync(sshCommand, { timeout });
    return stdout.trim();
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Server monitor already running');
      return;
    }

    this.isRunning = true;
    logger.info(`🔍 Server Monitor started (checking every ${this.config.checkIntervalMs / 1000}s)`);

    // Run initial check
    this.runHealthCheck().catch(err => {
      logger.error('Initial health check failed:', err);
    });

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.runHealthCheck().catch(err => {
        logger.error('Health check failed:', err);
      });
    }, this.config.checkIntervalMs);

    this.emit('started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info('🛑 Server Monitor stopped');
    this.emit('stopped');
  }

  /**
   * Run a complete health check
   */
  async runHealthCheck(): Promise<ServerHealth> {
    logger.debug('Running server health check...');

    try {
      const [disk, memory, cpu, docker, containers] = await Promise.all([
        this.checkDisk(),
        this.checkMemory(),
        this.checkCPU(),
        this.checkDocker(),
        this.checkContainers(),
      ]);

      const health: ServerHealth = {
        timestamp: new Date(),
        disk,
        memory,
        cpu,
        docker,
        containers,
      };

      this.lastHealth = health;
      this.emit('health', health);

      // Analyze and generate alerts
      const alerts = this.analyzeHealth(health);
      for (const alert of alerts) {
        await this.handleAlert(alert);
      }

      // Auto-cleanup if needed
      if (this.config.autoCleanup.enabled) {
        await this.autoCleanupIfNeeded(health);
      }

      return health;
    } catch (error) {
      logger.error('Health check failed:', error);
      throw error;
    }
  }

  /**
   * Check disk usage
   */
  private async checkDisk(): Promise<ServerHealth['disk']> {
    const output = await this.sshExec("df -BG / | tail -1 | awk '{print $2,$3,$4,$5}'");
    const [total, used, available, percent] = output.split(' ');

    return {
      totalGb: parseFloat(total.replace('G', '')),
      usedGb: parseFloat(used.replace('G', '')),
      availableGb: parseFloat(available.replace('G', '')),
      usedPercent: parseFloat(percent.replace('%', '')),
    };
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<ServerHealth['memory']> {
    const output = await this.sshExec("free -g | grep Mem | awk '{print $2,$3,$7}'");
    const [total, used, available] = output.split(' ').map(Number);

    return {
      totalGb: total,
      usedGb: used,
      availableGb: available,
      usedPercent: Math.round((used / total) * 100),
    };
  }

  /**
   * Check CPU load
   */
  private async checkCPU(): Promise<ServerHealth['cpu']> {
    const [loadOutput, coresOutput] = await Promise.all([
      this.sshExec("cat /proc/loadavg | awk '{print $1,$2,$3}'"),
      this.sshExec("nproc"),
    ]);

    const [load1, load5, load15] = loadOutput.split(' ').map(Number);
    const cores = parseInt(coresOutput, 10);

    return {
      loadAvg1m: load1,
      loadAvg5m: load5,
      loadAvg15m: load15,
      cores,
    };
  }

  /**
   * Check Docker status
   */
  private async checkDocker(): Promise<ServerHealth['docker']> {
    const output = await this.sshExec(
      "docker system df --format '{{.Type}}|{{.Size}}|{{.Reclaimable}}' && echo '---' && docker ps -q | wc -l && docker images -q | wc -l"
    );

    const lines = output.split('\n');
    const separatorIdx = lines.findIndex(l => l === '---');

    let imageSizeGb = 0;
    let buildCacheGb = 0;
    let reclaimableGb = 0;

    for (let i = 0; i < separatorIdx; i++) {
      const [type, size, reclaimable] = lines[i].split('|');
      const sizeGb = this.parseSize(size);
      const reclaimGb = this.parseSize(reclaimable.split(' ')[0]);

      if (type === 'Images') {
        imageSizeGb = sizeGb;
      } else if (type === 'Build Cache') {
        buildCacheGb = sizeGb;
      }
      reclaimableGb += reclaimGb;
    }

    const runningContainers = parseInt(lines[separatorIdx + 1], 10) || 0;
    const totalImages = parseInt(lines[separatorIdx + 2], 10) || 0;

    return {
      runningContainers,
      totalImages,
      imageSizeGb,
      buildCacheGb,
      reclaimableGb,
    };
  }

  /**
   * Parse size string (e.g., "5.1GB", "100MB") to GB
   */
  private parseSize(sizeStr: string): number {
    if (!sizeStr) return 0;
    const match = sizeStr.match(/([\d.]+)\s*(GB|MB|KB|B)?/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();

    switch (unit) {
      case 'GB': return value;
      case 'MB': return value / 1024;
      case 'KB': return value / (1024 * 1024);
      default: return value / (1024 * 1024 * 1024);
    }
  }

  /**
   * Check container health
   */
  private async checkContainers(): Promise<ContainerHealth[]> {
    const output = await this.sshExec(
      "docker ps --format '{{.Names}}|{{.Status}}|{{.State}}' && echo '---' && docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}'"
    );

    const lines = output.split('\n');
    const separatorIdx = lines.findIndex(l => l === '---');

    const containers: Map<string, ContainerHealth> = new Map();

    // Parse container status
    for (let i = 0; i < separatorIdx; i++) {
      const [name, status, state] = lines[i].split('|');
      if (!name) continue;

      // Extract uptime from status (e.g., "Up 2 hours (healthy)")
      const uptimeMatch = status.match(/Up\s+(.+?)(\s+\(|$)/);
      const healthMatch = status.match(/\((healthy|unhealthy)\)/);

      // Get restart count
      let restartCount = 0;
      try {
        const restartOutput = await this.sshExec(`docker inspect --format='{{.RestartCount}}' ${name}`);
        restartCount = parseInt(restartOutput, 10) || 0;
      } catch {
        // Ignore
      }

      containers.set(name, {
        name,
        status,
        uptime: uptimeMatch ? uptimeMatch[1] : 'unknown',
        health: healthMatch ? (healthMatch[1] as 'healthy' | 'unhealthy') : 'unknown',
        restartCount,
      });
    }

    // Parse container stats
    for (let i = separatorIdx + 1; i < lines.length; i++) {
      const [name, cpuPerc, memUsage, memPerc] = lines[i].split('|');
      if (!name) continue;

      const container = containers.get(name);
      if (container) {
        container.cpuPercent = parseFloat(cpuPerc?.replace('%', '') || '0');
        container.memoryPercent = parseFloat(memPerc?.replace('%', '') || '0');

        // Parse memory usage (e.g., "100MiB / 8GiB")
        const memMatch = memUsage?.match(/([\d.]+)\s*(MiB|GiB)/);
        if (memMatch) {
          const value = parseFloat(memMatch[1]);
          container.memoryMb = memMatch[2] === 'GiB' ? value * 1024 : value;
        }
      }
    }

    return Array.from(containers.values());
  }

  /**
   * Analyze health and generate alerts
   */
  private analyzeHealth(health: ServerHealth): MonitorAlert[] {
    const alerts: MonitorAlert[] = [];
    const t = this.config.thresholds;

    // Disk alerts
    if (health.disk.usedPercent >= t.diskCriticalPercent) {
      alerts.push({
        level: 'critical',
        category: 'disk',
        title: '🚨 Critical Disk Usage',
        message: `Disk usage at ${health.disk.usedPercent}% (${health.disk.usedGb}GB / ${health.disk.totalGb}GB)`,
        metric: health.disk.usedPercent,
        threshold: t.diskCriticalPercent,
        action: 'Immediate cleanup required',
        timestamp: new Date(),
      });
    } else if (health.disk.usedPercent >= t.diskWarningPercent) {
      alerts.push({
        level: 'warning',
        category: 'disk',
        title: '⚠️ High Disk Usage',
        message: `Disk usage at ${health.disk.usedPercent}% (${health.disk.usedGb}GB / ${health.disk.totalGb}GB)`,
        metric: health.disk.usedPercent,
        threshold: t.diskWarningPercent,
        timestamp: new Date(),
      });
    }

    // Memory alerts
    if (health.memory.usedPercent >= t.memoryCriticalPercent) {
      alerts.push({
        level: 'critical',
        category: 'memory',
        title: '🚨 Critical Memory Usage',
        message: `Memory usage at ${health.memory.usedPercent}% (${health.memory.usedGb}GB / ${health.memory.totalGb}GB)`,
        metric: health.memory.usedPercent,
        threshold: t.memoryCriticalPercent,
        timestamp: new Date(),
      });
    } else if (health.memory.usedPercent >= t.memoryWarningPercent) {
      alerts.push({
        level: 'warning',
        category: 'memory',
        title: '⚠️ High Memory Usage',
        message: `Memory usage at ${health.memory.usedPercent}% (${health.memory.usedGb}GB / ${health.memory.totalGb}GB)`,
        metric: health.memory.usedPercent,
        threshold: t.memoryWarningPercent,
        timestamp: new Date(),
      });
    }

    // CPU alerts (normalized by core count)
    const cpuLoadNormalized = health.cpu.loadAvg1m / health.cpu.cores;
    if (cpuLoadNormalized >= t.cpuLoadCritical) {
      alerts.push({
        level: 'critical',
        category: 'cpu',
        title: '🚨 Critical CPU Load',
        message: `CPU load at ${health.cpu.loadAvg1m.toFixed(2)} (${(cpuLoadNormalized * 100).toFixed(0)}% of ${health.cpu.cores} cores)`,
        metric: cpuLoadNormalized,
        threshold: t.cpuLoadCritical,
        timestamp: new Date(),
      });
    } else if (cpuLoadNormalized >= t.cpuLoadWarning) {
      alerts.push({
        level: 'warning',
        category: 'cpu',
        title: '⚠️ High CPU Load',
        message: `CPU load at ${health.cpu.loadAvg1m.toFixed(2)} (${(cpuLoadNormalized * 100).toFixed(0)}% of ${health.cpu.cores} cores)`,
        metric: cpuLoadNormalized,
        threshold: t.cpuLoadWarning,
        timestamp: new Date(),
      });
    }

    // Docker cache alerts
    if (health.docker.buildCacheGb >= t.dockerCacheWarningGb) {
      alerts.push({
        level: 'warning',
        category: 'docker',
        title: '🐳 Docker Cache Warning',
        message: `Build cache at ${health.docker.buildCacheGb.toFixed(1)}GB (${health.docker.reclaimableGb.toFixed(1)}GB reclaimable)`,
        metric: health.docker.buildCacheGb,
        threshold: t.dockerCacheWarningGb,
        action: 'Consider running docker system prune',
        timestamp: new Date(),
      });
    }

    // Container alerts
    for (const container of health.containers) {
      // Unhealthy container
      if (container.health === 'unhealthy') {
        alerts.push({
          level: 'critical',
          category: 'container',
          title: `🚨 Unhealthy Container: ${container.name}`,
          message: `Container ${container.name} is unhealthy. Status: ${container.status}`,
          action: 'Check container logs and restart if needed',
          timestamp: new Date(),
        });
      }

      // High memory usage
      if (container.memoryMb && container.memoryMb >= t.containerMemoryWarningMb) {
        alerts.push({
          level: 'warning',
          category: 'container',
          title: `⚠️ High Memory: ${container.name}`,
          message: `Container using ${container.memoryMb.toFixed(0)}MB (${container.memoryPercent?.toFixed(1)}%)`,
          metric: container.memoryMb,
          threshold: t.containerMemoryWarningMb,
          timestamp: new Date(),
        });
      }

      // Restart count
      if (container.restartCount >= t.containerRestartWarning) {
        alerts.push({
          level: 'warning',
          category: 'container',
          title: `⚠️ Container Restarts: ${container.name}`,
          message: `Container has restarted ${container.restartCount} times`,
          metric: container.restartCount,
          threshold: t.containerRestartWarning,
          action: 'Investigate why container keeps restarting',
          timestamp: new Date(),
        });
      }

      // Short uptime (potential crash loop)
      const uptimeMinutes = this.parseUptime(container.uptime);
      if (uptimeMinutes < t.containerUptimeMinWarning && container.restartCount > 0) {
        alerts.push({
          level: 'warning',
          category: 'container',
          title: `⚠️ Recent Restart: ${container.name}`,
          message: `Container uptime only ${container.uptime} (restart count: ${container.restartCount})`,
          action: 'Check for crash loop',
          timestamp: new Date(),
        });
      }
    }

    return alerts;
  }

  /**
   * Parse uptime string to minutes
   */
  private parseUptime(uptime: string): number {
    if (!uptime || uptime === 'unknown') return 999999;

    const hourMatch = uptime.match(/(\d+)\s*hour/);
    const minMatch = uptime.match(/(\d+)\s*minute/);
    const secMatch = uptime.match(/(\d+)\s*second/);
    const dayMatch = uptime.match(/(\d+)\s*day/);

    let minutes = 0;
    if (dayMatch) minutes += parseInt(dayMatch[1], 10) * 24 * 60;
    if (hourMatch) minutes += parseInt(hourMatch[1], 10) * 60;
    if (minMatch) minutes += parseInt(minMatch[1], 10);
    if (secMatch) minutes += parseInt(secMatch[1], 10) / 60;

    return minutes || 999999;
  }

  /**
   * Handle an alert (log, store, notify)
   */
  private async handleAlert(alert: MonitorAlert): Promise<void> {
    // Store in history
    this.alertHistory.push(alert);
    if (this.alertHistory.length > 100) {
      this.alertHistory.shift();
    }

    // Log
    const logFn = alert.level === 'critical' ? logger.error : alert.level === 'warning' ? logger.warn : logger.info;
    logFn(`[Monitor] ${alert.title}: ${alert.message}`);

    // Emit event
    this.emit('alert', alert);

    // Send Discord notification
    await this.sendDiscordAlert(alert);
  }

  /**
   * Send alert to Discord
   */
  private async sendDiscordAlert(alert: MonitorAlert): Promise<void> {
    if (!this.discordClient || !this.config.discordChannelId) {
      return;
    }

    try {
      const channel = await this.discordClient.channels.fetch(this.config.discordChannelId);
      if (!channel || !channel.isTextBased()) return;

      const color = alert.level === 'critical' ? 0xFF0000 : alert.level === 'warning' ? 0xFFA500 : 0x00FF00;

      const embed = new EmbedBuilder()
        .setTitle(alert.title)
        .setDescription(alert.message)
        .setColor(color)
        .setTimestamp(alert.timestamp)
        .addFields({ name: 'Category', value: alert.category, inline: true });

      if (alert.metric !== undefined && alert.threshold !== undefined) {
        embed.addFields({ name: 'Metric', value: `${alert.metric.toFixed(1)} / ${alert.threshold}`, inline: true });
      }

      if (alert.action) {
        embed.addFields({ name: 'Recommended Action', value: alert.action });
      }

      await (channel as TextChannel).send({ embeds: [embed] });
    } catch (error) {
      logger.error('Failed to send Discord alert:', error);
    }
  }

  /**
   * Auto-cleanup if thresholds exceeded
   */
  private async autoCleanupIfNeeded(health: ServerHealth): Promise<void> {
    const { diskThresholdPercent, dockerCacheThresholdGb } = this.config.autoCleanup;

    // Auto-cleanup Docker if disk is high or cache is large
    if (health.disk.usedPercent >= diskThresholdPercent || health.docker.buildCacheGb >= dockerCacheThresholdGb) {
      logger.info('🧹 Auto-cleanup triggered');

      try {
        const result = await this.cleanupDocker();

        const alert: MonitorAlert = {
          level: 'info',
          category: 'docker',
          title: '🧹 Auto-Cleanup Completed',
          message: `Reclaimed ${result.reclaimedGb.toFixed(2)}GB of disk space`,
          timestamp: new Date(),
        };

        await this.handleAlert(alert);
      } catch (error) {
        logger.error('Auto-cleanup failed:', error);
      }
    }
  }

  /**
   * Cleanup Docker (prune images and build cache)
   */
  async cleanupDocker(): Promise<{ reclaimedGb: number }> {
    logger.info('Running Docker cleanup...');

    const output = await this.sshExec('docker system prune -af 2>&1 | tail -1', 120000);

    // Parse "Total reclaimed space: X.XXgb"
    const match = output.match(/Total reclaimed space:\s*([\d.]+)\s*(GB|MB|KB|B)/i);
    const reclaimedGb = match ? this.parseSize(`${match[1]}${match[2]}`) : 0;

    logger.info(`Docker cleanup complete: ${reclaimedGb.toFixed(2)}GB reclaimed`);
    this.emit('cleanup', { reclaimedGb });

    return { reclaimedGb };
  }

  /**
   * Check container logs for errors
   */
  async checkLogsForErrors(containerName: string, lines: number = 100): Promise<string[]> {
    try {
      const output = await this.sshExec(`docker logs --tail ${lines} ${containerName} 2>&1`);
      const errorLines: string[] = [];

      for (const line of output.split('\n')) {
        if (this.errorPatterns.some(pattern => pattern.test(line))) {
          errorLines.push(line);
        }
      }

      return errorLines;
    } catch (error) {
      logger.error(`Failed to check logs for ${containerName}:`, error);
      return [];
    }
  }

  /**
   * Check all containers for errors
   */
  async checkAllContainersForErrors(): Promise<Map<string, string[]>> {
    const results = new Map<string, string[]>();

    if (!this.lastHealth) {
      await this.runHealthCheck();
    }

    for (const container of this.lastHealth?.containers || []) {
      const errors = await this.checkLogsForErrors(container.name);
      if (errors.length > 0) {
        results.set(container.name, errors);

        await this.handleAlert({
          level: 'warning',
          category: 'error',
          title: `⚠️ Errors in ${container.name}`,
          message: `Found ${errors.length} error(s) in recent logs`,
          action: 'Review container logs',
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Detect runaway containers (high resource usage for extended time)
   */
  async detectRunawayContainers(): Promise<ContainerHealth[]> {
    if (!this.lastHealth) {
      await this.runHealthCheck();
    }

    const runaway: ContainerHealth[] = [];

    for (const container of this.lastHealth?.containers || []) {
      // High CPU for more than a few minutes
      if (container.cpuPercent && container.cpuPercent > 80) {
        runaway.push(container);

        await this.handleAlert({
          level: 'warning',
          category: 'container',
          title: `🏃 Potential Runaway: ${container.name}`,
          message: `Container using ${container.cpuPercent.toFixed(1)}% CPU`,
          action: 'Investigate high CPU usage',
          timestamp: new Date(),
        });
      }

      // Memory growing (would need historical data for proper detection)
      if (container.memoryPercent && container.memoryPercent > 50) {
        // Could be a memory leak - flag for review
        logger.debug(`Container ${container.name} using ${container.memoryPercent}% of system memory`);
      }
    }

    return runaway;
  }

  /**
   * Get current health status
   */
  getLastHealth(): ServerHealth | null {
    return this.lastHealth;
  }

  /**
   * Get recent alerts
   */
  getAlertHistory(): MonitorAlert[] {
    return [...this.alertHistory];
  }

  /**
   * Force a health check now
   */
  async forceCheck(): Promise<ServerHealth> {
    return this.runHealthCheck();
  }

  /**
   * Generate a health report
   */
  async generateReport(): Promise<string> {
    const health = await this.runHealthCheck();

    const lines = [
      '# Server Health Report',
      `Generated: ${health.timestamp.toISOString()}`,
      '',
      '## System Resources',
      `- **Disk**: ${health.disk.usedGb}GB / ${health.disk.totalGb}GB (${health.disk.usedPercent}%)`,
      `- **Memory**: ${health.memory.usedGb}GB / ${health.memory.totalGb}GB (${health.memory.usedPercent}%)`,
      `- **CPU Load**: ${health.cpu.loadAvg1m.toFixed(2)} / ${health.cpu.loadAvg5m.toFixed(2)} / ${health.cpu.loadAvg15m.toFixed(2)} (${health.cpu.cores} cores)`,
      '',
      '## Docker',
      `- **Running Containers**: ${health.docker.runningContainers}`,
      `- **Total Images**: ${health.docker.totalImages}`,
      `- **Image Size**: ${health.docker.imageSizeGb.toFixed(2)}GB`,
      `- **Build Cache**: ${health.docker.buildCacheGb.toFixed(2)}GB`,
      `- **Reclaimable**: ${health.docker.reclaimableGb.toFixed(2)}GB`,
      '',
      '## Containers',
    ];

    for (const container of health.containers) {
      lines.push(`### ${container.name}`);
      lines.push(`- Status: ${container.status}`);
      lines.push(`- Health: ${container.health}`);
      lines.push(`- Uptime: ${container.uptime}`);
      lines.push(`- Memory: ${container.memoryMb?.toFixed(0) || 'N/A'}MB (${container.memoryPercent?.toFixed(1) || 'N/A'}%)`);
      lines.push(`- CPU: ${container.cpuPercent?.toFixed(1) || 'N/A'}%`);
      lines.push(`- Restarts: ${container.restartCount}`);
      lines.push('');
    }

    if (this.alertHistory.length > 0) {
      lines.push('## Recent Alerts');
      for (const alert of this.alertHistory.slice(-10)) {
        lines.push(`- [${alert.level.toUpperCase()}] ${alert.title}: ${alert.message}`);
      }
    }

    return lines.join('\n');
  }
}

// Export singleton factory
let monitorInstance: ServerMonitorService | null = null;

export function getServerMonitor(config?: Partial<MonitorConfig>): ServerMonitorService {
  if (!monitorInstance) {
    monitorInstance = new ServerMonitorService(config);
  }
  return monitorInstance;
}
