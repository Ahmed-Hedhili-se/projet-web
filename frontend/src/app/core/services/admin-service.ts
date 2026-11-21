import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminGpuListResponse,
  AdminMessageListResponse,
  AdminRental,
  AdminRentalListResponse,
  AdminStats,
  AdminUserListResponse,
  GpuInput,
  UserChanges,
} from '../models/admin';
import { ContactMessage } from '../models/contact';
import { GpuResponse } from '../models/gpu';
import { User } from '../models/user';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin`;

  readonly unreadMessages = signal(0);

  getStats(): Observable<AdminStats> {
    return this.http
      .get<AdminStats>(`${this.baseUrl}/stats`)
      .pipe(tap((stats) => this.unreadMessages.set(stats.messages.unread)));
  }

  listGpus(): Observable<AdminGpuListResponse> {
    return this.http.get<AdminGpuListResponse>(`${this.baseUrl}/gpus`);
  }

  createGpu(input: GpuInput): Observable<GpuResponse> {
    return this.http.post<GpuResponse>(`${this.baseUrl}/gpus`, input);
  }

  updateGpu(id: number, input: GpuInput): Observable<GpuResponse> {
    return this.http.put<GpuResponse>(`${this.baseUrl}/gpus/${id}`, input);
  }

  deactivateGpu(id: number): Observable<GpuResponse> {
    return this.http.delete<GpuResponse>(`${this.baseUrl}/gpus/${id}`);
  }

  listUsers(): Observable<AdminUserListResponse> {
    return this.http.get<AdminUserListResponse>(`${this.baseUrl}/users`);
  }

  updateUser(id: number, changes: UserChanges): Observable<{ user: User }> {
    return this.http.patch<{ user: User }>(`${this.baseUrl}/users/${id}`, changes);
  }

  listRentals(): Observable<AdminRentalListResponse> {
    return this.http.get<AdminRentalListResponse>(`${this.baseUrl}/rentals`);
  }

  cancelRental(id: number): Observable<{ rental: AdminRental }> {
    return this.http.patch<{ rental: AdminRental }>(`${this.baseUrl}/rentals/${id}/cancel`, {});
  }

  listMessages(): Observable<AdminMessageListResponse> {
    return this.http
      .get<AdminMessageListResponse>(`${this.baseUrl}/messages`)
      .pipe(tap((response) => this.unreadMessages.set(response.unread)));
  }

  setMessageRead(id: number, isRead: boolean): Observable<{ message: ContactMessage }> {
    return this.http.patch<{ message: ContactMessage }>(`${this.baseUrl}/messages/${id}`, {
      isRead,
    });
  }

  deleteMessage(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/messages/${id}`);
  }
}
