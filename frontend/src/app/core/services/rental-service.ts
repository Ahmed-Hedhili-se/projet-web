import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateRentalRequest, RentalListResponse, RentalResponse } from '../models/rental';

@Injectable({ providedIn: 'root' })
export class RentalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/rentals`;

  listMine(): Observable<RentalListResponse> {
    return this.http.get<RentalListResponse>(`${this.baseUrl}/me`);
  }

  create(request: CreateRentalRequest): Observable<RentalResponse> {
    return this.http.post<RentalResponse>(this.baseUrl, request);
  }

  cancel(id: number): Observable<RentalResponse> {
    return this.http.patch<RentalResponse>(`${this.baseUrl}/${id}/cancel`, {});
  }
}
