import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GpuListResponse, GpuQuery, GpuResponse } from '../models/gpu';

@Injectable({ providedIn: 'root' })
export class GpuService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/gpus`;

  list(filters: GpuQuery = {}): Observable<GpuListResponse> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '' && value !== false) {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<GpuListResponse>(this.baseUrl, { params });
  }

  getById(
    id: number,
    period?: { startDate: string; durationHours: number },
  ): Observable<GpuResponse> {
    const params = period
      ? new HttpParams()
          .set('startDate', period.startDate)
          .set('durationHours', String(period.durationHours))
      : undefined;
    return this.http.get<GpuResponse>(`${this.baseUrl}/${id}`, { params });
  }
}
