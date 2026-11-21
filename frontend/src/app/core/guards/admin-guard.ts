import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth-service';

export const adminGuard: CanActivateFn = (_route, state) => {
  // espace admin : il faut le rôle ADMIN
  const authService = inject(AuthService);
  const router = inject(Router);
  if (!authService.isLoggedIn()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  return authService.isAdmin() ? true : router.createUrlTree(['/']); // connecté mais pas admin → accueil
};
