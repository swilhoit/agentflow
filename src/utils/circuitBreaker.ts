/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures when external services are down.
 * Instead of repeatedly calling a failing service, the circuit "opens"
 * and fails fast, giving the service time to recover.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests fail fast without calling service
 * - HALF_OPEN: Testing if service recovered, allowing limited requests
 */

import { logger } from './logger';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold?: number;     // Failures before opening (default: 5)
  successThreshold?: number;     // Successes in half-open to close (default: 2)
  timeout?: number;              // Time in ms before trying again (default: 30000)
  resetTimeout?: number;         // Time before fully resetting counters (default: 60000)
  onStateChange?: (name: string, from: CircuitState, to: CircuitState) => void;
  onFailure?: (name: string, error: Error) => void;
}

interface CircuitStats {
  failures: number;
  successes: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  consecutiveSuccesses: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private stats: CircuitStats = {
    failures: 0,
    successes: 0,
    lastFailure: null,
    lastSuccess: null,
    consecutiveSuccesses: 0,
  };
  private config: Required<CircuitBreakerConfig>;
  private nextRetryTime: number = 0;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,
      resetTimeout: 60000,
      onStateChange: () => {},
      onFailure: () => {},
      ...config,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextRetryTime) {
        this.transition('HALF_OPEN');
      } else {
        throw new CircuitOpenError(
          `Circuit breaker "${this.config.name}" is OPEN. Next retry at ${new Date(this.nextRetryTime).toISOString()}`
        );
      }
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error as Error);
      throw error;
    }
  }

  /**
   * Execute with fallback value when circuit is open
   */
  async executeWithFallback<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await this.execute(fn);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        logger.warn(`[CircuitBreaker:${this.config.name}] Using fallback due to open circuit`);
        return fallback;
      }
      throw error;
    }
  }

  /**
   * Execute with fallback function when circuit is open
   */
  async executeWithFallbackFn<T>(fn: () => Promise<T>, fallbackFn: () => T | Promise<T>): Promise<T> {
    try {
      return await this.execute(fn);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        logger.warn(`[CircuitBreaker:${this.config.name}] Using fallback function due to open circuit`);
        return fallbackFn();
      }
      throw error;
    }
  }

  private recordSuccess(): void {
    this.stats.successes++;
    this.stats.lastSuccess = new Date();
    this.stats.consecutiveSuccesses++;

    if (this.state === 'HALF_OPEN') {
      if (this.stats.consecutiveSuccesses >= this.config.successThreshold) {
        this.transition('CLOSED');
        this.resetStats();
      }
    }
  }

  private recordFailure(error: Error): void {
    this.stats.failures++;
    this.stats.lastFailure = new Date();
    this.stats.consecutiveSuccesses = 0;
    this.config.onFailure(this.config.name, error);

    if (this.state === 'HALF_OPEN') {
      // Single failure in half-open immediately opens
      this.transition('OPEN');
      this.nextRetryTime = Date.now() + this.config.timeout;
    } else if (this.state === 'CLOSED') {
      if (this.stats.failures >= this.config.failureThreshold) {
        this.transition('OPEN');
        this.nextRetryTime = Date.now() + this.config.timeout;
      }
    }
  }

  private transition(newState: CircuitState): void {
    if (this.state !== newState) {
      logger.info(`[CircuitBreaker:${this.config.name}] ${this.state} -> ${newState}`);
      this.config.onStateChange(this.config.name, this.state, newState);
      this.state = newState;
    }
  }

  private resetStats(): void {
    this.stats = {
      failures: 0,
      successes: 0,
      lastFailure: null,
      lastSuccess: null,
      consecutiveSuccesses: 0,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.transition('CLOSED');
    this.resetStats();
    this.nextRetryTime = 0;
  }

  /**
   * Get current circuit state and stats
   */
  getStatus(): { state: CircuitState; stats: CircuitStats; nextRetryTime: number | null } {
    return {
      state: this.state,
      stats: { ...this.stats },
      nextRetryTime: this.state === 'OPEN' ? this.nextRetryTime : null,
    };
  }

  /**
   * Check if circuit is allowing requests
   */
  isAvailable(): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'HALF_OPEN') return true;
    if (this.state === 'OPEN' && Date.now() >= this.nextRetryTime) return true;
    return false;
  }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Registry to manage multiple circuit breakers
 */
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  get(name: string, config?: Omit<CircuitBreakerConfig, 'name'>): CircuitBreaker {
    let breaker = this.breakers.get(name);
    if (!breaker) {
      breaker = new CircuitBreaker({ name, ...config });
      this.breakers.set(name, breaker);
    }
    return breaker;
  }

  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  getAllStatuses(): Record<string, ReturnType<CircuitBreaker['getStatus']>> {
    const statuses: Record<string, ReturnType<CircuitBreaker['getStatus']>> = {};
    for (const [name, breaker] of this.breakers) {
      statuses[name] = breaker.getStatus();
    }
    return statuses;
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Global registry
export const circuitBreakers = new CircuitBreakerRegistry();

/**
 * Decorator-style helper for wrapping async functions
 */
export function withCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T,
  config?: Omit<CircuitBreakerConfig, 'name'>
): T {
  const breaker = circuitBreakers.get(name, config);
  return ((...args: Parameters<T>) => breaker.execute(() => fn(...args))) as T;
}

/**
 * Create a protected API client wrapper
 *
 * Example:
 * const protectedFetch = createProtectedClient('finnhub-api', {
 *   failureThreshold: 3,
 *   timeout: 60000
 * });
 *
 * const data = await protectedFetch(() => fetch('https://api.finnhub.io/...'));
 */
export function createProtectedClient<T>(
  name: string,
  config?: Omit<CircuitBreakerConfig, 'name'>
) {
  const breaker = circuitBreakers.get(name, config);

  return {
    execute: <R>(fn: () => Promise<R>) => breaker.execute(fn),
    executeWithFallback: <R>(fn: () => Promise<R>, fallback: R) =>
      breaker.executeWithFallback(fn, fallback),
    getStatus: () => breaker.getStatus(),
    isAvailable: () => breaker.isAvailable(),
    reset: () => breaker.reset(),
  };
}
