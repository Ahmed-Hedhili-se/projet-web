import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';

afterAll(() => prisma.$disconnect());

describe('B1 - setup', () => {
  it('GET /api/health returns { status: "ok" }', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('unknown route returns 404 NOT_FOUND in the common error format', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });

  it('malformed JSON body returns 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('CORS allows the Angular frontend origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:4200');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:4200');
  });

  it('database contains the seeded GPUs and the admin account', async () => {
    const gpus = await prisma.gpu.findMany({ orderBy: { id: 'asc' } });
    expect(gpus).toHaveLength(7);
    expect(gpus[0].name).toBe('NVIDIA H100 80GB');
    expect(gpus.filter((g) => g.isActive)).toHaveLength(6); // la V100 est désactivée
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    expect(admin).not.toBeNull();
    expect(admin!.passwordHash).not.toBe(process.env.ADMIN_PASSWORD); // mot de passe bien haché
  });
});
