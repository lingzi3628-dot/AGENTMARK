// Simple in-memory rate limiter for the public REST API.
// Limits requests per API key per time window.
// For production with multiple instances, move this to Redis or Upstash Ratelimit.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_MAP = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes to prevent memory bloat
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of RATE_LIMIT_MAP) {
    if (entry.resetAt < now) {
      RATE_LIMIT_MAP.delete(key);
    }
  }
}

export interface RateLimitConfig {
  // Maximum requests per window
  maxRequests: number;
  // Window size in milliseconds
  windowMs: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 100,   // 100 requests per...
  windowMs: 60_000,   // ...60 seconds = ~1.67 req/sec
};

export const RUN_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 20,    // 20 agent runs per...
  windowMs: 60_000,   // ...60 seconds
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

/**
 * Check if a request should be allowed under the rate limit.
 * Call this at the start of each API route handler.
 *
 * @example
 * const rl = checkRateLimit(apiKeyId, RUN_RATE_LIMIT);
 * if (!rl.allowed) {
 *   return NextResponse.json({ error: "Rate limit exceeded" }, {
 *     status: 429,
 *     headers: { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(rl.resetAt) }
 *   });
 * }
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT,
): RateLimitResult {
  cleanup();

  const now = Date.now();
  const key = `${identifier}:${Math.floor(now / config.windowMs)}`;
  const entry = RATE_LIMIT_MAP.get(key);

  if (!entry) {
    // New window
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    RATE_LIMIT_MAP.set(key, newEntry);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: newEntry.resetAt,
      limit: config.maxRequests,
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      limit: config.maxRequests,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
    limit: config.maxRequests,
  };
}

/**
 * Build standard rate limit headers for the response.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
  };
}
