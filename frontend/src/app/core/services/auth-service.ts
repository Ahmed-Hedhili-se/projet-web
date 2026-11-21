import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, MeResponse, RegisterRequest, User } from '../models/user';

const TOKEN_KEY = 'teramind_token'; // clés utilisées dans le localStorage du navigateur
const USER_KEY = 'teramind_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // connexion, déconnexion et utilisateur courant
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly tokenState = signal<string | null>(readStorage(TOKEN_KEY)); // relu au démarrage : la connexion survit au rafraîchissement
  private readonly userState = signal<User | null>(readUser());

  readonly token = this.tokenState.asReadonly(); // lecture seule pour le reste de l'application
  readonly currentUser = this.userState.asReadonly();
  readonly isLoggedIn = computed(() => this.tokenState() !== null && this.userState() !== null);
  readonly isAdmin = computed(() => this.userState()?.role === 'ADMIN');

  login(request: LoginRequest): Observable<AuthResponse> {
    // POST /auth/login
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, request)
      .pipe(tap((response) => this.saveSession(response.token, response.user))); // garde le token si la connexion réussit
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    // POST /auth/register : crée le compte et connecte directement
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, request)
      .pipe(tap((response) => this.saveSession(response.token, response.user)));
  }

  updateCurrentUser(user: User): void {
    // après une modification du profil (UserService)
    const token = this.tokenState();
    if (token) {
      this.saveSession(token, user);
    }
  }

  logout(redirectTo = '/'): void {
    // pas de route API : on oublie simplement le token
    this.clearSession();
    this.router.navigateByUrl(redirectTo);
  }

  restoreSession(): Observable<void> {
    // appelé au démarrage : vérifie que le token est encore valide
    if (!this.tokenState()) {
      return of(undefined); // personne n'est connecté
    }
    return this.http.get<MeResponse>(`${environment.apiUrl}/auth/me`).pipe(
      tap((response) => this.saveSession(this.tokenState()!, response.user)), // met à jour le profil (rôle, blocage…)
      map(() => undefined),
      catchError(() => {
        this.clearSession(); // token expiré ou compte bloqué : on déconnecte
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
  // localStorage peut être bloqué (navigation privée) : on ne plante pas
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
    // stockage indisponible : la session ne durera que le temps de la page
    return;
  }
}

function readUser(): User | null {
  // utilisateur enregistré lors de la dernière connexion
  try {
    const json = readStorage(USER_KEY);
    return json ? (JSON.parse(json) as User) : null;
  } catch {
    return null; // contenu illisible : on considère qu'on est déconnecté
  }
}
