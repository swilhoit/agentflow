/**
 * Enhanced Health Check Utility
 *
 * Provides comprehensive health metrics beyond simple "status: healthy"
 * Docker/orchestrators can make informed restart decisions based on these
 */

import { getDatabase } from '../services/databaseFactory';
import { logger } from './logger';
import v8 from 'v8';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    heapLimit: number;
    external: number;
    rss: number;
    percentUsed: number;
    percentOfCurrent: number;
  };
  database: {
    connected: boolean;
    latencyMs?: number;
    error?: string;
  };
  discord?: {
    connected: boolean;
    ping?: number;
    guilds?: number;
  };
  services: {
    name: string;
    status: 'running' | 'stopped' | 'error';
    lastActivity?: string;
  }[];
  warnings: string[];
  timestamp: string;
}

export interface HealthCheckConfig {
  memoryThresholdPercent?: number;  // Default 85%
  dbTimeoutMs?: number;             // Default 5000ms
  checkDatabase?: boolean;          // Default true
}

const DEFAULT_CONFIG: Required<HealthCheckConfig> = {
  memoryThresholdPercent: 85,
  dbTimeoutMs: 5000,
  checkDatabase: true,
};

/**
 * Perform a comprehensive health check
 */
export async function performHealthCheck(
  config: HealthCheckConfig = {},
  discordClient?: any,
  services: { name: string; isRunning: () => boolean; lastActivity?: () => Date | null }[] = []
): Promise<HealthStatus> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const warnings: string[] = [];
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Memory metrics - use V8 heap statistics for accurate limit
  const memUsage = process.memoryUsage();
  const heapStats = v8.getHeapStatistics();

  // Compare against ACTUAL heap limit, not current allocation
  // heapTotal is current allocation, heap_size_limit is the max (from --max-old-space-size)
  const heapLimit = heapStats.heap_size_limit;
  const heapPercentOfLimit = (memUsage.heapUsed / heapLimit) * 100;
  const heapPercentOfCurrent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  const memory = {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB (current allocation)
    heapLimit: Math.round(heapLimit / 1024 / 1024), // MB (max allowed)
    external: Math.round(memUsage.external / 1024 / 1024), // MB
    rss: Math.round(memUsage.rss / 1024 / 1024), // MB
    percentUsed: Math.round(heapPercentOfLimit * 10) / 10, // % of max limit
    percentOfCurrent: Math.round(heapPercentOfCurrent * 10) / 10, // % of current allocation
  };

  // Only warn/unhealthy based on % of LIMIT, not current allocation
  if (heapPercentOfLimit > cfg.memoryThresholdPercent) {
    warnings.push(`High memory usage: ${memory.percentUsed}% of ${memory.heapLimit}MB limit (threshold: ${cfg.memoryThresholdPercent}%)`);
    overallStatus = 'degraded';
  }

  if (heapPercentOfLimit > 95) {
    overallStatus = 'unhealthy';
  }

  // Database check
  let database: HealthStatus['database'] = { connected: false };

  if (cfg.checkDatabase) {
    try {
      const db = getDatabase();
      const start = Date.now();

      // Simple operation to test connection - use a lightweight method that exists on the interface
      await Promise.race([
        (async () => {
          // Use getAllActiveAgentTasks which exists on all database implementations
          // This is a lightweight query that tests connectivity
          db.getAllActiveAgentTasks();
          return true;
        })(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database timeout')), cfg.dbTimeoutMs)
        )
      ]);

      const latencyMs = Date.now() - start;
      database = {
        connected: true,
        latencyMs,
      };

      if (latencyMs > 1000) {
        warnings.push(`Slow database response: ${latencyMs}ms`);
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      }
    } catch (error) {
      database = {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      warnings.push(`Database connection failed: ${database.error}`);
      overallStatus = 'unhealthy';
    }
  }

  // Discord client check
  let discord: HealthStatus['discord'] | undefined;

  if (discordClient) {
    try {
      const isReady = discordClient.isReady?.() ?? discordClient.ws?.status === 0;
      discord = {
        connected: isReady,
        ping: discordClient.ws?.ping ?? undefined,
        guilds: discordClient.guilds?.cache?.size ?? 0,
      };

      if (!isReady) {
        warnings.push('Discord client not connected');
        overallStatus = 'unhealthy';
      } else if (discord.ping && discord.ping > 500) {
        warnings.push(`High Discord latency: ${discord.ping}ms`);
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      }
    } catch (error) {
      discord = { connected: false };
      warnings.push('Failed to check Discord status');
    }
  }

  // Service checks
  const serviceStatuses = services.map(svc => {
    try {
      const isRunning = svc.isRunning();
      const lastActivity = svc.lastActivity?.();
      return {
        name: svc.name,
        status: isRunning ? 'running' as const : 'stopped' as const,
        lastActivity: lastActivity?.toISOString(),
      };
    } catch {
      return {
        name: svc.name,
        status: 'error' as const,
      };
    }
  });

  const stoppedServices = serviceStatuses.filter(s => s.status !== 'running');
  if (stoppedServices.length > 0) {
    warnings.push(`Services not running: ${stoppedServices.map(s => s.name).join(', ')}`);
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  return {
    status: overallStatus,
    uptime: process.uptime(),
    memory,
    database,
    discord,
    services: serviceStatuses,
    warnings,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Express middleware for health check endpoint
 * Returns appropriate HTTP status codes based on health
 */
export function healthCheckHandler(
  config: HealthCheckConfig = {},
  getDiscordClient?: () => any,
  getServices?: () => { name: string; isRunning: () => boolean; lastActivity?: () => Date | null }[]
) {
  return async (req: any, res: any) => {
    try {
      const health = await performHealthCheck(
        config,
        getDiscordClient?.(),
        getServices?.() ?? []
      );

      // Map health status to HTTP status code
      const httpStatus = health.status === 'healthy' ? 200
                       : health.status === 'degraded' ? 200  // Still return 200 for degraded so Docker doesn't restart unnecessarily
                       : 503;

      res.status(httpStatus).json(health);
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Simple health check for bots that just need basic status
 * Used by Atlas and Advisor bots
 */
export function createSimpleHealthServer(
  botName: string,
  port: number,
  getDiscordClient?: () => any
): { start: () => Promise<void>; stop: () => void; server: any } {
  const http = require('http');

  const server = http.createServer(async (req: any, res: any) => {
    if (req.url === '/health' || req.url === '/') {
      try {
        const memUsage = process.memoryUsage();
        const heapStats = v8.getHeapStatistics();
        const heapLimit = heapStats.heap_size_limit;
        // Use % of LIMIT, not current allocation
        const heapPercentOfLimit = (memUsage.heapUsed / heapLimit) * 100;

        const discordClient = getDiscordClient?.();
        const discordConnected = discordClient?.isReady?.() ?? false;

        // Determine status based on % of max limit
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        const warnings: string[] = [];

        if (heapPercentOfLimit > 85) {
          status = 'degraded';
          warnings.push(`High memory: ${Math.round(heapPercentOfLimit)}% of ${Math.round(heapLimit / 1024 / 1024)}MB`);
        }
        if (heapPercentOfLimit > 95) {
          status = 'unhealthy';
        }
        if (discordClient && !discordConnected) {
          status = 'unhealthy';
          warnings.push('Discord disconnected');
        }

        const httpStatus = status === 'unhealthy' ? 503 : 200;

        res.writeHead(httpStatus, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status,
          bot: botName,
          uptime: process.uptime(),
          memory: {
            heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapLimitMB: Math.round(heapLimit / 1024 / 1024),
            percentUsed: Math.round(heapPercentOfLimit * 10) / 10,
          },
          discord: discordClient ? {
            connected: discordConnected,
            ping: discordClient.ws?.ping,
            guilds: discordClient.guilds?.cache?.size ?? 0,
          } : undefined,
          warnings,
          timestamp: new Date().toISOString(),
        }));
      } catch (error) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'unhealthy',
          bot: botName,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        }));
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  return {
    server,
    start: () => new Promise<void>((resolve) => {
      server.listen(port, () => {
        logger.info(`🌐 Health check server for ${botName} listening on port ${port}`);
        resolve();
      });
    }),
    stop: () => server.close(),
  };
}
