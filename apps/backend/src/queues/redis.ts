import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export const redisConnection = new Redis(config.redis.url, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
});

redisConnection.on('connect', () => {
  logger.info('✅ Redis connected successfully');
});

redisConnection.on('error', (err) => {
  logger.error('❌ Redis connection error:', { error: err.message });
});

export async function checkRedisConnection(): Promise<boolean> {
  try {
    const pong = await redisConnection.ping();
    return pong === 'PONG';
  } catch (err: any) {
    return false;
  }
}
