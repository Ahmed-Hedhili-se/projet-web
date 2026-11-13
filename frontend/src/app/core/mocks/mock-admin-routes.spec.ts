import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminGpuListResponse, AdminStats, GpuInput } from '../models/admin';
import { GpuResponse } from '../models/gpu';
import { mockApiInterceptor } from './mock-api-interceptor';

describe('mock admin routes (/admin/*)', () => {
  let http: HttpClient;
  const admin = { headers: { Authorization: 'Bearer mock-token-1' } }; // Amira (ADMIN)
  const user = { headers: { Authorization: 'Bearer mock-token-3' } };  // Jane (USER)
  const newGpu: GpuInput = {
    name: 'NVIDIA L40S 48GB', manufacturer: 'NVIDIA', architecture: 'Ada Lovelace', vramGb: 48,
    fp16Tflops: 362, pricePerHour: 1.1, totalUnits: 10, description: 'Versatile GPU for inference.', isActive: true,
  };

  beforeEach(() => {
    localStorage.clear();                                  // repart des données de démonstration
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
    expect(stats.messages.unread).toBe(3);                 // 3 messages d'exemple non lus
    expect(stats.topGpus.length).toBeLessThanOrEqual(5);
    expect(stats.rentals.total).toBe(stats.rentals.upcoming + stats.rentals.active + stats.rentals.completed + stats.rentals.cancelled);
  });

  it('should list active and inactive GPUs sorted by name', async () => {
    const response = await firstValueFrom(http.get<AdminGpuListResponse>(`${environment.apiUrl}/admin/gpus`, admin));
    expect(response.gpus.some((gpu) => !gpu.isActive)).toBe(true); // le V100 désactivé est visible pour l'admin
    expect(response.gpus.map((gpu) => gpu.name)).toEqual([...response.gpus.map((gpu) => gpu.name)].sort((a, b) => a.localeCompare(b)));
  });

  it('should create a GPU, then refuse the same name with GPU_NAME_TAKEN', async () => {
    const created = await firstValueFrom(http.post<GpuResponse>(`${environment.apiUrl}/admin/gpus`, newGpu, admin));
    expect(created.gpu.id).toBe(8);                        // comme l'exemple de docs/API.md
    expect(created.gpu.availableUnits).toBe(10);

    const error = await expectError(firstValueFrom(http.post(`${environment.apiUrl}/admin/gpus`, newGpu, admin)));
    expect(error.status).toBe(409);
    expect(error.error.error.code).toBe('GPU_NAME_TAKEN');
  });

  it('should deactivate a GPU and hide it from the public catalog', async () => {
    const response = await firstValueFrom(http.delete<GpuResponse>(`${environment.apiUrl}/admin/gpus/1`, admin));
    expect(response.gpu.isActive).toBe(false);
    const error = await expectError(firstValueFrom(http.get(`${environment.apiUrl}/gpus/1`)));
    expect(error.status).toBe(404);                        // plus visible dans le catalogue public
  });
});
