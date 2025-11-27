/**
 * Retry with Exponential Backoff Utility
 *
 * Provides resilient retry logic for operations that may fail transiently.
 * Used for Discord reconnections, API calls, database connections, etc.
 */

import { logger } from './logger';

export interface RetryConfig {
  maxRetries?: number;           // Max number of retry attempts (default: 5)
  initialDelayMs?: number;       // Initial delay in ms (default: 1000)
  maxDelayMs?: number;           // Maximum delay cap in ms (default: 30000)
  backoffMultiplier?: number;    // Multiplier for each retry (default: 2)
  jitterPercent?: number;        // Random jitter 0-100% (default: 25)
  retryCondition?: (error: Error) => boolean;  // When to retry (default: always)
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'retryCondition' | 'onRetry'>> = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterPercent: 25,
};

/**
 * Execute an async function with exponential backoff retry
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  operationName: string,
  config: RetryConfig = {}
): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | undefined;
  let delay = cfg.initialDelayMs;

  for (let attempt = 1; attempt <= cfg.maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry this error
      if (config.retryCondition && !config.retryCondition(lastError)) {
        logger.error(`[${operationName}] Non-retryable error:`, lastError);
        throw lastError;
      }

      // Check if we've exhausted retries
      if (attempt > cfg.maxRetries) {
        logger.error(`[${operationName}] All ${cfg.maxRetries} retries exhausted`);
        throw lastError;
      }

      // Calculate delay with jitter
      const jitter = delay * (cfg.jitterPercent / 100) * Math.random();
      const actualDelay = Math.min(delay + jitter, cfg.maxDelayMs);

      logger.warn(
        `[${operationName}] Attempt ${attempt}/${cfg.maxRetries} failed: ${lastError.message}. ` +
        `Retrying in ${Math.round(actualDelay)}ms...`
      );

      // Call retry callback if provided
      config.onRetry?.(attempt, lastError, actualDelay);

      // Wait before retrying
      await sleep(actualDelay);

      // Increase delay for next iteration
      delay = Math.min(delay * cfg.backoffMultiplier, cfg.maxDelayMs);
    }
  }

  // This should never happen, but TypeScript needs it
  throw lastError ?? new Error(`${operationName} failed with unknown error`);
}

/**
 * Create a retry-wrapped version of an async function
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  operationName: string,
  config: RetryConfig = {}
): T {
  return ((...args: Parameters<T>) =>
    retryWithBackoff(() => fn(...args), operationName, config)) as T;
}

/**
 * Utility sleep function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Common retry conditions
 */
export const RetryConditions = {
  // Retry on network errors
  networkErrors: (error: Error): boolean => {
    const networkErrorPatterns = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'socket hang up',
      'network',
      'timeout',
      'EHOSTUNREACH',
    ];
    const message = error.message.toLowerCase();
    return networkErrorPatterns.some(pattern =>
      message.includes(pattern.toLowerCase())
    );
  },

  // Retry on rate limit errors (HTTP 429)
  rateLimitErrors: (error: Error): boolean => {
    return error.message.includes('429') ||
           error.message.toLowerCase().includes('rate limit') ||
           error.message.toLowerCase().includes('too many requests');
  },

  // Retry on server errors (5xx)
  serverErrors: (error: Error): boolean => {
    const serverErrorCodes = ['500', '502', '503', '504'];
    return serverErrorCodes.some(code => error.message.includes(code));
  },

  // Retry on Discord-specific errors
  discordErrors: (error: Error): boolean => {
    const discordRetryable = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'rate limit',
      '429',
      '500',
      '502',
      '503',
      'DisconnectError',
      'WebSocket',
      'heartbeat',
    ];
    const message = error.message.toLowerCase();
    return discordRetryable.some(pattern =>
      message.includes(pattern.toLowerCase())
    );
  },

  // Combine multiple conditions (retry if ANY match)
  any: (...conditions: ((error: Error) => boolean)[]): ((error: Error) => boolean) => {
    return (error: Error) => conditions.some(condition => condition(error));
  },

  // Combine multiple conditions (retry if ALL match)
  all: (...conditions: ((error: Error) => boolean)[]): ((error: Error) => boolean) => {
    return (error: Error) => conditions.every(condition => condition(error));
  },
};

/**
 * Discord-specific reconnection helper
 *
 * Handles Discord.js client reconnection with proper backoff
 */
export class DiscordReconnectionManager {
  private reconnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private onReconnectCallback?: () => Promise<void>;

  constructor(
    private client: any,
    config: { maxReconnectAttempts?: number } = {}
  ) {
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 10;
  }

  /**
   * Set callback to run on successful reconnection
   */
  onReconnect(callback: () => Promise<void>): void {
    this.onReconnectCallback = callback;
  }

  /**
   * Attempt to reconnect the Discord client
   */
  async reconnect(): Promise<boolean> {
    if (this.reconnecting) {
      logger.warn('[Discord] Already attempting to reconnect');
      return false;
    }

    this.reconnecting = true;
    this.reconnectAttempts = 0;

    try {
      await retryWithBackoff(
        async () => {
          this.reconnectAttempts++;

          // Destroy existing connection
          if (this.client.ws?.status !== 0) {
            logger.info('[Discord] Destroying existing connection...');
            this.client.destroy();
            await sleep(1000);
          }

          // Attempt to login
          logger.info(`[Discord] Reconnection attempt ${this.reconnectAttempts}...`);
          await this.client.login(process.env.DISCORD_TOKEN);

          // Wait for ready event
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Discord ready timeout'));
            }, 30000);

            this.client.once('ready', () => {
              clearTimeout(timeout);
              resolve();
            });
          });
        },
        'Discord Reconnection',
        {
          maxRetries: this.maxReconnectAttempts,
          initialDelayMs: 5000,
          maxDelayMs: 60000,
          backoffMultiplier: 1.5,
          onRetry: (attempt, error, nextDelay) => {
            logger.warn(
              `[Discord] Reconnect attempt ${attempt} failed: ${error.message}. ` +
              `Next attempt in ${Math.round(nextDelay / 1000)}s`
            );
          }
        }
      );

      logger.info('[Discord] Successfully reconnected!');
      this.onReconnectCallback?.();
      return true;
    } catch (error) {
      logger.error('[Discord] Failed to reconnect after all attempts:', error);
      return false;
    } finally {
      this.reconnecting = false;
    }
  }

  /**
   * Check if currently reconnecting
   */
  isReconnecting(): boolean {
    return this.reconnecting;
  }

  /**
   * Get current reconnection attempt count
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}

/**
 * Database reconnection helper
 */
export async function reconnectDatabase(
  getConnection: () => Promise<any>,
  testConnection: () => Promise<boolean>,
  operationName = 'Database'
): Promise<boolean> {
  return retryWithBackoff(
    async () => {
      await getConnection();
      const isConnected = await testConnection();
      if (!isConnected) {
        throw new Error('Database connection test failed');
      }
      return true;
    },
    `${operationName} Reconnection`,
    {
      maxRetries: 5,
      initialDelayMs: 2000,
      maxDelayMs: 30000,
      retryCondition: RetryConditions.any(
        RetryConditions.networkErrors,
        RetryConditions.serverErrors
      ),
    }
  );
}
