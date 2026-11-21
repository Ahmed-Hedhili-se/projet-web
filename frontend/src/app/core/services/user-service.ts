import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChangePasswordRequest, MeResponse, UpdateProfileRequest } from '../models/user';
import { AuthService } from './auth-service';

@Injectable({ providedIn: 'root' })
export class UserService {
  // profil de l'utilisateur connecté (docs/API.md, section 7)
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/users/me`;

  getProfile(): Observable<MeResponse> {
    // GET /users/me
    return this.http.get<MeResponse>(this.baseUrl);
  }

  updateProfile(request: UpdateProfileRequest): Observable<MeResponse> {
    // PUT /users/me
    return this.http
      .put<MeResponse>(this.baseUrl, request)
      .pipe(tap((response) => this.authService.updateCurrentUser(response.user))); // la Navbar affiche le nouveau nom
  }

  changePassword(request: ChangePasswordRequest): Observable<{ success: boolean }> {
    // PUT /users/me/password
    return this.http.put<{ success: boolean }>(`${this.baseUrl}/password`, request);
  }
}
