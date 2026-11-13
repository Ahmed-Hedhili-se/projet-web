import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminGpuListResponse, AdminStats, GpuInput } from '../models/admin';
import { GpuResponse } from '../models/gpu';

@Injectable({ providedIn: 'root' })
export class AdminService {                                // routes /admin/* (docs/API.md, section 9) — rôle ADMIN obligatoire
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin`;

  readonly unreadMessages = signal(0);                     // badge du menu admin, mis à jour à chaque lecture des stats

  getStats(): Observable<AdminStats> {                     // GET /admin/stats
    return this.http
      .get<AdminStats>(`${this.baseUrl}/stats`)
      .pipe(tap((stats) => this.unreadMessages.set(stats.messages.unread)));
  }

  listGpus(): Observable<AdminGpuListResponse> {           // GET /admin/gpus (actifs et désactivés)
    return this.http.get<AdminGpuListResponse>(`${this.baseUrl}/gpus`);
  }

  createGpu(input: GpuInput): Observable<GpuResponse> {    // POST /admin/gpus
    return this.http.post<GpuResponse>(`${this.baseUrl}/gpus`, input);
  }

  updateGpu(id: number, input: GpuInput): Observable<GpuResponse> { // PUT /admin/gpus/:id (remplace toutes les infos)
    return this.http.put<GpuResponse>(`${this.baseUrl}/gpus/${id}`, input);
  }

  deactivateGpu(id: number): Observable<GpuResponse> {     // DELETE /admin/gpus/:id (= désactivation)
    return this.http.delete<GpuResponse>(`${this.baseUrl}/gpus/${id}`);
  }
}
