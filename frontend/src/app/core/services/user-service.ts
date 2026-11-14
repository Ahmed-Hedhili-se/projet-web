import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChangePasswordRequest, MeResponse, UpdateProfileRequest } from '../models/user';
import { AuthService } from './auth-service';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/users/me`;

  getProfile(): Observable<MeResponse> {
    return this.http.get<MeResponse>(this.baseUrl);
  }

  updateProfile(request: UpdateProfileRequest): Observable<MeResponse> {
    return this.http
      .put<MeResponse>(this.baseUrl, request)
      .pipe(tap((response) => this.authService.updateCurrentUser(response.user)));
  }

  changePassword(request: ChangePasswordRequest): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.baseUrl}/password`, request);
  }
}
