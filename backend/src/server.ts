import { app } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

const server = app.listen(env.PORT, () => {                 // démarre le serveur HTTP
  console.log(`NeuroGrid API running on http://localhost:${env.PORT}/api`);
});

async function shutdown(signal: string) {                   // arrêt propre : fin des requêtes, puis fermeture des connexions
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    await redis.quit().catch(() => undefined);              // Redis peut déjà être déconnecté
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();        // sécurité : arrêt forcé après 10 s
}

process.on('SIGINT', () => shutdown('SIGINT'));             // Ctrl+C
process.on('SIGTERM', () => shutdown('SIGTERM'));           // arrêt demandé par le système
