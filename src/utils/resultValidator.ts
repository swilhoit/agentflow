import { logger } from './logger';

/**
 * Result Validator and Retry Handler
 * Validates tool results and retries on recoverable failures
 */

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  stdout?: string;
  stderr?: string;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number; // milliseconds
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  retryDelay: 1000,
  backoffMultiplier: 2
};

/**
 * Check if error is retryable
 */
export function isRetryableError(error: string): boolean {
  const retryablePatterns = [
    /rate limit/i,
    /timeout/i,
    /timed out/i,
    /connection reset/i,
    /econnreset/i,
    /enotfound/i,
    /temporarily unavailable/i,
    /service unavailable/i,
    /502 bad gateway/i,
    /503 service unavailable/i,
    /504 gateway timeout/i,
    /try again/i,
    /network error/i
  ];

  return retryablePatterns.some(pattern => pattern.test(error));
}

/**
 * Execute function with retry logic
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context: string = 'operation'
): Promise<T> {
  let lastError: Error | null = null;
  let delay = config.retryDelay;

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      logger.info(`[Retry] Attempt ${attempt}/${config.maxRetries + 1} for ${context}`);
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry if not retryable or on last attempt
      if (attempt > config.maxRetries || !isRetryableError(lastError.message)) {
        logger.error(`[Retry] Failed after ${attempt} attempt(s): ${context}`, error);
        throw lastError;
      }

      logger.warn(`[Retry] Attempt ${attempt} failed, retrying in ${delay}ms: ${lastError.message}`);
      await sleep(delay);
      delay *= config.backoffMultiplier; // Exponential backoff
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Validate tool result
 */
export function validateToolResult(result: ToolResult, toolName: string): {
  valid: boolean;
  error?: string;
  suggestion?: string;
} {
  // Check basic structure
  if (typeof result !== 'object' || result === null) {
    return {
      valid: false,
      error: 'Result is not an object',
      suggestion: 'Tool should return { success: boolean, ... }'
    };
  }

  // Check success field
  if (typeof result.success !== 'boolean') {
    return {
      valid: false,
      error: 'Missing or invalid "success" field',
      suggestion: 'Result must include success: true/false'
    };
  }

  // If success is false, should have error message
  if (!result.success && !result.error) {
    return {
      valid: false,
      error: 'Failed result missing error message',
      suggestion: 'When success is false, include error field'
    };
  }

  // Tool-specific validation
  if (toolName === 'execute_bash') {
    if (result.success && !result.stdout && !result.data) {
      logger.warn(`[Validator] Bash command succeeded but no output`);
    }
  }

  return { valid: true };
}

/**
 * Compress result for faster processing
 */
export function compressResult(result: ToolResult, maxLength: number = 1000): ToolResult {
  if (!result.data) {
    return result;
  }

  const dataStr = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
  
  if (dataStr.length <= maxLength) {
    return result;
  }

  logger.info(`[Validator] Compressing result from ${dataStr.length} to ${maxLength} chars`);

  // Try to parse as JSON and summarize
  try {
    const data = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
    
    if (Array.isArray(data)) {
      return {
        ...result,
        data: {
          type: 'array',
          count: data.length,
          sample: data.slice(0, 3),
          preview: `${data.length} items (showing first 3)`
        }
      };
    } else if (typeof data === 'object') {
      return {
        ...result,
        data: {
          type: 'object',
          keys: Object.keys(data),
          preview: JSON.stringify(data).substring(0, maxLength)
        }
      };
    }
  } catch {
    // Not JSON, truncate as string
  }

  // Fallback: Simple truncation
  return {
    ...result,
    data: dataStr.substring(0, maxLength) + `... (truncated from ${dataStr.length} chars)`
  };
}

/**
 * Check if result indicates rate limiting
 */
export function isRateLimited(result: ToolResult): boolean {
  const errorMsg = result.error || result.stderr || '';
  return /rate limit|too many requests|403|429/i.test(errorMsg);
}

/**
 * Extract retry-after header value if present
 */
export function getRetryAfter(result: ToolResult): number | null {
  const errorMsg = result.error || result.stderr || '';
  const match = errorMsg.match(/retry after (\d+)/i);
  return match ? parseInt(match[1], 10) * 1000 : null;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

