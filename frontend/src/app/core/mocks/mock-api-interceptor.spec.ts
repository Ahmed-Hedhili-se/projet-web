import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GpuListResponse } from '../models/gpu';
import { mockApiInterceptor } from './mock-api-interceptor';

describe('mockApiInterceptor', () => {
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([mockApiInterceptor]))],
    });
    http = TestBed.inject(HttpClient);
  });

  it('should hide inactive GPUs and sort by price by default', async () => {
    const response = await firstValueFrom(http.get<GpuListResponse>(`${environment.apiUrl}/gpus`));
    expect(response.gpus.some((gpu) => !gpu.isActive)).toBe(false); // le V100 désactivé n'apparaît pas
    expect(response.gpus[0].name).toBe('NVIDIA RTX 4090'); // le moins cher en premier
    expect(response.manufacturers).toEqual(['AMD', 'NVIDIA']);
  });

  it('should apply the filters', async () => {
    const response = await firstValueFrom(
      http.get<GpuListResponse>(`${environment.apiUrl}/gpus`, { params: { minVram: 80, maxPrice: 3, available: true } }),
    );
    expect(response.gpus.map((gpu) => gpu.name)).toEqual(['NVIDIA A100 80GB']);
    expect(response.total).toBe(1);
  });

  it('should return GPU_NOT_FOUND for an unknown id', async () => {
    const error = await firstValueFrom(http.get(`${environment.apiUrl}/gpus/999`)).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect((error as HttpErrorResponse).status).toBe(404);
    expect((error as HttpErrorResponse).error.error.code).toBe('GPU_NOT_FOUND');
  });
});
