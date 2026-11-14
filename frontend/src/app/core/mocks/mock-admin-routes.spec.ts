import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ContactMessage } from '../models/contact';
import { AdminGpuListResponse, AdminMessageListResponse, AdminRental, AdminRentalListResponse, AdminStats, AdminUserListResponse, GpuInput } from '../models/admin';
import { GpuResponse } from '../models/gpu';
import { User } from '../models/user';
import { mockApiInterceptor } from './mock-api-interceptor';

describe('mock admin routes (/admin/*)', () => {
  let http: HttpClient;
  const admin = { headers: { Authorization: 'Bearer mock-token-1' } };
  const user = { headers: { Authorization: 'Bearer mock-token-3' } };
  const newGpu: GpuInput = {
    name: 'NVIDIA L40S 48GB', manufacturer: 'NVIDIA', architecture: 'Ada Lovelace', vramGb: 48,
    fp16Tflops: 362, pricePerHour: 1.1, totalUnits: 10, description: 'Versatile GPU for inference.', isActive: true,
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([mockApiInterceptor]))] });
    http = TestBed.inject(HttpClient);
  });

  const expectError = async (request: Promise<unknown>) => (await request.catch((err: unknown) => err)) as HttpErrorResponse;

  it('should refuse a USER with 403 FORBIDDEN', async () => {
    const error = await expectError(firstValueFrom(http.get(`${environment.apiUrl}/admin/stats`, user)));
    expect(error.status).toBe(403);
    expect(error.error.error.code).toBe('FORBIDDEN');
  });

  it('should return the statistics of the last 6 months', async () => {
    const stats = await firstValueFrom(http.get<AdminStats>(`${environment.apiUrl}/admin/stats`, admin));
    expect(stats.rentalsPerMonth.length).toBe(6);
    expect(stats.users.admins).toBe(1);
    expect(stats.messages.unread).toBe(3);
    expect(stats.topGpus.length).toBeLessThanOrEqual(5);
    expect(stats.rentals.total).toBe(stats.rentals.upcoming + stats.rentals.active + stats.rentals.completed + stats.rentals.cancelled);
  });

  it('should list active and inactive GPUs sorted by name', async () => {
    const response = await firstValueFrom(http.get<AdminGpuListResponse>(`${environment.apiUrl}/admin/gpus`, admin));
    expect(response.gpus.some((gpu) => !gpu.isActive)).toBe(true);
    expect(response.gpus.map((gpu) => gpu.name)).toEqual([...response.gpus.map((gpu) => gpu.name)].sort((a, b) => a.localeCompare(b)));
  });

  it('should create a GPU, then refuse the same name with GPU_NAME_TAKEN', async () => {
    const created = await firstValueFrom(http.post<GpuResponse>(`${environment.apiUrl}/admin/gpus`, newGpu, admin));
    expect(created.gpu.id).toBe(8);
    expect(created.gpu.availableUnits).toBe(10);

    const error = await expectError(firstValueFrom(http.post(`${environment.apiUrl}/admin/gpus`, newGpu, admin)));
    expect(error.status).toBe(409);
    expect(error.error.error.code).toBe('GPU_NAME_TAKEN');
  });

  it('should deactivate a GPU and hide it from the public catalog', async () => {
    const response = await firstValueFrom(http.delete<GpuResponse>(`${environment.apiUrl}/admin/gpus/1`, admin));
    expect(response.gpu.isActive).toBe(false);
    const error = await expectError(firstValueFrom(http.get(`${environment.apiUrl}/gpus/1`)));
    expect(error.status).toBe(404);
  });

  it('should list the users with their rental count and filter them', async () => {
    const all = await firstValueFrom(http.get<AdminUserListResponse>(`${environment.apiUrl}/admin/users`, admin));
    expect(all.total).toBe(7);
    expect(all.users[0].email).toBe('jane.doe@example.com');
    expect(all.users[0].rentalCount).toBe(4);

    const blocked = await firstValueFrom(http.get<AdminUserListResponse>(`${environment.apiUrl}/admin/users`, { ...admin, params: { blocked: 'true' } }));
    expect(blocked.users.map((item) => item.email)).toEqual(['blocked@example.com']);
  });

  it('should block a user, who can then no longer use the API', async () => {
    const response = await firstValueFrom(http.patch<{ user: User }>(`${environment.apiUrl}/admin/users/3`, { isBlocked: true }, admin));
    expect(response.user.isBlocked).toBe(true);
    expect(response.user.role).toBe('USER');

    const error = await expectError(firstValueFrom(http.get(`${environment.apiUrl}/rentals/me`, user)));
    expect(error.status).toBe(403);
    expect(error.error.error.code).toBe('ACCOUNT_BLOCKED');
  });

  it('should refuse an admin who changes their own account, and an empty body', async () => {
    const self = await expectError(firstValueFrom(http.patch(`${environment.apiUrl}/admin/users/1`, { role: 'USER' }, admin)));
    expect(self.status).toBe(400);
    expect(self.error.error.code).toBe('CANNOT_MODIFY_SELF');

    const empty = await expectError(firstValueFrom(http.patch(`${environment.apiUrl}/admin/users/3`, {}, admin)));
    expect(empty.error.error.code).toBe('VALIDATION_ERROR');

    const missing = await expectError(firstValueFrom(http.patch(`${environment.apiUrl}/admin/users/999`, { role: 'ADMIN' }, admin)));
    expect(missing.error.error.code).toBe('USER_NOT_FOUND');
  });

  it('should list every rental with its user and filter by user', async () => {
    const all = await firstValueFrom(http.get<AdminRentalListResponse>(`${environment.apiUrl}/admin/rentals`, admin));
    expect(all.total).toBe(50);
    expect(all.rentals.map((rental) => rental.startDate)).toEqual([...all.rentals.map((rental) => rental.startDate)].sort().reverse());

    const janes = await firstValueFrom(http.get<AdminRentalListResponse>(`${environment.apiUrl}/admin/rentals`, { ...admin, params: { userId: '3', status: 'ACTIVE' } }));
    expect(janes.rentals.map((rental) => rental.id)).toEqual([14]);
    expect(janes.rentals[0].user.email).toBe('jane.doe@example.com');
  });

  it('should cancel an active rental of any user, but not a completed one', async () => {
    const response = await firstValueFrom(http.patch<{ rental: AdminRental }>(`${environment.apiUrl}/admin/rentals/14/cancel`, {}, admin));
    expect(response.rental.status).toBe('CANCELLED');
    expect(response.rental.cancelledAt).not.toBeNull();

    const error = await expectError(firstValueFrom(http.patch(`${environment.apiUrl}/admin/rentals/12/cancel`, {}, admin)));
    expect(error.status).toBe(409);
    expect(error.error.error.code).toBe('RENTAL_NOT_CANCELLABLE');
  });

  it('should list the messages, mark one as read and delete it', async () => {
    const url = `${environment.apiUrl}/admin/messages`;
    const unreadOnly = await firstValueFrom(http.get<AdminMessageListResponse>(url, { ...admin, params: { isRead: 'false' } }));
    expect(unreadOnly.messages.map((message) => message.id)).toEqual([12, 11, 10]);
    expect(unreadOnly.unread).toBe(3);

    const read = await firstValueFrom(http.patch<{ message: ContactMessage }>(`${url}/12`, { isRead: true }, admin));
    expect(read.message.isRead).toBe(true);

    const deleted = await firstValueFrom(http.delete(`${url}/12`, { ...admin, observe: 'response' }));
    expect(deleted.status).toBe(204);

    const all = await firstValueFrom(http.get<AdminMessageListResponse>(url, admin));
    expect(all.total).toBe(5);
    expect(all.unread).toBe(2);

    const missing = await expectError(firstValueFrom(http.delete(`${url}/12`, admin)));
    expect(missing.error.error.code).toBe('MESSAGE_NOT_FOUND');
  });
});
