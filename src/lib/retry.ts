// Smart retry with exponential backoff + jitter.
// Used by the AI execution engine to retry failed node executions.

export interface RetryConfig {
  maxRetries: number;       // default 3
  initialDelayMs: number;   // default 1000 (1s)
  maxDelayMs: number;       // default 30000 (30s)
  backoffFactor: number;    // default 2 (exponential)
  jitter: boolean;          // default true (adds randomness to avoid thundering herd)
  // Retryable status codes / error patterns
  retryableStatusCodes: number[];
  retryableErrors: string[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
  jitter: true,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrors: [
    "timeout",
    "rate limit",
    "rate_limit",
    "too many requests",
    "service unavailable",
    "internal server error",
    "bad gateway",
    "gateway timeout",
    "econnreset",
    "econnrefused",
    "etimedout",
    "socket hang up",
    "network error",
    "fetch failed",
  ],
};

/**
 * Check if an error is retryable based on its message or status code.
 */
export function isRetryableError(error: unknown, config: RetryConfig = DEFAULT_RETRY_CONFIG): boolean {
  if (!error) return false;

  const errorStr = String(error instanceof Error ? error.message : error).toLowerCase();

  // Check for retryable error messages
  for (const pattern of config.retryableErrors) {
    if (errorStr.includes(pattern.toLowerCase())) return true;
  }

  // Check for status codes in the error message (e.g. "HTTP 429")
  for (const code of config.retryableStatusCodes) {
    if (errorStr.includes(String(code))) return true;
  }

  // Check for fetch Response objects with retryable status codes
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status;
    if (config.retryableStatusCodes.includes(status)) return true;
  }

  return false;
}

/**
 * Calculate the delay for a given retry attempt (0-indexed).
 * delay = min(initialDelay * (backoffFactor ^ attempt), maxDelay) + jitter
 */
export function calculateDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffFactor, attempt);
  const clampedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  if (config.jitter) {
    // Add up to 25% jitter (random delay between 75% and 100% of calculated delay)
    const jitterFactor = 0.75 + Math.random() * 0.25;
    return Math.round(clampedDelay * jitterFactor);
  }

  return clampedDelay;
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async function with smart retries.
 * Returns the result on success, throws the last error after exhausting retries.
 *
 * @example
 * const result = await withRetry(async () => {
 *   const res = await fetch("https://api.example.com/data");
 *   if (!res.ok) throw new Error(`HTTP ${res.status}`);
 *   return res.json();
 * }, { maxRetries: 3 });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void,
): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on the last attempt or non-retryable errors
      if (attempt >= fullConfig.maxRetries || !isRetryableError(error, fullConfig)) {
        throw error;
      }

      const delayMs = calculateDelay(attempt, fullConfig);
      if (onRetry) {
        onRetry(attempt + 1, error, delayMs);
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Format a retry attempt for display.
 */
export function formatRetryAttempt(attempt: number, maxRetries: number): string {
  return `Retry ${attempt}/${maxRetries}`;
}
