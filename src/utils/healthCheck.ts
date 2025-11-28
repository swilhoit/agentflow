/**
 * Enhanced Health Check Utility v2.0
 *
 * Provides comprehensive health metrics beyond simple "status: healthy"
 * Docker/orchestrators can make informed restart decisions based on these
 *
 * Features:
 * - Memory and heap analysis with V8 statistics
 * - Event loop lag detection (critical for Node.js performance)
 * - External API health checks (OpenAI, Anthropic, Alpaca)
 * - Database connectivity with latency tracking
 * - Process-level CPU usage
 * - Garbage collection metrics
 * - Historical trend analysis for smarter alerting
 * - Response time percentile tracking
 */

import { getAgentFlowDatabase } from '../services/databaseFactory';
import { logger } from './logger';
import * as v8 from 'v8';
import * as os from 'os';
import { performance, PerformanceObserver } from 'perf_hooks';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

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
    arrayBuffers: number;
  };
  cpu: {
    processUsage: number;      // Process CPU % (0-100)
    systemLoad: number[];      // 1, 5, 15 min load averages
    cores: number;
  };
  eventLoop: {
    lagMs: number;
    isBlocked: boolean;
    p99LagMs: number;
  };
  gc?: {
    totalCollections: number;
    totalPauseMs: number;
    avgPauseMs: number;
    lastPauseMs: number;
  };
  database: {
    type: 'hetzner-postgres';
    connected: boolean;
    latencyMs?: number;
    error?: string;
    poolSize?: number;
    activeConnections?: number;
    host?: string;
  };
  discord?: {
    connected: boolean;
    ping?: number;
    guilds?: number;
    shardCount?: number;
    shardStatus?: string;
  };
  externalApis: {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unchecked';
    latencyMs?: number;
    error?: string;
    lastChecked?: string;
  }[];
  services: {
    name: string;
    status: 'running' | 'stopped' | 'error';
    lastActivity?: string;
    responseTimeP50?: number;
    responseTimeP99?: number;
  }[];
  trends: {
    memoryTrend: 'stable' | 'increasing' | 'decreasing' | 'unknown';
    memoryGrowthPerHour: number;
    eventLoopTrend: 'stable' | 'degrading' | 'improving' | 'unknown';
    isPotentialMemoryLeak: boolean;
  };
  warnings: string[];
  errors: string[];
  timestamp: string;
  checkDurationMs: number;
}

export interface HealthCheckConfig {
  memoryThresholdPercent?: number;  // Default 85%
  dbTimeoutMs?: number;             // Default 5000ms
  checkDatabase?: boolean;          // Default true
  checkExternalApis?: boolean;      // Default true
  apiTimeoutMs?: number;            // Default 3000ms
  eventLoopLagThresholdMs?: number; // Default 100ms
  enableTrendAnalysis?: boolean;    // Default true
  trendWindowMinutes?: number;      // Default 30
}

const DEFAULT_CONFIG: Required<HealthCheckConfig> = {
  memoryThresholdPercent: 85,
  dbTimeoutMs: 5000,
  checkDatabase: true,
  checkExternalApis: true,
  apiTimeoutMs: 3000,
  eventLoopLagThresholdMs: 100,
  enableTrendAnalysis: true,
  trendWindowMinutes: 30,
};

// ============================================================================
// METRICS COLLECTION (Singleton pattern for continuous monitoring)
// ============================================================================

interface HistoricalSnapshot {
  timestamp: number;
  memoryMB: number;
  eventLoopLagMs: number;
  cpuPercent: number;
}

class HealthMetricsCollector {
  private static instance: HealthMetricsCollector;
  private history: HistoricalSnapshot[] = [];
  private maxHistorySize = 120; // 2 hours at 1 min intervals
  private eventLoopLags: number[] = [];
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  private lastCpuTime: number = 0;
  private gcStats = {
    totalCollections: 0,
    totalPauseMs: 0,
    lastPauseMs: 0,
  };
  private gcObserver: PerformanceObserver | null = null;
  private eventLoopInterval: NodeJS.Timeout | null = null;
  private snapshotInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): HealthMetricsCollector {
    if (!HealthMetricsCollector.instance) {
      HealthMetricsCollector.instance = new HealthMetricsCollector();
    }
    return HealthMetricsCollector.instance;
  }

  initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Monitor GC if available
    try {
      this.gcObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'gc') {
            this.gcStats.totalCollections++;
            this.gcStats.totalPauseMs += entry.duration;
            this.gcStats.lastPauseMs = entry.duration;
          }
        }
      });
      this.gcObserver.observe({ entryTypes: ['gc'] });
    } catch {
      // GC observation may not be available
    }

    // Monitor event loop lag
    this.eventLoopInterval = setInterval(() => {
      const start = performance.now();
      setImmediate(() => {
        const lag = performance.now() - start;
        this.eventLoopLags.push(lag);
        // Keep last 60 samples (1 minute at 1 second intervals)
        if (this.eventLoopLags.length > 60) {
          this.eventLoopLags.shift();
        }
      });
    }, 1000);

    // Take periodic snapshots for trend analysis
    this.snapshotInterval = setInterval(() => {
      this.takeSnapshot();
    }, 60000); // Every minute

    // Take initial snapshot
    this.takeSnapshot();

    logger.debug('[HealthMetrics] Collector initialized');
  }

  private takeSnapshot(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = this.measureCpuUsage();

    this.history.push({
      timestamp: Date.now(),
      memoryMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      eventLoopLagMs: this.getCurrentLag(),
      cpuPercent: cpuUsage,
    });

    // Trim old history
    while (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  private measureCpuUsage(): number {
    const now = Date.now();
    const cpuUsage = process.cpuUsage(this.lastCpuUsage || undefined);

    if (this.lastCpuUsage && this.lastCpuTime) {
      const elapsedMs = now - this.lastCpuTime;
      const totalCpuMs = (cpuUsage.user + cpuUsage.system) / 1000;
      const cpuPercent = (totalCpuMs / elapsedMs) * 100;

      this.lastCpuUsage = process.cpuUsage();
      this.lastCpuTime = now;

      return Math.min(100, Math.round(cpuPercent * 10) / 10);
    }

    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTime = now;
    return 0;
  }

  getCurrentLag(): number {
    if (this.eventLoopLags.length === 0) return 0;
    return this.eventLoopLags[this.eventLoopLags.length - 1];
  }

  getP99Lag(): number {
    if (this.eventLoopLags.length === 0) return 0;
    const sorted = [...this.eventLoopLags].sort((a, b) => a - b);
    const p99Index = Math.floor(sorted.length * 0.99);
    return sorted[p99Index] || sorted[sorted.length - 1];
  }

  getCpuUsage(): number {
    return this.measureCpuUsage();
  }

  getGcStats() {
    return {
      totalCollections: this.gcStats.totalCollections,
      totalPauseMs: Math.round(this.gcStats.totalPauseMs),
      avgPauseMs: this.gcStats.totalCollections > 0
        ? Math.round(this.gcStats.totalPauseMs / this.gcStats.totalCollections * 10) / 10
        : 0,
      lastPauseMs: Math.round(this.gcStats.lastPauseMs * 10) / 10,
    };
  }

  analyzeTrends(windowMinutes: number): HealthStatus['trends'] {
    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    const recentHistory = this.history.filter(h => h.timestamp > cutoff);

    if (recentHistory.length < 3) {
      return {
        memoryTrend: 'unknown',
        memoryGrowthPerHour: 0,
        eventLoopTrend: 'unknown',
        isPotentialMemoryLeak: false,
      };
    }

    // Memory trend analysis
    const firstMem = recentHistory[0].memoryMB;
    const lastMem = recentHistory[recentHistory.length - 1].memoryMB;
    const memChange = lastMem - firstMem;
    const hoursElapsed = (recentHistory[recentHistory.length - 1].timestamp - recentHistory[0].timestamp) / (1000 * 60 * 60);
    const memGrowthPerHour = hoursElapsed > 0 ? memChange / hoursElapsed : 0;

    // Linear regression for better trend detection
    const memorySlope = this.calculateSlope(recentHistory.map(h => h.memoryMB));
    const lagSlope = this.calculateSlope(recentHistory.map(h => h.eventLoopLagMs));

    let memoryTrend: 'stable' | 'increasing' | 'decreasing' = 'stable';
    if (memorySlope > 0.5) memoryTrend = 'increasing';
    else if (memorySlope < -0.5) memoryTrend = 'decreasing';

    let eventLoopTrend: 'stable' | 'degrading' | 'improving' = 'stable';
    if (lagSlope > 0.1) eventLoopTrend = 'degrading';
    else if (lagSlope < -0.1) eventLoopTrend = 'improving';

    // Potential memory leak: consistent growth over time
    const isPotentialMemoryLeak = memoryTrend === 'increasing' &&
      memGrowthPerHour > 10 && // Growing more than 10MB/hour
      recentHistory.length >= 10; // Enough data points

    return {
      memoryTrend,
      memoryGrowthPerHour: Math.round(memGrowthPerHour * 10) / 10,
      eventLoopTrend,
      isPotentialMemoryLeak,
    };
  }

  private calculateSlope(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return isNaN(slope) ? 0 : slope;
  }

  shutdown(): void {
    if (this.gcObserver) {
      this.gcObserver.disconnect();
      this.gcObserver = null;
    }
    if (this.eventLoopInterval) {
      clearInterval(this.eventLoopInterval);
      this.eventLoopInterval = null;
    }
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
    this.isInitialized = false;
  }
}

// Initialize the metrics collector when module loads
const metricsCollector = HealthMetricsCollector.getInstance();
metricsCollector.initialize();

// ============================================================================
// EXTERNAL API HEALTH CHECKS
// ============================================================================

interface ExternalApiCheck {
  name: string;
  check: (timeoutMs: number) => Promise<{ latencyMs: number; error?: string }>;
  envKey: string; // Environment variable that indicates this API is configured
}

const externalApiChecks: ExternalApiCheck[] = [
  {
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    check: async (timeoutMs: number) => {
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok && response.status !== 401) {
          return { latencyMs: Date.now() - start, error: `HTTP ${response.status}` };
        }
        return { latencyMs: Date.now() - start };
      } catch (err) {
        clearTimeout(timeout);
        const error = err instanceof Error ? err.message : 'Unknown error';
        return { latencyMs: Date.now() - start, error };
      }
    },
  },
  {
    name: 'Anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    check: async (timeoutMs: number) => {
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        // Anthropic doesn't have a dedicated health endpoint, so we check the API base
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY || '',
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        // 200 = success, 401 = auth issue (but reachable), 400 = bad request (but reachable)
        if (response.status === 200 || response.status === 401 || response.status === 400) {
          return { latencyMs: Date.now() - start };
        }
        return { latencyMs: Date.now() - start, error: `HTTP ${response.status}` };
      } catch (err) {
        clearTimeout(timeout);
        const error = err instanceof Error ? err.message : 'Unknown error';
        return { latencyMs: Date.now() - start, error };
      }
    },
  },
  {
    name: 'Alpaca',
    envKey: 'ALPACA_API_KEY',
    check: async (timeoutMs: number) => {
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const baseUrl = process.env.ALPACA_PAPER === 'true'
        ? 'https://paper-api.alpaca.markets'
        : 'https://api.alpaca.markets';

      try {
        const response = await fetch(`${baseUrl}/v2/account`, {
          method: 'GET',
          headers: {
            'APCA-API-KEY-ID': process.env.ALPACA_API_KEY || '',
            'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY || '',
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok && response.status !== 401 && response.status !== 403) {
          return { latencyMs: Date.now() - start, error: `HTTP ${response.status}` };
        }
        return { latencyMs: Date.now() - start };
      } catch (err) {
        clearTimeout(timeout);
        const error = err instanceof Error ? err.message : 'Unknown error';
        return { latencyMs: Date.now() - start, error };
      }
    },
  },
];

async function checkExternalApis(timeoutMs: number): Promise<HealthStatus['externalApis']> {
  const results: HealthStatus['externalApis'] = [];

  for (const api of externalApiChecks) {
    if (!process.env[api.envKey]) {
      results.push({
        name: api.name,
        status: 'unchecked',
        lastChecked: new Date().toISOString(),
      });
      continue;
    }

    try {
      const { latencyMs, error } = await api.check(timeoutMs);

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (error) {
        status = error.includes('timeout') ? 'degraded' : 'unhealthy';
      } else if (latencyMs > 2000) {
        status = 'degraded';
      }

      results.push({
        name: api.name,
        status,
        latencyMs,
        error,
        lastChecked: new Date().toISOString(),
      });
    } catch (err) {
      results.push({
        name: api.name,
        status: 'unhealthy',
        error: err instanceof Error ? err.message : 'Check failed',
        lastChecked: new Date().toISOString(),
      });
    }
  }

  return results;
}

// ============================================================================
// MAIN HEALTH CHECK FUNCTION
// ============================================================================

/**
 * Perform a comprehensive health check
 *
 * This enhanced version includes:
 * - Memory and heap analysis with V8 statistics
 * - Event loop lag detection
 * - Process CPU usage
 * - GC metrics
 * - External API health checks
 * - Trend analysis for predictive alerting
 */
export async function performHealthCheck(
  config: HealthCheckConfig = {},
  discordClient?: any,
  services: { name: string; isRunning: () => boolean; lastActivity?: () => Date | null }[] = []
): Promise<HealthStatus> {
  const checkStart = Date.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const warnings: string[] = [];
  const errors: string[] = [];
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // -------------------------------------------------------------------------
  // Memory Metrics - Enhanced with V8 heap statistics
  // -------------------------------------------------------------------------
  const memUsage = process.memoryUsage();
  const heapStats = v8.getHeapStatistics();
  const heapLimit = heapStats.heap_size_limit;
  const heapPercentOfLimit = (memUsage.heapUsed / heapLimit) * 100;
  const heapPercentOfCurrent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  const memory = {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapLimit: Math.round(heapLimit / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024),
    rss: Math.round(memUsage.rss / 1024 / 1024),
    percentUsed: Math.round(heapPercentOfLimit * 10) / 10,
    percentOfCurrent: Math.round(heapPercentOfCurrent * 10) / 10,
    arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024),
  };

  if (heapPercentOfLimit > cfg.memoryThresholdPercent) {
    warnings.push(`High memory usage: ${memory.percentUsed}% of ${memory.heapLimit}MB limit`);
    overallStatus = 'degraded';
  }

  if (heapPercentOfLimit > 95) {
    errors.push(`Critical memory usage: ${memory.percentUsed}%`);
    overallStatus = 'unhealthy';
  }

  // -------------------------------------------------------------------------
  // CPU Metrics
  // -------------------------------------------------------------------------
  const cpu = {
    processUsage: metricsCollector.getCpuUsage(),
    systemLoad: os.loadavg(),
    cores: os.cpus().length,
  };

  // High CPU usage warning
  if (cpu.processUsage > 80) {
    warnings.push(`High CPU usage: ${cpu.processUsage}%`);
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  // -------------------------------------------------------------------------
  // Event Loop Metrics
  // -------------------------------------------------------------------------
  const currentLag = metricsCollector.getCurrentLag();
  const p99Lag = metricsCollector.getP99Lag();

  const eventLoop = {
    lagMs: Math.round(currentLag * 100) / 100,
    isBlocked: currentLag > cfg.eventLoopLagThresholdMs,
    p99LagMs: Math.round(p99Lag * 100) / 100,
  };

  if (eventLoop.isBlocked) {
    warnings.push(`Event loop blocked: ${eventLoop.lagMs}ms lag (threshold: ${cfg.eventLoopLagThresholdMs}ms)`);
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  if (p99Lag > cfg.eventLoopLagThresholdMs * 2) {
    warnings.push(`P99 event loop lag high: ${eventLoop.p99LagMs}ms`);
  }

  // -------------------------------------------------------------------------
  // GC Metrics
  // -------------------------------------------------------------------------
  const gc = metricsCollector.getGcStats();

  // Long GC pauses can indicate memory pressure
  if (gc.lastPauseMs > 100) {
    warnings.push(`Long GC pause detected: ${gc.lastPauseMs}ms`);
  }

  // -------------------------------------------------------------------------
  // Database Check (Hetzner PostgreSQL)
  // -------------------------------------------------------------------------
  const dbHost = process.env.AGENTFLOW_DB_HOST || '178.156.198.233';
  let database: HealthStatus['database'] = { type: 'hetzner-postgres', connected: false, host: dbHost };

  if (cfg.checkDatabase) {
    try {
      const db = getAgentFlowDatabase();
      const start = Date.now();

      await Promise.race([
        (async () => {
          if (db) {
            const isHealthy = await db.ping();
            if (!isHealthy) {
              throw new Error('Hetzner PostgreSQL ping failed');
            }
          }
          return true;
        })(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Hetzner PostgreSQL timeout')), cfg.dbTimeoutMs)
        )
      ]);

      const latencyMs = Date.now() - start;

      // Get pool statistics if available
      let poolSize: number | undefined;
      let activeConnections: number | undefined;
      try {
        const poolStats = (db as any).pool;
        if (poolStats) {
          poolSize = poolStats.totalCount;
          activeConnections = poolStats.totalCount - poolStats.idleCount;
        }
      } catch {
        // Pool stats not available
      }

      database = {
        type: 'hetzner-postgres',
        connected: true,
        latencyMs,
        poolSize,
        activeConnections,
        host: dbHost,
      };

      if (latencyMs > 2000) {
        errors.push(`Very slow Hetzner DB response: ${latencyMs}ms`);
        overallStatus = 'degraded';
      } else if (latencyMs > 1000) {
        warnings.push(`Slow Hetzner DB response: ${latencyMs}ms`);
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      }
    } catch (error) {
      database = {
        type: 'hetzner-postgres',
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        host: dbHost,
      };
      errors.push(`Hetzner PostgreSQL connection failed: ${database.error}`);
      overallStatus = 'unhealthy';
    }
  }

  // -------------------------------------------------------------------------
  // Discord Client Check (Enhanced)
  // -------------------------------------------------------------------------
  let discord: HealthStatus['discord'] | undefined;

  if (discordClient) {
    try {
      const isReady = discordClient.isReady?.() ?? discordClient.ws?.status === 0;
      discord = {
        connected: isReady,
        ping: discordClient.ws?.ping ?? undefined,
        guilds: discordClient.guilds?.cache?.size ?? 0,
        shardCount: discordClient.ws?.shards?.size ?? 1,
        shardStatus: discordClient.ws?.status !== undefined
          ? ['READY', 'CONNECTING', 'RECONNECTING', 'IDLE', 'NEARLY', 'DISCONNECTED', 'WAITING_FOR_GUILDS', 'IDENTIFYING', 'RESUMING'][discordClient.ws.status] || 'UNKNOWN'
          : undefined,
      };

      if (!isReady) {
        errors.push('Discord client not connected');
        overallStatus = 'unhealthy';
      } else if (discord.ping && discord.ping > 500) {
        warnings.push(`High Discord latency: ${discord.ping}ms`);
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      }
    } catch (error) {
      discord = { connected: false };
      errors.push('Failed to check Discord status');
    }
  }

  // -------------------------------------------------------------------------
  // External API Health Checks
  // -------------------------------------------------------------------------
  let externalApis: HealthStatus['externalApis'] = [];

  if (cfg.checkExternalApis) {
    try {
      externalApis = await checkExternalApis(cfg.apiTimeoutMs);

      // Check for unhealthy external APIs
      const unhealthyApis = externalApis.filter(api => api.status === 'unhealthy');
      const degradedApis = externalApis.filter(api => api.status === 'degraded');

      if (unhealthyApis.length > 0) {
        warnings.push(`External APIs unhealthy: ${unhealthyApis.map(a => a.name).join(', ')}`);
        // Don't fail health check for external API issues, just warn
      }

      if (degradedApis.length > 0) {
        warnings.push(`External APIs degraded: ${degradedApis.map(a => a.name).join(', ')}`);
      }
    } catch (error) {
      warnings.push('Failed to check external APIs');
    }
  }

  // -------------------------------------------------------------------------
  // Service Checks
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Trend Analysis
  // -------------------------------------------------------------------------
  let trends: HealthStatus['trends'] = {
    memoryTrend: 'unknown',
    memoryGrowthPerHour: 0,
    eventLoopTrend: 'unknown',
    isPotentialMemoryLeak: false,
  };

  if (cfg.enableTrendAnalysis) {
    trends = metricsCollector.analyzeTrends(cfg.trendWindowMinutes);

    if (trends.isPotentialMemoryLeak) {
      warnings.push(`Potential memory leak detected: ${trends.memoryGrowthPerHour}MB/hour growth`);
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }

    if (trends.eventLoopTrend === 'degrading') {
      warnings.push('Event loop performance degrading over time');
    }
  }

  // -------------------------------------------------------------------------
  // Build Final Result
  // -------------------------------------------------------------------------
  const checkDurationMs = Date.now() - checkStart;

  // Warn if health check itself is slow
  if (checkDurationMs > 5000) {
    warnings.push(`Health check took ${checkDurationMs}ms`);
  }

  return {
    status: overallStatus,
    uptime: process.uptime(),
    memory,
    cpu,
    eventLoop,
    gc: gc.totalCollections > 0 ? gc : undefined,
    database,
    discord,
    externalApis,
    services: serviceStatuses,
    trends,
    warnings,
    errors,
    timestamp: new Date().toISOString(),
    checkDurationMs,
  };
}

/**
 * Quick health check for latency-sensitive endpoints
 * Only checks critical components, skips external API checks
 */
export async function performQuickHealthCheck(
  config: Partial<HealthCheckConfig> = {},
  discordClient?: any
): Promise<Pick<HealthStatus, 'status' | 'uptime' | 'memory' | 'eventLoop' | 'database' | 'discord' | 'warnings' | 'timestamp'>> {
  const quickConfig = {
    ...config,
    checkExternalApis: false,
    enableTrendAnalysis: false,
    dbTimeoutMs: 2000,
  };

  const fullHealth = await performHealthCheck(quickConfig, discordClient, []);

  return {
    status: fullHealth.status,
    uptime: fullHealth.uptime,
    memory: fullHealth.memory,
    eventLoop: fullHealth.eventLoop,
    database: fullHealth.database,
    discord: fullHealth.discord,
    warnings: fullHealth.warnings,
    timestamp: fullHealth.timestamp,
  };
}

/**
 * Express middleware for health check endpoint
 * Returns appropriate HTTP status codes based on health
 *
 * Query params:
 * - quick=true: Use quick health check (faster, fewer checks)
 * - format=minimal: Return minimal response
 */
export function healthCheckHandler(
  config: HealthCheckConfig = {},
  getDiscordClient?: () => any,
  getServices?: () => { name: string; isRunning: () => boolean; lastActivity?: () => Date | null }[]
) {
  return async (req: any, res: any) => {
    try {
      const isQuick = req.query?.quick === 'true';
      const isMinimal = req.query?.format === 'minimal';

      let health: HealthStatus | Partial<HealthStatus>;

      if (isQuick) {
        health = await performQuickHealthCheck(config, getDiscordClient?.());
      } else {
        health = await performHealthCheck(
          config,
          getDiscordClient?.(),
          getServices?.() ?? []
        );
      }

      // Map health status to HTTP status code
      const httpStatus = health.status === 'healthy' ? 200
                       : health.status === 'degraded' ? 200  // Still return 200 for degraded so Docker doesn't restart unnecessarily
                       : 503;

      // Minimal format for simple monitoring tools
      if (isMinimal) {
        res.status(httpStatus).json({
          status: health.status,
          uptime: health.uptime,
          timestamp: health.timestamp,
        });
        return;
      }

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
 *
 * Endpoints:
 * - /health or /: Full health status
 * - /health?quick=true: Quick health check
 * - /ready: Kubernetes readiness probe
 * - /live: Kubernetes liveness probe
 */
export function createSimpleHealthServer(
  botName: string,
  port: number,
  getDiscordClient?: () => any
): { start: () => Promise<void>; stop: () => void; server: any } {
  const http = require('http');
  const url = require('url');

  const server = http.createServer(async (req: any, res: any) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    // Kubernetes liveness probe - always return 200 if process is running
    if (pathname === '/live' || pathname === '/livez') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'alive', bot: botName }));
      return;
    }

    // Kubernetes readiness probe - check if ready to serve traffic
    if (pathname === '/ready' || pathname === '/readyz') {
      const discordClient = getDiscordClient?.();
      const isReady = discordClient ? (discordClient.isReady?.() ?? false) : true;

      const httpStatus = isReady ? 200 : 503;
      res.writeHead(httpStatus, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: isReady ? 'ready' : 'not_ready',
        bot: botName,
        discord: discordClient ? { connected: isReady } : undefined,
      }));
      return;
    }

    if (pathname === '/health' || pathname === '/') {
      try {
        const memUsage = process.memoryUsage();
        const heapStats = v8.getHeapStatistics();
        const heapLimit = heapStats.heap_size_limit;
        const heapPercentOfLimit = (memUsage.heapUsed / heapLimit) * 100;

        const discordClient = getDiscordClient?.();
        const discordConnected = discordClient?.isReady?.() ?? false;

        // Get event loop metrics
        const eventLoopLag = metricsCollector.getCurrentLag();
        const p99Lag = metricsCollector.getP99Lag();
        const cpuUsage = metricsCollector.getCpuUsage();
        const trends = metricsCollector.analyzeTrends(30);

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
        if (eventLoopLag > 100) {
          if (status === 'healthy') status = 'degraded';
          warnings.push(`Event loop lag: ${Math.round(eventLoopLag)}ms`);
        }
        if (trends.isPotentialMemoryLeak) {
          if (status === 'healthy') status = 'degraded';
          warnings.push(`Potential memory leak: ${trends.memoryGrowthPerHour}MB/hour`);
        }

        const httpStatus = status === 'unhealthy' ? 503 : 200;

        // Quick response for monitoring tools
        if (query.quick === 'true') {
          res.writeHead(httpStatus, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status,
            bot: botName,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
          }));
          return;
        }

        res.writeHead(httpStatus, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status,
          bot: botName,
          uptime: process.uptime(),
          memory: {
            heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
            heapLimitMB: Math.round(heapLimit / 1024 / 1024),
            rssMB: Math.round(memUsage.rss / 1024 / 1024),
            percentUsed: Math.round(heapPercentOfLimit * 10) / 10,
          },
          cpu: {
            processUsage: cpuUsage,
            systemLoad: os.loadavg(),
          },
          eventLoop: {
            lagMs: Math.round(eventLoopLag * 100) / 100,
            p99LagMs: Math.round(p99Lag * 100) / 100,
            isBlocked: eventLoopLag > 100,
          },
          discord: discordClient ? {
            connected: discordConnected,
            ping: discordClient.ws?.ping,
            guilds: discordClient.guilds?.cache?.size ?? 0,
            shardStatus: discordClient.ws?.status !== undefined
              ? ['READY', 'CONNECTING', 'RECONNECTING', 'IDLE', 'NEARLY', 'DISCONNECTED'][discordClient.ws.status] || 'UNKNOWN'
              : undefined,
          } : undefined,
          trends: {
            memoryTrend: trends.memoryTrend,
            memoryGrowthPerHour: trends.memoryGrowthPerHour,
            eventLoopTrend: trends.eventLoopTrend,
            isPotentialMemoryLeak: trends.isPotentialMemoryLeak,
          },
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
        logger.info(`   Endpoints: /health, /ready, /live`);
        resolve();
      });
    }),
    stop: () => server.close(),
  };
}

// ============================================================================
// EXPORTS AND UTILITIES
// ============================================================================

/**
 * Get the metrics collector instance for external use
 */
export function getMetricsCollector(): HealthMetricsCollector {
  return metricsCollector;
}

/**
 * Shutdown the metrics collector (for graceful shutdown)
 */
export function shutdownMetricsCollector(): void {
  metricsCollector.shutdown();
}

/**
 * Register a custom external API check
 */
export function registerExternalApiCheck(check: ExternalApiCheck): void {
  externalApiChecks.push(check);
}
