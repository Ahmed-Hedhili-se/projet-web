import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GpuListResponse } from '../models/gpu';
import { AuthResponse } from '../models/user';
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

  it('should save a valid contact message and return its id', async () => {
    const response = await firstValueFrom(
      http.post<{ success: boolean; id: number }>(`${environment.apiUrl}/contact`, {
        name: 'John Smith', email: 'john.smith@example.com', subject: 'Volume pricing', message: 'Hello, do you offer discounts?',
      }),
    );
    expect(response.success).toBe(true);
    expect(response.id).toBeGreaterThan(12);               // continue après l'exemple n° 12 de docs/API.md
  });

  it('should reject an invalid contact message with VALIDATION_ERROR', async () => {
    const error = (await firstValueFrom(
      http.post(`${environment.apiUrl}/contact`, { name: '', email: 'not-an-email', subject: 'Hi', message: 'Too short' }),
    ).catch((err: unknown) => err)) as HttpErrorResponse;  // on attend une erreur HTTP
    expect(error.status).toBe(400);
    expect(error.error.error.code).toBe('VALIDATION_ERROR');
    expect(error.error.error.details.map((detail: { field: string }) => detail.field)).toEqual(['name', 'email', 'message']);
  });

  it('should log in a demo user and return a token', async () => {
    const response = await firstValueFrom(
      http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, { email: 'jane.doe@example.com', password: 'Password123' }),
    );
    expect(response.token).toBe('mock-token-3');
    expect(response.user.role).toBe('USER');
    expect('password' in response.user).toBe(false);       // jamais de mot de passe dans la réponse
  });

  it('should refuse a blocked account with ACCOUNT_BLOCKED', async () => {
    const error = (await firstValueFrom(
      http.post(`${environment.apiUrl}/auth/login`, { email: 'blocked@example.com', password: 'Password123' }),
    ).catch((err: unknown) => err)) as HttpErrorResponse;
    expect(error.status).toBe(403);
    expect(error.error.error.code).toBe('ACCOUNT_BLOCKED');
  });

  it('should return 401 five times, then 429 TOO_MANY_ATTEMPTS', async () => {
    const tryWrongPassword = async () =>
      (await firstValueFrom(
        http.post(`${environment.apiUrl}/auth/login`, { email: 'admin@neurogrid.example', password: 'wrong' }),
      ).catch((err: unknown) => err)) as HttpErrorResponse;

    for (let attempt = 1; attempt <= 5; attempt++) {
      expect((await tryWrongPassword()).status).toBe(401); // échecs 1 à 5
    }
    const sixth = await tryWrongPassword();
    expect(sixth.status).toBe(429);                        // 6e tentative bloquée
    expect(sixth.error.error.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('should return the user of the token on GET /auth/me', async () => {
    const response = await firstValueFrom(
      http.get<{ user: { email: string } }>(`${environment.apiUrl}/auth/me`, { headers: { Authorization: 'Bearer mock-token-3' } }),
    );
    expect(response.user.email).toBe('jane.doe@example.com');
  });

  it('should return GPU_NOT_FOUND for an unknown id', async () => {
    const error = await firstValueFrom(http.get(`${environment.apiUrl}/gpus/999`)).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect((error as HttpErrorResponse).status).toBe(404);
    expect((error as HttpErrorResponse).error.error.code).toBe('GPU_NOT_FOUND');
  });
});
