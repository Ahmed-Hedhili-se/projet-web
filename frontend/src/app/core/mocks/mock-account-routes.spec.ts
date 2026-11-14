import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RentalListResponse, RentalResponse } from '../models/rental';
import { mockApiInterceptor } from './mock-api-interceptor';

describe('mock account routes (/rentals, /users/me)', () => {
  let http: HttpClient;
  const auth = { headers: { Authorization: 'Bearer mock-token-3' } };
  const inTwoDays = () => new Date(Date.now() + 48 * 3600_000).toISOString();

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([mockApiInterceptor]))] });
    http = TestBed.inject(HttpClient);
  });

  const expectError = async (request: Promise<unknown>) => (await request.catch((err: unknown) => err)) as HttpErrorResponse;

  it('should refuse GET /rentals/me without a token', async () => {
    const error = await expectError(firstValueFrom(http.get(`${environment.apiUrl}/rentals/me`)));
    expect(error.status).toBe(401);
  });

  it('should list the demo rentals of Jane, most recent first', async () => {
    const response = await firstValueFrom(http.get<RentalListResponse>(`${environment.apiUrl}/rentals/me`, auth));
    expect(response.total).toBe(4);
    expect(response.rentals.map((rental) => rental.status)).toEqual(['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED']);
  });

  it('should create a rental with a price calculated by the server', async () => {
    const response = await firstValueFrom(
      http.post<RentalResponse>(`${environment.apiUrl}/rentals`, { gpuId: 1, quantity: 2, startDate: inTwoDays(), durationHours: 10 }, auth),
    );
    expect(response.rental.totalPrice).toBe(64);
    expect(response.rental.status).toBe('UPCOMING');
  });

  it('should refuse more units than available with NOT_ENOUGH_UNITS', async () => {
    const error = await expectError(
      firstValueFrom(http.post(`${environment.apiUrl}/rentals`, { gpuId: 4, quantity: 1, startDate: inTwoDays(), durationHours: 5 }, auth)),
    );
    expect(error.status).toBe(409);
    expect(error.error.error.code).toBe('NOT_ENOUGH_UNITS');
  });

  it('should cancel an upcoming rental but not an active one', async () => {
    const cancelled = await firstValueFrom(http.patch<RentalResponse>(`${environment.apiUrl}/rentals/15/cancel`, {}, auth));
    expect(cancelled.rental.status).toBe('CANCELLED');

    const error = await expectError(firstValueFrom(http.patch(`${environment.apiUrl}/rentals/14/cancel`, {}, auth)));
    expect(error.status).toBe(409);
    expect(error.error.error.code).toBe('RENTAL_NOT_CANCELLABLE');
  });

  it('should hide the rentals of other users with RENTAL_NOT_FOUND', async () => {
    const error = await expectError(firstValueFrom(http.patch(`${environment.apiUrl}/rentals/16/cancel`, {}, auth)));
    expect(error.status).toBe(404);
  });

  it('should check the current password before changing it', async () => {
    const wrong = await expectError(
      firstValueFrom(http.put(`${environment.apiUrl}/users/me/password`, { currentPassword: 'nope', newPassword: 'NewPassword1' }, auth)),
    );
    expect(wrong.error.error.code).toBe('WRONG_PASSWORD');

    const ok = await firstValueFrom(
      http.put<{ success: boolean }>(`${environment.apiUrl}/users/me/password`, { currentPassword: 'Password123', newPassword: 'NewPassword1' }, auth),
    );
    expect(ok.success).toBe(true);
  });
});
