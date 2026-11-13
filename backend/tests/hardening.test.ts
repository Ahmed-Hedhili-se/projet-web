import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { cleanupTestData, closeConnections, testEmail, waitForRedis } from './helpers';

beforeAll(() => waitForRedis());

afterAll(async () => {
  await cleanupTestData();
  await closeConnections();
});

describe('Hardening (audit fixes)', () => {
  it('does not reveal the server technology and sends security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('returns 413 PAYLOAD_TOO_LARGE for a body over 100 KB', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a'.repeat(200_000), password: 'x' }));
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
  });

  it('5 simultaneous registrations with the same email → one 201 and four 409 EMAIL_TAKEN (never 500)', async () => {
    const email = testEmail('race');
    const body = { email, password: 'MySecret123', firstName: 'Race', lastName: 'Test' };
    const results = await Promise.all(
      Array.from({ length: 5 }, () => request(app).post('/api/auth/register').send(body)),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    results
      .filter((r) => r.status === 409)
      .forEach((r) => expect(r.body.error.code).toBe('EMAIL_TAKEN'));
  });

  it('rejects a non-object JSON body with 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('[1,2]');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
