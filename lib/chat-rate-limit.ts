import { redisClient } from "./redis";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds?: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

// Default: 100 messages per hour
const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowSeconds: 3600, // 1 hour
};

/**
 * Sliding window rate limiter for chat messages using Redis
 * Falls back to allowing all requests if Redis is not configured
 */
export async function checkChatRateLimit(
  userId: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  const { maxRequests, windowSeconds } = config;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = now - windowMs;
  const resetAt = new Date(now + windowMs);

  // If Redis is not available, allow all requests (development fallback)
  if (!redisClient || !redisClient.isOpen) {
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt,
    };
  }

  const key = `chat:rate:${userId}`;

  try {
    // Use Redis sorted set for sliding window
    // Score = timestamp, Member = unique request ID
    const multi = redisClient.multi();

    // Remove old entries outside the window
    multi.zRemRangeByScore(key, 0, windowStart);

    // Count current requests in window
    multi.zCard(key);

    // Add current request with timestamp as score
    const requestId = `${now}:${Math.random().toString(36).substr(2, 9)}`;
    multi.zAdd(key, { score: now, value: requestId });

    // Set expiry on the key
    multi.expire(key, windowSeconds + 60); // Add buffer

    const results = await multi.exec();

    // zCard result is at index 1
    const currentCount = (results[1] as number) || 0;

    if (currentCount >= maxRequests) {
      // Get the oldest entry to calculate retry time
      const oldestEntries = await redisClient.zRange(key, 0, 0, {
        REV: false,
      });
      
      let retryAfterSeconds = windowSeconds;
      if (oldestEntries.length > 0) {
        const oldestScore = await redisClient.zScore(key, oldestEntries[0]);
        if (oldestScore) {
          retryAfterSeconds = Math.ceil((oldestScore + windowMs - now) / 1000);
        }
      }

      // Remove the request we just added since it's not allowed
      await redisClient.zRem(key, requestId);

      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(now + retryAfterSeconds * 1000),
        retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      remaining: maxRequests - currentCount - 1,
      resetAt,
    };
  } catch (error) {
    // Log error but allow request (fail open for better UX)
    console.error("Rate limit check failed:", error);
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt,
    };
  }
}

/**
 * Get current rate limit status without incrementing
 */
export async function getChatRateLimitStatus(
  userId: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  const { maxRequests, windowSeconds } = config;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = now - windowMs;
  const resetAt = new Date(now + windowMs);

  if (!redisClient || !redisClient.isOpen) {
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt,
    };
  }

  const key = `chat:rate:${userId}`;

  try {
    // Clean old entries and count
    await redisClient.zRemRangeByScore(key, 0, windowStart);
    const currentCount = await redisClient.zCard(key);

    return {
      allowed: currentCount < maxRequests,
      remaining: Math.max(0, maxRequests - currentCount),
      resetAt,
    };
  } catch (error) {
    console.error("Rate limit status check failed:", error);
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt,
    };
  }
}
