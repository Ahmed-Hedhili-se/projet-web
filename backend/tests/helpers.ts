import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { redis } from '../src/lib/redis';

export const TEST_DOMAIN = '@test.neurogrid.dev';          // tous les comptes de test utilisent ce domaine

let counter = 0;
export function testEmail(label: string): string {          // email unique à chaque appel
  counter += 1;
  return `${label}-${Date.now()}-${counter}${TEST_DOMAIN}`;
}

export async function registerUser(label = 'user', password = 'MySecret123') { // crée un USER et renvoie son token
  const email = testEmail(label);
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password, firstName: 'Test', lastName: 'User' });
  return { email, password, token: res.body.token as string, user: res.body.user };
}

export async function loginAdmin(): Promise<string> {       // token du compte admin créé par le seed
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  return res.body.token as string;
}

export async function cleanupTestData() {                   // supprime tout ce que les tests ont créé
  const users = await prisma.user.findMany({ where: { email: { endsWith: TEST_DOMAIN } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.rental.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  const keys = await redis.keys(`login-failures:*${TEST_DOMAIN}`);
  if (keys.length) await redis.del(...keys);
}

export async function waitForRedis() {                      // à appeler dans beforeAll : Redis doit être connecté
  if (redis.status === 'ready') return;
  await new Promise<void>((resolve, reject) => {
    redis.once('ready', resolve);
    setTimeout(() => reject(new Error('Redis not ready: run `docker compose up -d`')), 5000);
  });
}

export async function closeConnections() {                  // à appeler dans afterAll
  await prisma.$disconnect();
  await redis.quit();
}
