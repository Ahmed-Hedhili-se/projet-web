import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { redis } from '../src/lib/redis';
import { signToken } from '../src/utils/jwt';
import { cleanupTestData, closeConnections, loginAdmin, registerUser, testEmail, waitForRedis } from './helpers';

beforeAll(() => waitForRedis());

afterAll(async () => {
  await cleanupTestData();
  await closeConnections();
});

describe('POST /api/auth/register', () => {
  it('creates a USER, returns 201 with token and user (no passwordHash)', async () => {
    const email = testEmail('reg');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: email.toUpperCase(), password: 'MySecret123', firstName: ' Jane ', lastName: 'Doe' });

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({ email, firstName: 'Jane', lastName: 'Doe', role: 'USER', isBlocked: false });
    expect(Object.keys(res.body.user).sort()).toEqual(
      ['createdAt', 'email', 'firstName', 'id', 'isBlocked', 'lastName', 'role'],
    );
    const saved = await prisma.user.findUnique({ where: { email } });
    expect(saved!.passwordHash).not.toBe('MySecret123');      // haché avec bcrypt
  });

  it('returns 409 EMAIL_TAKEN for an existing email', async () => {
    const { email } = await registerUser('dup');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'MySecret123', firstName: 'A', lastName: 'B' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('returns 400 VALIDATION_ERROR with details', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short', firstName: '', lastName: 'B' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'password', 'firstName']));
  });

  it('cannot register as ADMIN by sending a role field', async () => {
    const email = testEmail('role');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'MySecret123', firstName: 'A', lastName: 'B', role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('USER');
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    const { email, password } = await registerUser('login');
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.email).toBe(email);
  });

  it('returns 401 INVALID_CREDENTIALS for a wrong password or unknown email', async () => {
    const { email } = await registerUser('wrong');
    const wrong = await request(app).post('/api/auth/login').send({ email, password: 'BadPassword1' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');

    const unknown = await request(app).post('/api/auth/login').send({ email: testEmail('ghost'), password: 'x' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 429 TOO_MANY_ATTEMPTS on the 6th failure, even with the right password', async () => {
    const { email, password } = await registerUser('limit');
    for (let i = 1; i <= 5; i++) {
      const res = await request(app).post('/api/auth/login').send({ email, password: 'BadPassword1' });
      expect(res.status).toBe(401);
    }
    const sixth = await request(app).post('/api/auth/login').send({ email, password: 'BadPassword1' });
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.code).toBe('TOO_MANY_ATTEMPTS');

    const blockedGood = await request(app).post('/api/auth/login').send({ email, password });
    expect(blockedGood.status).toBe(429);                     // bloqué pendant 15 minutes
  });

  it('a successful login resets the failure counter', async () => {
    const { email, password } = await registerUser('reset');
    for (let i = 1; i <= 4; i++) {
      await request(app).post('/api/auth/login').send({ email, password: 'BadPassword1' });
    }
    expect((await request(app).post('/api/auth/login').send({ email, password })).status).toBe(200);
    for (let i = 1; i <= 4; i++) {
      const res = await request(app).post('/api/auth/login').send({ email, password: 'BadPassword1' });
      expect(res.status).toBe(401);                           // compteur remis à zéro : pas encore 429
    }
  });

  it('still logs in quickly when Redis is down (rate limit skipped, never 500)', async () => {
    const { email, password } = await registerUser('redisdown');
    const down = () => Promise.reject(new Error('Connection is closed.'));
    const spies = [
      vi.spyOn(redis, 'get').mockImplementation(down),
      vi.spyOn(redis, 'incr').mockImplementation(down),
      vi.spyOn(redis, 'del').mockImplementation(down),
    ];
    vi.spyOn(console, 'error').mockImplementation(() => undefined); // évite le bruit dans la sortie des tests
    try {
      const ok = await request(app).post('/api/auth/login').send({ email, password });
      expect(ok.status).toBe(200);
      const wrong = await request(app).post('/api/auth/login').send({ email, password: 'BadPassword1' });
      expect(wrong.status).toBe(401);
    } finally {
      spies.forEach((s) => s.mockRestore());
      vi.restoreAllMocks();
    }
  });

  it('returns 403 ACCOUNT_BLOCKED for a blocked user', async () => {
    const { email, password, user } = await registerUser('blocked');
    await prisma.user.update({ where: { id: user.id }, data: { isBlocked: true } });
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_BLOCKED');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user with a valid token', async () => {
    const { token, email } = await registerUser('me');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  it('returns 401 UNAUTHORIZED without token or with an invalid token', async () => {
    const none = await request(app).get('/api/auth/me');
    expect(none.status).toBe(401);
    expect(none.body.error.code).toBe('UNAUTHORIZED');

    const bad = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not.a.token');
    expect(bad.status).toBe(401);
  });

  it('returns 401 for a token of a user that no longer exists', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${signToken(999999, 'USER')}`);
    expect(res.status).toBe(401);
  });

  it('refuses an old token once the user is blocked (403)', async () => {
    const { token, user } = await registerUser('oldtoken');
    await prisma.user.update({ where: { id: user.id }, data: { isBlocked: true } });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_BLOCKED');
  });
});

describe('Admin routes protection', () => {
  it('refuses a USER with 403 FORBIDDEN', async () => {
    const { token } = await registerUser('notadmin');
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('refuses an anonymous request with 401', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  it('lets an ADMIN through (route not implemented yet → 404)', async () => {
    const token = await loginAdmin();
    expect(token).toBeTruthy();
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);                             // B7 ajoutera /admin/stats
  });
});
