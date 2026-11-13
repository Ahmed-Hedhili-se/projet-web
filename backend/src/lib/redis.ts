import { Redis } from 'ioredis';
import { env } from '../config/env';

export const redis = new Redis(env.REDIS_URL, {             // client unique, utilisé seulement pour le rate limiting du login
  enableOfflineQueue: false,                                // Redis arrêté : la commande échoue tout de suite au lieu d'attendre
  maxRetriesPerRequest: 1,
  connectTimeout: 2000,                                     // 2 s maximum pour se connecter
  commandTimeout: 1000,                                     // 1 s maximum par commande
});

let lastErrorLog = 0;
redis.on('error', (err) => {                                // évite un crash, et limite les logs à 1 toutes les 30 s
  if (Date.now() - lastErrorLog > 30_000) {
    console.error('Redis error:', err.message);
    lastErrorLog = Date.now();
  }
});
