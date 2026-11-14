import { Redis } from 'ioredis';
import { env } from '../config/env';

export const redis = new Redis(env.REDIS_URL, {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: 2000,
  commandTimeout: 1000,
});

let lastErrorLog = 0;
redis.on('error', (err) => {
  if (Date.now() - lastErrorLog > 30_000) {
    console.error('Redis error:', err.message);
    lastErrorLog = Date.now();
  }
});
