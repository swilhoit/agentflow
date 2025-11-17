import { logger } from './logger';

/**
 * Smart Cache for API responses
 * Caches GitHub, Trello, and other API calls for short periods
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class SmartCache {
  private cache: Map<string, CacheEntry> = new Map();
  private hitCount: number = 0;
  private missCount: number = 0;

  /**
   * Get from cache
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.missCount++;
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    // Check if expired
    if (age > entry.ttl) {
      this.cache.delete(key);
      this.missCount++;
      logger.info(`[Cache] EXPIRED: ${key} (age: ${age}ms, ttl: ${entry.ttl}ms)`);
      return null;
    }

    this.hitCount++;
    logger.info(`[Cache] HIT: ${key} (age: ${age}ms)`);
    return entry.data;
  }

  /**
   * Set cache entry
   */
  set(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    logger.info(`[Cache] SET: ${key} (ttl: ${ttl}ms)`);
  }

  /**
   * Invalidate specific key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    logger.info(`[Cache] INVALIDATED: ${key}`);
  }

  /**
   * Invalidate keys matching pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    let count = 0;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    logger.info(`[Cache] INVALIDATED ${count} keys matching pattern: ${pattern}`);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`[Cache] CLEARED all ${size} entries`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hitCount + this.missCount;
    return {
      size: this.cache.size,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: total > 0 ? (this.hitCount / total) * 100 : 0
    };
  }

  /**
   * Clean expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`[Cache] CLEANUP: Removed ${cleaned} expired entries`);
    }
  }

  /**
   * Generate cache key for tool calls
   */
  static generateKey(toolName: string, args: any): string {
    const argsStr = JSON.stringify(args, Object.keys(args).sort());
    return `${toolName}:${argsStr}`;
  }
}

/**
 * Global cache instance
 */
export const globalCache = new SmartCache();

/**
 * TTL configurations (in milliseconds)
 */
export const CacheTTL = {
  GITHUB_REPOS: 5 * 60 * 1000,      // 5 minutes
  GITHUB_REPO_INFO: 2 * 60 * 1000,  // 2 minutes
  GITHUB_COMMITS: 1 * 60 * 1000,    // 1 minute
  TRELLO_BOARDS: 2 * 60 * 1000,     // 2 minutes
  TRELLO_LISTS: 1 * 60 * 1000,      // 1 minute
  TRELLO_CARDS: 30 * 1000,          // 30 seconds
  CLOUD_SERVICES: 1 * 60 * 1000,    // 1 minute
  BASH_READ_ONLY: 30 * 1000,        // 30 seconds (for read-only commands)
  DEFAULT: 1 * 60 * 1000            // 1 minute
};

/**
 * Determine if a command is cacheable
 */
export function isCacheable(toolName: string, args: any): { cacheable: boolean; ttl: number } {
  // GitHub commands
  if (toolName === 'execute_bash' && args.command) {
    const cmd = args.command.toLowerCase();
    
    // GitHub list repos
    if (cmd.includes('gh repo list') || cmd.includes('gh api user/repos')) {
      return { cacheable: true, ttl: CacheTTL.GITHUB_REPOS };
    }
    
    // GitHub repo view
    if (cmd.includes('gh repo view') && !cmd.includes('--json')) {
      return { cacheable: true, ttl: CacheTTL.GITHUB_REPO_INFO };
    }
    
    // GitHub commits
    if (cmd.includes('gh api repos') && cmd.includes('commits')) {
      return { cacheable: true, ttl: CacheTTL.GITHUB_COMMITS };
    }
    
    // Trello (though we should use REST API)
    if (cmd.includes('trello')) {
      return { cacheable: true, ttl: CacheTTL.TRELLO_BOARDS };
    }
    
    // GCloud list commands (read-only)
    if (cmd.includes('gcloud') && (cmd.includes('list') || cmd.includes('describe'))) {
      return { cacheable: true, ttl: CacheTTL.CLOUD_SERVICES };
    }
    
    // Generic read-only bash (ls, cat, etc.)
    if (cmd.match(/^(ls|cat|head|tail|grep|find|pwd|echo|which|whereis)\s/)) {
      return { cacheable: true, ttl: CacheTTL.BASH_READ_ONLY };
    }
  }
  
  // Trello REST API calls
  if (toolName === 'trello_list_boards') {
    return { cacheable: true, ttl: CacheTTL.TRELLO_BOARDS };
  }
  
  if (toolName === 'trello_get_lists') {
    return { cacheable: true, ttl: CacheTTL.TRELLO_LISTS };
  }
  
  if (toolName === 'trello_get_cards_on_list') {
    return { cacheable: true, ttl: CacheTTL.TRELLO_CARDS };
  }
  
  // Not cacheable (mutations, writes, etc.)
  return { cacheable: false, ttl: 0 };
}

/**
 * Start automatic cleanup interval
 */
export function startCacheCleanup(intervalMs: number = 60000): NodeJS.Timeout {
  logger.info(`[Cache] Starting automatic cleanup every ${intervalMs}ms`);
  return setInterval(() => {
    globalCache.cleanup();
  }, intervalMs);
}

