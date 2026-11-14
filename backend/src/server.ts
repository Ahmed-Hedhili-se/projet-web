import { app } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

const server = app.listen(env.PORT, () => {
  console.log(`NeuroGrid API running on http://localhost:${env.PORT}/api`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    await redis.quit().catch(() => undefined);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
