import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, MeResponse, RegisterRequest, User } from '../models/user';

const TOKEN_KEY = 'teramind_token';
const USER_KEY = 'teramind_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly tokenState = signal<string | null>(readStorage(TOKEN_KEY));
  private readonly userState = signal<User | null>(readUser());

  readonly token = this.tokenState.asReadonly();
  readonly currentUser = this.userState.asReadonly();
  readonly isLoggedIn = computed(() => this.tokenState() !== null && this.userState() !== null);
  readonly isAdmin = computed(() => this.userState()?.role === 'ADMIN');

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, request)
      .pipe(tap((response) => this.saveSession(response.token, response.user)));
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, request)
      .pipe(tap((response) => this.saveSession(response.token, response.user)));
  }

  updateCurrentUser(user: User): void {
    const token = this.tokenState();
    if (token) {
      this.saveSession(token, user);
    }
  }

  logout(redirectTo = '/'): void {
    this.clearSession();
    this.router.navigateByUrl(redirectTo);
  }

  restoreSession(): Observable<void> {
    if (!this.tokenState()) {
      return of(undefined);
    }
    return this.http.get<MeResponse>(`${environment.apiUrl}/auth/me`).pipe(
      tap((response) => this.saveSession(this.tokenState()!, response.user)),
      map(() => undefined),
      catchError(() => {
        this.clearSession();
        return of(undefined);
      }),
    );
  }

  private saveSession(token: string, user: User): void {
    this.tokenState.set(token);
    this.userState.set(user);
    writeStorage(TOKEN_KEY, token);
    writeStorage(USER_KEY, JSON.stringify(user));
  }

  private clearSession(): void {
    this.tokenState.set(null);
    this.userState.set(null);
    writeStorage(TOKEN_KEY, null);
    writeStorage(USER_KEY, null);
  }
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    return;
  }
}

function readUser(): User | null {
  try {
    const json = readStorage(USER_KEY);
    return json ? (JSON.parse(json) as User) : null;
  } catch {
    return null;
  }
}
