import { Redis } from 'ioredis';
import { env } from '../config/env';

export const redis = new Redis(env.REDIS_URL, {             // client unique, utilisé seulement pour le rate limiting du login
  maxRetriesPerRequest: 2,                                  // si Redis est arrêté, la requête échoue vite au lieu d'attendre
});

redis.on('error', (err) => console.error('Redis error:', err.message)); // évite un crash si Redis se déconnecte
