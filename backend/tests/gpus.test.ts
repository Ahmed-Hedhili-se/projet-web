import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { cleanupTestData, closeConnections, registerUser, waitForRedis } from './helpers';

const START = '2099-03-01T09:00:00.000Z';
const HOURS = 48;
let h100Id: number;
let mi300Id: number;
let v100Id: number;

async function bookDirectly(gpuId: number, quantity: number, start: string, hours: number, status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED') {
  const { user } = await registerUser('gpu');
  const startDate = new Date(start);
  await prisma.rental.create({
    data: {
      userId: user.id, gpuId, quantity, startDate, durationHours: hours, status,
      endDate: new Date(startDate.getTime() + hours * 3600_000),
      totalPrice: 0,
    },
  });
}

beforeAll(async () => {
  await waitForRedis();
  h100Id = (await prisma.gpu.findUniqueOrThrow({ where: { name: 'NVIDIA H100 80GB' } })).id;
  mi300Id = (await prisma.gpu.findUniqueOrThrow({ where: { name: 'AMD Instinct MI300X' } })).id;
  v100Id = (await prisma.gpu.findUniqueOrThrow({ where: { name: 'NVIDIA V100 32GB' } })).id;
});

afterAll(async () => {
  await cleanupTestData();
  await closeConnections();
});

describe('GET /api/gpus', () => {
  it('lists active GPUs only, sorted by price, with total and manufacturers', async () => {
    const res = await request(app).get('/api/gpus');
    expect(res.status).toBe(200);
    const ids = res.body.gpus.map((g: { id: number }) => g.id);
    expect(ids).not.toContain(v100Id);
    expect(res.body.total).toBe(res.body.gpus.length);
    expect(res.body.manufacturers).toEqual(['AMD', 'NVIDIA']);
    const prices = res.body.gpus.map((g: { pricePerHour: number }) => g.pricePerHour);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(Object.keys(res.body.gpus[0]).sort()).toEqual([
      'architecture', 'availableUnits', 'createdAt', 'description', 'fp16Tflops', 'id', 'isActive',
      'manufacturer', 'name', 'pricePerHour', 'totalUnits', 'updatedAt', 'vramGb',
    ]);
    expect(typeof res.body.gpus[0].pricePerHour).toBe('number');
  });

  it('filters by manufacturer, minVram, maxPrice and search', async () => {
    const amd = await request(app).get('/api/gpus?manufacturer=AMD');
    expect(amd.body.gpus.every((g: { manufacturer: string }) => g.manufacturer === 'AMD')).toBe(true);
    expect(amd.body.total).toBeGreaterThan(0);
    expect(amd.body.manufacturers).toEqual(['AMD', 'NVIDIA']);

    const big = await request(app).get('/api/gpus?minVram=80&maxPrice=3.3');
    for (const g of big.body.gpus) {
      expect(g.vramGb).toBeGreaterThanOrEqual(80);
      expect(g.pricePerHour).toBeLessThanOrEqual(3.3);
    }

    const search = await request(app).get('/api/gpus?search=ampere');
    expect(search.body.total).toBeGreaterThan(0);
    expect(search.body.gpus.every((g: { architecture: string }) => g.architecture === 'Ampere')).toBe(true);
  });

  it('supports every sort value', async () => {
    const desc = await request(app).get('/api/gpus?sort=price_desc');
    const prices = desc.body.gpus.map((g: { pricePerHour: number }) => g.pricePerHour);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));

    const vram = await request(app).get('/api/gpus?sort=vram_desc');
    const vrams = vram.body.gpus.map((g: { vramGb: number }) => g.vramGb);
    expect(vrams).toEqual([...vrams].sort((a, b) => b - a));

    const names = (await request(app).get('/api/gpus?sort=name_asc')).body.gpus.map((g: { name: string }) => g.name);
    expect(names).toEqual([...names].sort());
  });

  it('computes availableUnits on the requested period and filters with available=true', async () => {
    const h100 = await prisma.gpu.findUniqueOrThrow({ where: { id: h100Id } });
    const mi300 = await prisma.gpu.findUniqueOrThrow({ where: { id: mi300Id } });
    await bookDirectly(h100Id, 3, START, HOURS);
    await bookDirectly(h100Id, 2, START, HOURS, 'CANCELLED');
    await bookDirectly(mi300Id, mi300.totalUnits, START, HOURS);

    const res = await request(app).get(`/api/gpus?startDate=${START}&durationHours=${HOURS}`);
    const byId = new Map(res.body.gpus.map((g: { id: number }) => [g.id, g]));
    expect((byId.get(h100Id) as { availableUnits: number }).availableUnits).toBe(h100.totalUnits - 3);
    expect((byId.get(mi300Id) as { availableUnits: number }).availableUnits).toBe(0);

    const onlyFree = await request(app).get(`/api/gpus?available=true&startDate=${START}&durationHours=${HOURS}`);
    const freeIds = onlyFree.body.gpus.map((g: { id: number }) => g.id);
    expect(freeIds).not.toContain(mi300Id);
    expect(freeIds).toContain(h100Id);

    const after = new Date(new Date(START).getTime() + HOURS * 3600_000).toISOString();
    const later = await request(app).get(`/api/gpus/${h100Id}?startDate=${after}&durationHours=1`);
    expect(later.body.gpu.availableUnits).toBe(h100.totalUnits);
  });

  it('returns 400 VALIDATION_ERROR for invalid filters', async () => {
    const res = await request(app).get('/api/gpus?minVram=abc&sort=cheapest&durationHours=999&startDate=tomorrow');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field).sort();
    expect(fields).toEqual(['durationHours', 'minVram', 'sort', 'startDate']);
  });
});

describe('GET /api/gpus/:id', () => {
  it('returns one active GPU', async () => {
    const res = await request(app).get(`/api/gpus/${h100Id}`);
    expect(res.status).toBe(200);
    expect(res.body.gpu).toMatchObject({ id: h100Id, name: 'NVIDIA H100 80GB', isActive: true });
  });

  it('returns 404 GPU_NOT_FOUND for an unknown or inactive GPU', async () => {
    for (const id of [999999, v100Id]) {
      const res = await request(app).get(`/api/gpus/${id}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('GPU_NOT_FOUND');
    }
  });

  it('returns 400 VALIDATION_ERROR for a non-numeric id', async () => {
    const res = await request(app).get('/api/gpus/abc');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
