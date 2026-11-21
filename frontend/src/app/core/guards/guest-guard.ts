import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth-service';

export const guestGuard: CanActivateFn = () => {
  // /login et /register : inutile si on est déjà connecté
  return inject(AuthService).isLoggedIn() ? inject(Router).createUrlTree(['/']) : true;
};
