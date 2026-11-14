import { HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminRental, AdminStats, GpuInput, UserChanges } from '../models/admin';
import { Gpu } from '../models/gpu';
import { allMockGpus, saveMockGpus } from './mock-gpus';
import { FieldError, fail, respond, validationError, withAccount } from './mock-http';
import { allMockMessages, saveMockMessages } from './mock-messages';
import { MockRentalRecord, allMockRentals, availableUnits, rentalStatus, saveMockRentals, toApiRental } from './mock-rentals';
import { MockAccount, allMockAccounts, updateMockAccount } from './mock-users';

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
  if (req.method === 'GET' && path === '/admin/users') {
    return withAdmin(req, () => {                          // utilisateurs, les plus récents d'abord, avec leur nombre de locations
      const search = req.params.get('search')?.toLowerCase() ?? '';
      const role = req.params.get('role');
      const blocked = req.params.get('blocked');
      const rentals = allMockRentals();
      const users = allMockAccounts()
        .map((account) => account.user)
        .filter(
          (user) =>
            (!search || `${user.email} ${user.firstName} ${user.lastName}`.toLowerCase().includes(search)) &&
            (!role || user.role === role) &&
            (!blocked || user.isBlocked === (blocked === 'true')),
        )
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .map((user) => ({ ...user, rentalCount: rentals.filter((rental) => rental.userId === user.id).length }));
      return respond({ users, total: users.length });
    });
  }
  const userMatch = path.match(/^\/admin\/users\/(\d+)$/);
  if (userMatch && req.method === 'PATCH') {
    return withAdmin(req, (admin) => updateUser(req as HttpRequest<UserChanges>, Number(userMatch[1]), admin));
  }
  if (req.method === 'GET' && path === '/admin/rentals') {
    return withAdmin(req, () => {                          // toutes les locations, les plus récentes d'abord
      const status = req.params.get('status');
      const userId = req.params.get('userId');
      const gpuId = req.params.get('gpuId');
      const rentals = allMockRentals()
        .filter(
          (rental) =>
            (!status || rentalStatus(rental) === status) &&
            (!userId || rental.userId === Number(userId)) &&
            (!gpuId || rental.gpuId === Number(gpuId)),
        )
        .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate))
        .map(toAdminRental);
      return respond({ rentals, total: rentals.length });
    });
  }
  const cancelMatch = path.match(/^\/admin\/rentals\/(\d+)\/cancel$/);
  if (cancelMatch && req.method === 'PATCH') {
    return withAdmin(req, () => {                          // un admin peut annuler une location à venir ou en cours
      const rentals = allMockRentals();
      const record = rentals.find((rental) => rental.id === Number(cancelMatch[1]));
      if (!record) {
        return fail(req, 404, { error: { code: 'RENTAL_NOT_FOUND', message: 'Rental not found.' } });
      }
      const status = rentalStatus(record);
      if (status !== 'UPCOMING' && status !== 'ACTIVE') {
        return fail(req, 409, { error: { code: 'RENTAL_NOT_CANCELLABLE', message: 'Only upcoming or active rentals can be cancelled.' } });
      }
      record.cancelled = true;
      record.cancelledAt = new Date().toISOString();
      saveMockRentals(rentals);
      return respond({ rental: toAdminRental(record) }, 500);
    });
  }
  if (req.method === 'GET' && path === '/admin/messages') {
    return withAdmin(req, () => {                          // messages de contact, les plus récents d'abord
      const isRead = req.params.get('isRead');
      const all = allMockMessages();
      const messages = all
        .filter((message) => !isRead || message.isRead === (isRead === 'true'))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      return respond({ messages, total: messages.length, unread: all.filter((message) => !message.isRead).length }); // unread : indépendant du filtre
    });
  }
  const messageMatch = path.match(/^\/admin\/messages\/(\d+)$/);
  if (messageMatch && (req.method === 'PATCH' || req.method === 'DELETE')) {
    return withAdmin(req, () => {
      const messages = allMockMessages();
      const message = messages.find((item) => item.id === Number(messageMatch[1]));
      if (!message) {
        return fail(req, 404, { error: { code: 'MESSAGE_NOT_FOUND', message: 'Message not found.' } });
      }
      if (req.method === 'DELETE') {                       // suppression définitive : 204, pas de contenu
        saveMockMessages(messages.filter((item) => item.id !== message.id));
        return respond(null, 400, 204);
      }
      const isRead = (req.body as { isRead?: unknown } | null)?.isRead;
      if (typeof isRead !== 'boolean') {
        return validationError(req, [{ field: 'isRead', message: 'isRead must be true or false.' }]);
      }
      message.isRead = isRead;                             // marquer comme lu / non lu
      saveMockMessages(messages);
      return respond({ message: { ...message } }, 200);
    });
  }
  return null;                                             // pas une route admin connue
}

function updateUser(req: HttpRequest<UserChanges>, id: number, admin: MockAccount): Observable<HttpResponse<unknown>> { // PATCH /admin/users/:id
  const body = req.body ?? {};
  const details: FieldError[] = [];                        // mêmes règles que docs/API.md
  if (body.role !== undefined && body.role !== 'USER' && body.role !== 'ADMIN') details.push({ field: 'role', message: 'Role must be USER or ADMIN.' });
  if (body.isBlocked !== undefined && typeof body.isBlocked !== 'boolean') details.push({ field: 'isBlocked', message: 'isBlocked must be true or false.' });
  if (body.role === undefined && body.isBlocked === undefined) details.push({ field: 'role', message: 'Provide a role or a blocked status.' });
  if (details.length > 0) {
    return validationError(req, details);
  }
  if (id === admin.user.id) {                              // un admin ne peut pas se bloquer ni se retirer son rôle
    return fail(req, 400, { error: { code: 'CANNOT_MODIFY_SELF', message: 'You cannot change your own role or block yourself.' } });
  }
  const changes: UserChanges = {};                         // seulement les champs envoyés
  if (body.role !== undefined) changes.role = body.role;
  if (body.isBlocked !== undefined) changes.isBlocked = body.isBlocked;
  const updated = updateMockAccount(id, { user: changes });
  if (!updated) {
    return fail(req, 404, { error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
  }
  return respond({ user: { ...updated.user } }, 500);
}

function toAdminRental(record: MockRentalRecord): AdminRental { // location + utilisateur (objet « AdminRental » de docs/API.md)
  const user = allMockAccounts().find((account) => account.user.id === record.userId)?.user;
  return {
    ...toApiRental(record),
    user: { id: record.userId, email: user?.email ?? 'unknown@example.com', firstName: user?.firstName ?? 'Unknown', lastName: user?.lastName ?? 'user' },
  };
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
