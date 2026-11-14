import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminGpuListResponse, AdminMessageListResponse, AdminRental, AdminRentalListResponse, AdminStats, AdminUserListResponse, GpuInput, UserChanges } from '../models/admin';
import { ContactMessage } from '../models/contact';
import { GpuResponse } from '../models/gpu';
import { User } from '../models/user';

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

  listUsers(): Observable<AdminUserListResponse> {         // GET /admin/users (la page filtre elle-même la liste)
    return this.http.get<AdminUserListResponse>(`${this.baseUrl}/users`);
  }

  updateUser(id: number, changes: UserChanges): Observable<{ user: User }> { // PATCH /admin/users/:id (rôle et/ou blocage)
    return this.http.patch<{ user: User }>(`${this.baseUrl}/users/${id}`, changes);
  }

  listRentals(): Observable<AdminRentalListResponse> {     // GET /admin/rentals (toutes les locations, avec leur utilisateur)
    return this.http.get<AdminRentalListResponse>(`${this.baseUrl}/rentals`);
  }

  cancelRental(id: number): Observable<{ rental: AdminRental }> { // PATCH /admin/rentals/:id/cancel (à venir ou en cours)
    return this.http.patch<{ rental: AdminRental }>(`${this.baseUrl}/rentals/${id}/cancel`, {});
  }

  listMessages(): Observable<AdminMessageListResponse> {   // GET /admin/messages (met aussi à jour le badge du menu)
    return this.http
      .get<AdminMessageListResponse>(`${this.baseUrl}/messages`)
      .pipe(tap((response) => this.unreadMessages.set(response.unread)));
  }

  setMessageRead(id: number, isRead: boolean): Observable<{ message: ContactMessage }> { // PATCH /admin/messages/:id (lu / non lu)
    return this.http.patch<{ message: ContactMessage }>(`${this.baseUrl}/messages/${id}`, { isRead });
  }

  deleteMessage(id: number): Observable<void> {            // DELETE /admin/messages/:id (réponse 204, sans contenu)
    return this.http.delete<void>(`${this.baseUrl}/messages/${id}`);
  }
}
