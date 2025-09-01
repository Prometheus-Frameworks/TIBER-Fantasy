import Redis from 'ioredis';
import { logger } from './logger.js';

let redis: Redis | null = null;

export async function initCache() {
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
    logger.info('🚀 Redis cache initialized');
  } else {
    logger.warn('⚠️ Redis not configured, caching disabled');
  }
}

export const cache = {
  async get(key: string): Promise<string | null> {
    if (!redis) return null;
    try {
      return await redis.get(key);
    } catch (err) {
      logger.warn('Cache get failed', { key, error: err });
      return null;
    }
  },

  async set(key: string, value: string, ttlSeconds: number = 300): Promise<void> {
    if (!redis) return;
    try {
      await redis.setex(key, ttlSeconds, value);
    } catch (err) {
      logger.warn('Cache set failed', { key, error: err });
    }
  },

  async del(pattern: string): Promise<void> {
    if (!redis) return;
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      logger.warn('Cache delete failed', { pattern, error: err });
    }
  }
};

export function closeCache() {
  return redis?.quit();
}