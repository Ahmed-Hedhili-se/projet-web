import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth-interceptor';
import { errorInterceptor } from './core/interceptors/error-interceptor';
import { mockApiInterceptor } from './core/mocks/mock-api-interceptor';
import { AuthService } from './core/services/auth-service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(), // affiche les erreurs non gérées dans la console
    provideRouter(
      routes,
      withComponentInputBinding(), // data, paramètres et query de la route → input() du composant
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }), // remonte en haut de la page à chaque navigation
      withViewTransitions({ skipInitialTransition: true }), // fondu entre les pages (pas au premier chargement)
    ),
    provideHttpClient(
      withFetch(), // utilise l'API fetch du navigateur
      withInterceptors([
        authInterceptor, // 1. ajoute le token
        errorInterceptor, // 2. gère la session expirée (401)
        ...(environment.useMockApi ? [mockApiInterceptor] : []), // 3. données fictives, en dernier pour voir le token
      ]),
    ),
    provideAppInitializer(() => inject(AuthService).restoreSession()), // vérifie la session avant d'afficher l'application
  ],
};
