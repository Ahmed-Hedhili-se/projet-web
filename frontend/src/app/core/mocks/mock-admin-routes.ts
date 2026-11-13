import { HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminStats, GpuInput } from '../models/admin';
import { Gpu } from '../models/gpu';
import { allMockGpus, saveMockGpus } from './mock-gpus';
import { FieldError, fail, respond, validationError, withAccount } from './mock-http';
import { allMockMessages } from './mock-messages';
import { allMockRentals, availableUnits, rentalStatus } from './mock-rentals';
import { MockAccount, allMockAccounts } from './mock-users';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function withAdmin(                                        // routes « ADMIN » : 401 / 403 si pas connecté, 403 FORBIDDEN si pas admin
  req: HttpRequest<unknown>,
  handler: (account: MockAccount) => Observable<HttpResponse<unknown>>,
): Observable<HttpResponse<unknown>> {
  return withAccount(req, (account) =>
    account.user.role === 'ADMIN'
      ? handler(account)
      : fail(req, 403, { error: { code: 'FORBIDDEN', message: 'You do not have access to this page.' } }),
  );
}

export function handleAdminRoutes(req: HttpRequest<unknown>, path: string): Observable<HttpResponse<unknown>> | null { // null = pas une route admin
  if (!path.startsWith('/admin/')) {
    return null;
  }
  if (req.method === 'GET' && path === '/admin/stats') {
    return withAdmin(req, () => respond(computeStats(), 600));
  }
  if (req.method === 'GET' && path === '/admin/gpus') {
    return withAdmin(req, () => {                          // tous les GPU, triés par nom, avec le nombre de locations
      const rentals = allMockRentals();
      const now = new Date();
      const gpus = allMockGpus()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((gpu) => ({
          ...gpu,
          availableUnits: availableUnits(gpu, now, new Date(now.getTime() + HOUR_MS)), // libres maintenant
          rentalCount: rentals.filter((rental) => rental.gpuId === gpu.id).length,     // annulées comprises
        }));
      return respond({ gpus, total: gpus.length });
    });
  }
  if (req.method === 'POST' && path === '/admin/gpus') {
    return withAdmin(req, () => saveGpu(req as HttpRequest<GpuInput>, null));
  }
  const gpuMatch = path.match(/^\/admin\/gpus\/(\d+)$/);
  if (gpuMatch && req.method === 'PUT') {
    return withAdmin(req, () => saveGpu(req as HttpRequest<GpuInput>, Number(gpuMatch[1])));
  }
  if (gpuMatch && req.method === 'DELETE') {
    return withAdmin(req, () => {                          // « suppression » = désactivation (l'historique est gardé)
      const gpus = allMockGpus();
      const gpu = gpus.find((item) => item.id === Number(gpuMatch[1]));
      if (!gpu) {
        return fail(req, 404, { error: { code: 'GPU_NOT_FOUND', message: 'GPU not found.' } });
      }
      gpu.isActive = false;
      gpu.updatedAt = new Date().toISOString();
      saveMockGpus(gpus);
      return respond({ gpu: { ...gpu } });
    });
  }
  return null;                                             // autres routes admin : étapes suivantes
}

function saveGpu(req: HttpRequest<GpuInput>, id: number | null): Observable<HttpResponse<unknown>> { // POST (id = null) ou PUT
  const body = req.body;
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const details: FieldError[] = [];                        // mêmes règles que docs/API.md
  if (text(body?.name).length < 1 || text(body?.name).length > 100) details.push({ field: 'name', message: 'Enter a name (100 characters max).' });
  if (text(body?.manufacturer).length < 1 || text(body?.manufacturer).length > 50) details.push({ field: 'manufacturer', message: 'Enter a manufacturer (50 characters max).' });
  if (text(body?.architecture).length < 1 || text(body?.architecture).length > 50) details.push({ field: 'architecture', message: 'Enter an architecture (50 characters max).' });
  if (!Number.isInteger(body?.vramGb) || body!.vramGb < 1 || body!.vramGb > 1024) details.push({ field: 'vramGb', message: 'Memory must be a whole number between 1 and 1024.' });
  if (!(Number(body?.fp16Tflops) > 0)) details.push({ field: 'fp16Tflops', message: 'TFLOPS must be greater than 0.' });
  if (!(Number(body?.pricePerHour) > 0)) details.push({ field: 'pricePerHour', message: 'Price must be greater than 0.' });
  if (!Number.isInteger(body?.totalUnits) || body!.totalUnits < 0 || body!.totalUnits > 1000) details.push({ field: 'totalUnits', message: 'Units must be a whole number between 0 and 1000.' });
  if (text(body?.description).length < 1 || text(body?.description).length > 1000) details.push({ field: 'description', message: 'Enter a description (1000 characters max).' });
  if (id !== null && typeof body?.isActive !== 'boolean') details.push({ field: 'isActive', message: 'Choose a status.' });
  if (!body || details.length > 0) {
    return validationError(req, details);
  }

  const gpus = allMockGpus();
  const existing = id === null ? null : gpus.find((gpu) => gpu.id === id);
  if (id !== null && !existing) {
    return fail(req, 404, { error: { code: 'GPU_NOT_FOUND', message: 'GPU not found.' } });
  }
  if (gpus.some((gpu) => gpu.name.toLowerCase() === text(body.name).toLowerCase() && gpu.id !== id)) {
    return fail(req, 409, { error: { code: 'GPU_NAME_TAKEN', message: 'A GPU with this name already exists.' } });
  }

  const now = new Date().toISOString();
  const values = {
    name: text(body.name), manufacturer: text(body.manufacturer), architecture: text(body.architecture),
    vramGb: body.vramGb, fp16Tflops: Number(body.fp16Tflops), pricePerHour: Math.round(Number(body.pricePerHour) * 100) / 100,
    totalUnits: body.totalUnits, description: text(body.description), isActive: body.isActive ?? true,
  };
  let gpu: Gpu;
  if (existing) {
    const booked = existing.totalUnits - existing.availableUnits; // unités déjà prises par les autres clients fictifs
    Object.assign(existing, values, { availableUnits: Math.max(0, values.totalUnits - booked), updatedAt: now });
    gpu = existing;
  } else {
    gpu = { ...values, id: Math.max(0, ...gpus.map((item) => item.id)) + 1, availableUnits: values.totalUnits, createdAt: now, updatedAt: now };
    gpus.push(gpu);
  }
  saveMockGpus(gpus);
  const start = new Date();
  return respond({ gpu: { ...gpu, availableUnits: availableUnits(gpu, start, new Date(start.getTime() + HOUR_MS)) } }, 600, existing ? 200 : 201);
}

function computeStats(): AdminStats {                      // statistiques calculées à partir des données fictives
  const accounts = allMockAccounts();
  const gpus = allMockGpus();
  const rentals = allMockRentals();
  const messages = allMockMessages();
  const paid = rentals.filter((rental) => !rental.cancelled); // revenus : locations non annulées
  const round = (value: number) => Math.round(value * 100) / 100;
  const byStatus = (status: string) => rentals.filter((rental) => rentalStatus(rental) === status).length;

  const top = new Map<number, { rentalCount: number; revenue: number }>(); // regroupement par GPU
  for (const rental of paid) {
    const entry = top.get(rental.gpuId) ?? { rentalCount: 0, revenue: 0 };
    entry.rentalCount++;
    entry.revenue += rental.totalPrice;
    top.set(rental.gpuId, entry);
  }

  const months: AdminStats['rentalsPerMonth'] = [];        // les 6 derniers mois, mois en cours inclus
  const today = new Date();
  for (let offset = 5; offset >= 0; offset--) {
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const inMonth = paid.filter((rental) => rental.startDate.slice(0, 7) === key);
    months.push({ month: key, count: inMonth.length, revenue: round(inMonth.reduce((sum, rental) => sum + rental.totalPrice, 0)) });
  }

  return {
    users: {
      total: accounts.length,
      admins: accounts.filter((account) => account.user.role === 'ADMIN').length,
      blocked: accounts.filter((account) => account.user.isBlocked).length,
    },
    gpus: { total: gpus.length, active: gpus.filter((gpu) => gpu.isActive).length, totalUnits: gpus.reduce((sum, gpu) => sum + gpu.totalUnits, 0) },
    rentals: { total: rentals.length, upcoming: byStatus('UPCOMING'), active: byStatus('ACTIVE'), completed: byStatus('COMPLETED'), cancelled: byStatus('CANCELLED') },
    revenue: {
      total: round(paid.reduce((sum, rental) => sum + rental.totalPrice, 0)),
      last30Days: round(paid.filter((rental) => Date.parse(rental.startDate) > Date.now() - 30 * DAY_MS).reduce((sum, rental) => sum + rental.totalPrice, 0)),
    },
    messages: { total: messages.length, unread: messages.filter((message) => !message.isRead).length },
    topGpus: [...top.entries()]
      .map(([gpuId, entry]) => ({ gpuId, name: gpus.find((gpu) => gpu.id === gpuId)?.name ?? 'Unknown GPU', rentalCount: entry.rentalCount, revenue: round(entry.revenue) }))
      .sort((a, b) => b.rentalCount - a.rentalCount || b.revenue - a.revenue)
      .slice(0, 5),
    rentalsPerMonth: months,
  };
}
