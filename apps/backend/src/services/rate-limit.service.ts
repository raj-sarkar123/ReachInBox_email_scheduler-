import { redisConnection } from '../queues/redis.js';
import { logger } from '../utils/logger.js';

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  rescheduledTime?: Date;
  delayMs?: number;
}

const RATE_LIMIT_LUA_SCRIPT = `
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local ttl = tonumber(ARGV[2])

  local current = redis.call('INCR', key)
  if current == 1 then
    redis.call('EXPIRE', key, ttl)
  end

  if current > limit then
    return { 0, current }
  else
    return { 1, current }
  end
`;

export class RateLimitService {
  /**
   * Generates a stable hourly bucket key for a given sender and timestamp
   */
  private getHourWindowKey(senderId: string, date: Date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    return `email-rate:${senderId}:${year}-${month}-${day}-${hour}`;
  }

  /**
   * Calculates the exact start time of the next available hourly window.
   */
  getNextHourWindowStart(now: Date = new Date(), offsetSeconds: number = 0): Date {
    const nextHour = new Date(now);
    nextHour.setUTCMinutes(0, 0, 0);
    nextHour.setUTCHours(nextHour.getUTCHours() + 1);
    // Add minor staggered offset so rescheduled jobs don't all execute on millisecond 0
    nextHour.setSeconds(nextHour.getSeconds() + offsetSeconds);
    return nextHour;
  }

  /**
   * Atomically checks and increments the sender's hourly counter using Redis Lua script.
   */
  async checkAndIncrement(senderId: string, hourlyLimit: number): Promise<RateLimitResult> {
    const now = new Date();
    const key = this.getHourWindowKey(senderId, now);
    const ttlSeconds = 7200; // 2 hours

    try {
      // Execute atomic Lua script
      const result = (await redisConnection.eval(
        RATE_LIMIT_LUA_SCRIPT,
        1,
        key,
        hourlyLimit.toString(),
        ttlSeconds.toString()
      )) as [number, number];

      const allowed = result[0] === 1;
      const currentCount = result[1];

      if (!allowed) {
        const nextHour = this.getNextHourWindowStart(now);
        const delayMs = Math.max(1000, nextHour.getTime() - now.getTime());

        logger.warn('⚠️ Rate limit hit for sender, rescheduling into next hour window', {
          senderId,
          limit: hourlyLimit,
          currentCount,
          nextWindow: nextHour.toISOString(),
          delayMs,
        });

        return {
          allowed: false,
          currentCount,
          limit: hourlyLimit,
          rescheduledTime: nextHour,
          delayMs,
        };
      }

      return {
        allowed: true,
        currentCount,
        limit: hourlyLimit,
      };
    } catch (err: any) {
      logger.error('❌ Redis Rate Limiter error, falling back to allow send:', { error: err.message });
      // In case Redis error occurs, allow send so emails are not stuck
      return {
        allowed: true,
        currentCount: 1,
        limit: hourlyLimit,
      };
    }
  }

  /**
   * Reads current counter without incrementing (useful for telemetry/dashboards)
   */
  async getCurrentCount(senderId: string): Promise<number> {
    try {
      const key = this.getHourWindowKey(senderId);
      const val = await redisConnection.get(key);
      return val ? parseInt(val, 10) : 0;
    } catch (err: any) {
      return 0;
    }
  }
}

export const rateLimitService = new RateLimitService();
