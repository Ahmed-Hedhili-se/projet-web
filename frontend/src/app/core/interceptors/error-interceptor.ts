import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth-service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  // session expirée → déconnexion et retour au login
  const authService = inject(AuthService);
  return next(req).pipe(
    catchError((err: unknown) => {
      const isAuthRequest = req.url.endsWith('/auth/login') || req.url.endsWith('/auth/me'); // erreurs gérées par la page ou par AuthService
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        !isAuthRequest &&
        authService.isLoggedIn()
      ) {
        authService.logout('/login');
      }
      return throwError(() => err); // l'erreur continue jusqu'au composant
    }),
  );
};
