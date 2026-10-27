import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth-service';

export const authInterceptor: HttpInterceptorFn = (req, next) => { // ajoute le token à chaque requête vers notre API
  const token = inject(AuthService).token();
  if (!token || !req.url.startsWith(environment.apiUrl)) {
    return next(req);                                      // pas connecté, ou requête vers un autre site
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })); // copie de la requête avec le header
};
